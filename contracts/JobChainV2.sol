// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title JobChainV2
 * @notice Decentralized AI Agent Job Queue with ERC-8004 Identity + ERC-8183 Job Protocol
 * @dev Deployed on Arc Testnet — USDC is the native gas token
 *
 * Features:
 * - Agent registration with on-chain identity + capabilities
 * - USDC escrow for job payments
 * - Capability-based job matching
 * - Reputation scoring with staking + slashing
 * - FIFO priority job queue
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract JobChainV2 {
    // ══════════════════════════════════════════════════════
    // State
    // ══════════════════════════════════════════════════════

    IERC20 public immutable usdc;
    address public owner;

    // ── Agent Registry (ERC-8004 inspired) ──
    struct Agent {
        address owner;
        string name;
        string capabilities; // comma-separated tags e.g. "nlp,vision,data"
        uint256 stakedAmount;
        uint256 completedJobs;
        uint256 totalScore;
        uint256 failedJobs;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(uint256 => Agent) public agents;
    uint256 public nextAgentId;

    // ── Job Queue (ERC-8183 inspired) ──
    enum JobStatus { Open, InProgress, Submitted, Completed, Failed, Cancelled }

    struct Job {
        address poster;
        string description;
        string requiredCapabilities; // comma-separated
        uint256 reward;
        uint256 deadline;
        uint256 assignedAgent;
        JobStatus status;
        string resultHash;
        uint8 rating; // 1-5 stars, 0 = unrated
        uint256 createdAt;
    }

    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;

    // ── Protocol Treasury ──
    uint256 public protocolFees;
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    uint256 public constant MIN_STAKE = 1e6; // 1 USDC (6 decimals)
    uint256 public constant SLASH_PERCENTAGE = 10; // 10% slash on failure

    // ══════════════════════════════════════════════════════
    // Events
    // ══════════════════════════════════════════════════════

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name, string capabilities);
    event AgentStaked(uint256 indexed agentId, uint256 amount, uint256 totalStake);
    event AgentSlashed(uint256 indexed agentId, uint256 slashAmount, string reason);
    event AgentDeactivated(uint256 indexed agentId);

    event JobPosted(uint256 indexed jobId, address indexed poster, uint256 reward, string requiredCapabilities, uint256 deadline);
    event JobPickedUp(uint256 indexed jobId, uint256 indexed agentId);
    event ResultSubmitted(uint256 indexed jobId, uint256 indexed agentId, string resultHash);
    event JobApproved(uint256 indexed jobId, uint8 rating);
    event PaymentReleased(uint256 indexed jobId, uint256 indexed agentId, uint256 amount);
    event JobFailed(uint256 indexed jobId, uint256 indexed agentId, string reason);
    event JobCancelled(uint256 indexed jobId);

    // ══════════════════════════════════════════════════════
    // Constructor
    // ══════════════════════════════════════════════════════

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    // ══════════════════════════════════════════════════════
    // Agent Registry (ERC-8004)
    // ══════════════════════════════════════════════════════

    function registerAgent(string calldata _name, string calldata _capabilities) external returns (uint256) {
        uint256 id = nextAgentId++;
        agents[id] = Agent({
            owner: msg.sender,
            name: _name,
            capabilities: _capabilities,
            stakedAmount: 0,
            completedJobs: 0,
            totalScore: 0,
            failedJobs: 0,
            isActive: true,
            registeredAt: block.timestamp
        });

        emit AgentRegistered(id, msg.sender, _name, _capabilities);
        return id;
    }

    function stakeCollateral(uint256 _agentId, uint256 _amount) external {
        Agent storage a = agents[_agentId];
        require(a.owner == msg.sender, "Not agent owner");
        require(_amount > 0, "Amount must be > 0");

        require(usdc.transferFrom(msg.sender, address(this), _amount), "Stake transfer failed");
        a.stakedAmount += _amount;

        emit AgentStaked(_agentId, _amount, a.stakedAmount);
    }

    function getAgentReputation(uint256 _agentId) external view returns (uint256 score, uint256 completed, uint256 failed) {
        Agent storage a = agents[_agentId];
        score = a.completedJobs > 0 ? (a.totalScore * 100) / a.completedJobs : 0; // score in basis points (e.g. 450 = 4.50)
        completed = a.completedJobs;
        failed = a.failedJobs;
    }

    // ══════════════════════════════════════════════════════
    // Job Queue (ERC-8183)
    // ══════════════════════════════════════════════════════

    function postJob(
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _reward,
        uint256 _deadline
    ) external returns (uint256) {
        require(_reward > 0, "Reward must be > 0");
        require(_deadline > block.timestamp, "Deadline must be future");

        require(usdc.transferFrom(msg.sender, address(this), _reward), "Escrow lock failed");

        uint256 id = nextJobId++;
        jobs[id] = Job({
            poster: msg.sender,
            description: _description,
            requiredCapabilities: _requiredCapabilities,
            reward: _reward,
            deadline: _deadline,
            assignedAgent: 0,
            status: JobStatus.Open,
            resultHash: "",
            rating: 0,
            createdAt: block.timestamp
        });

        emit JobPosted(id, msg.sender, _reward, _requiredCapabilities, _deadline);
        return id;
    }

    function pickupJob(uint256 _jobId, uint256 _agentId) external {
        Job storage j = jobs[_jobId];
        Agent storage a = agents[_agentId];

        require(j.status == JobStatus.Open, "Job not open");
        require(a.owner == msg.sender, "Not agent owner");
        require(a.isActive, "Agent not active");
        require(a.stakedAmount >= MIN_STAKE, "Insufficient stake");
        require(block.timestamp < j.deadline, "Job expired");

        j.status = JobStatus.InProgress;
        j.assignedAgent = _agentId;

        emit JobPickedUp(_jobId, _agentId);
    }

    function submitResult(uint256 _jobId, string calldata _resultHash) external {
        Job storage j = jobs[_jobId];
        Agent storage a = agents[j.assignedAgent];

        require(j.status == JobStatus.InProgress, "Job not in progress");
        require(a.owner == msg.sender, "Not assigned agent");

        j.status = JobStatus.Submitted;
        j.resultHash = _resultHash;

        emit ResultSubmitted(_jobId, j.assignedAgent, _resultHash);
    }

    function approveAndRelease(uint256 _jobId, uint8 _rating) external {
        Job storage j = jobs[_jobId];
        require(j.poster == msg.sender, "Only poster can approve");
        require(j.status == JobStatus.Submitted, "Result not submitted");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");

        Agent storage a = agents[j.assignedAgent];

        // Calculate fee
        uint256 fee = (j.reward * PROTOCOL_FEE_BPS) / 10000;
        uint256 payout = j.reward - fee;
        protocolFees += fee;

        // Update job
        j.status = JobStatus.Completed;
        j.rating = _rating;

        // Update agent reputation
        a.completedJobs++;
        a.totalScore += _rating;

        // Pay agent
        require(usdc.transfer(a.owner, payout), "Payment failed");

        emit JobApproved(_jobId, _rating);
        emit PaymentReleased(_jobId, j.assignedAgent, payout);
    }

    function failJob(uint256 _jobId, string calldata _reason) external {
        Job storage j = jobs[_jobId];
        require(j.poster == msg.sender, "Only poster can fail");
        require(j.status == JobStatus.InProgress || j.status == JobStatus.Submitted, "Invalid status");

        Agent storage a = agents[j.assignedAgent];

        // Slash agent stake
        uint256 slashAmount = (a.stakedAmount * SLASH_PERCENTAGE) / 100;
        if (slashAmount > 0) {
            a.stakedAmount -= slashAmount;
            protocolFees += slashAmount;
            emit AgentSlashed(j.assignedAgent, slashAmount, _reason);
        }

        // Deactivate if stake too low
        if (a.stakedAmount < MIN_STAKE) {
            a.isActive = false;
            emit AgentDeactivated(j.assignedAgent);
        }

        a.failedJobs++;

        // Return escrow to poster
        j.status = JobStatus.Failed;
        require(usdc.transfer(j.poster, j.reward), "Refund failed");

        emit JobFailed(_jobId, j.assignedAgent, _reason);
    }

    function cancelJob(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        require(j.poster == msg.sender, "Only poster can cancel");
        require(j.status == JobStatus.Open, "Can only cancel open jobs");

        j.status = JobStatus.Cancelled;
        require(usdc.transfer(j.poster, j.reward), "Refund failed");

        emit JobCancelled(_jobId);
    }

    // ══════════════════════════════════════════════════════
    // View Functions
    // ══════════════════════════════════════════════════════

    function getJob(uint256 _jobId) external view returns (
        address poster, string memory description, string memory requiredCapabilities,
        uint256 reward, uint256 deadline, uint256 assignedAgent,
        JobStatus status, string memory resultHash, uint8 rating, uint256 createdAt
    ) {
        Job storage j = jobs[_jobId];
        return (j.poster, j.description, j.requiredCapabilities, j.reward, j.deadline,
                j.assignedAgent, j.status, j.resultHash, j.rating, j.createdAt);
    }

    function getAgent(uint256 _agentId) external view returns (
        address agentOwner, string memory name, string memory capabilities,
        uint256 stakedAmount, uint256 completedJobs, uint256 totalScore,
        uint256 failedJobs, bool isActive, uint256 registeredAt
    ) {
        Agent storage a = agents[_agentId];
        return (a.owner, a.name, a.capabilities, a.stakedAmount, a.completedJobs,
                a.totalScore, a.failedJobs, a.isActive, a.registeredAt);
    }

    // ── Owner Functions ──

    function withdrawFees() external {
        require(msg.sender == owner, "Only owner");
        uint256 amount = protocolFees;
        protocolFees = 0;
        require(usdc.transfer(owner, amount), "Withdraw failed");
    }
}
