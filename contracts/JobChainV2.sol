// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title JobChainV2
 * @notice Decentralized AI Agent Job Queue with ERC-8004 Identity + ERC-8183 Job Protocol
 * @dev Deployed on Arc Testnet — USDC is the native gas token
 * @dev Deployed on Arc Testnet — Multi-currency support (USDC/EURC) with StableFX routing
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 score,
        uint8 category,
        string calldata tag,
        string calldata comment,
        string calldata metadata,
        string calldata attestation,
        bytes32 referenceHash
    ) external;
}

interface IStableFX {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
}

contract JobChainV2 {
    // ══════════════════════════════════════════════════════
    // State
    // ══════════════════════════════════════════════════════

    IERC20 public immutable usdc;
    IERC20 public immutable eurc;
    IIdentityRegistry public immutable identityRegistry;
    IReputationRegistry public immutable reputationRegistry;
    address public owner;
    address public stableFX;

    // ── Agent Local State (Metrics & Collateral) ──
    struct Agent {
        uint256 stakedAmount;
        uint256 completedJobs;
        uint256 totalScore;
        uint256 failedJobs;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(uint256 => Agent) public agents;
    mapping(uint256 => address) public agentPayoutToken; // Preferred payout token address per agent

    // ── Job Queue (ERC-8183 inspired) ──
    enum JobStatus { Open, InProgress, Submitted, Completed, Failed, Cancelled, Disputed }

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
        address paymentToken; // USDC or EURC
        uint256 failedAt; // Timestamp when marked failed
    }

    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;

    // ── Disputes & Arbitration ──
    struct Dispute {
        uint256 disputedAt;
        uint256 approveWeight;
        uint256 rejectWeight;
        bool resolved;
    }

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted;
    mapping(uint256 => uint256[]) public disputeVoters;

    // ── Protocol Treasury ──
    uint256 public protocolFees; // Legacy USDC accumulated fees
    mapping(address => uint256) public protocolTokenFees; // Token -> fee balance
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    uint256 public constant MIN_STAKE = 1e6; // 1 USDC (6 decimals)
    uint256 public constant SLASH_PERCENTAGE = 10; // 10% slash on failure

    // ══════════════════════════════════════════════════════
    // Events
    // ══════════════════════════════════════════════════════

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
    event AgentPayoutPreferenceUpdated(uint256 indexed agentId, address indexed token);
    
    event JobFailedFinalized(uint256 indexed jobId, uint256 indexed agentId);
    event DisputeOpened(uint256 indexed jobId, uint256 indexed agentId, address indexed opener);
    event DisputeVoteCast(uint256 indexed jobId, uint256 indexed agentId, address indexed voter, bool supportAgent, uint256 weight);
    event DisputeResolved(uint256 indexed jobId, bool resolvedInFavorOfAgent, uint256 approveWeight, uint256 rejectWeight);

    // ══════════════════════════════════════════════════════
    // Constructor
    // ══════════════════════════════════════════════════════

    constructor(
        address _usdc,
        address _eurc,
        address _identityRegistry,
        address _reputationRegistry,
        address _stableFX
    ) {
        usdc = IERC20(_usdc);
        eurc = IERC20(_eurc);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        stableFX = _stableFX;
        owner = msg.sender;
    }

    // ── Setter for StableFX address ──
    function setStableFX(address _stableFX) external {
        require(msg.sender == owner, "Only owner");
        stableFX = _stableFX;
    }

    // ══════════════════════════════════════════════════════
    // Agent Collateral (Staking) & Account Settings
    // ══════════════════════════════════════════════════════

    function stakeCollateral(uint256 _agentId, uint256 _amount) external {
        require(identityRegistry.ownerOf(_agentId) == msg.sender, "Not agent owner");
        require(_amount > 0, "Amount must be > 0");

        require(usdc.transferFrom(msg.sender, address(this), _amount), "Stake transfer failed");
        
        Agent storage a = agents[_agentId];
        if (a.registeredAt == 0) {
            a.isActive = true;
            a.registeredAt = block.timestamp;
        }
        a.stakedAmount += _amount;

        emit AgentStaked(_agentId, _amount, a.stakedAmount);
    }

    function setAgentPayoutToken(uint256 _agentId, address _token) external {
        require(identityRegistry.ownerOf(_agentId) == msg.sender, "Not agent owner");
        require(_token == address(usdc) || _token == address(eurc), "Unsupported token preference");
        agentPayoutToken[_agentId] = _token;
        emit AgentPayoutPreferenceUpdated(_agentId, _token);
    }

    function getAgentReputation(uint256 _agentId) external view returns (uint256 score, uint256 completed, uint256 failed) {
        Agent storage a = agents[_agentId];
        score = a.completedJobs > 0 ? (a.totalScore * 100) / a.completedJobs : 0;
        completed = a.completedJobs;
        failed = a.failedJobs;
    }

    // ══════════════════════════════════════════════════════
    // Job Queue (ERC-8183 with multi-currency options)
    // ══════════════════════════════════════════════════════

    function postJob(
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _reward,
        uint256 _deadline,
        address _paymentToken
    ) external returns (uint256) {
        require(_paymentToken == address(usdc) || _paymentToken == address(eurc), "Unsupported payment token");
        require(_reward > 0, "Reward must be > 0");
        require(_deadline > block.timestamp, "Deadline must be future");

        require(IERC20(_paymentToken).transferFrom(msg.sender, address(this), _reward), "Escrow lock failed");

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
            createdAt: block.timestamp,
            paymentToken: _paymentToken,
            failedAt: 0
        });

        emit JobPosted(id, msg.sender, _reward, _requiredCapabilities, _deadline);
        return id;
    }

    function pickupJob(uint256 _jobId, uint256 _agentId) external {
        Job storage j = jobs[_jobId];
        Agent storage a = agents[_agentId];

        require(j.status == JobStatus.Open, "Job not open");
        require(identityRegistry.ownerOf(_agentId) == msg.sender, "Not agent owner");
        require(a.isActive, "Agent not active");
        require(a.stakedAmount >= MIN_STAKE, "Insufficient stake");
        require(block.timestamp < j.deadline, "Job expired");

        j.status = JobStatus.InProgress;
        j.assignedAgent = _agentId;

        emit JobPickedUp(_jobId, _agentId);
    }

    function submitResult(uint256 _jobId, string calldata _resultHash) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.InProgress, "Job not in progress");
        require(identityRegistry.ownerOf(j.assignedAgent) == msg.sender, "Not assigned agent");

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

        // 1. Calculate fee in the source token
        uint256 fee = (j.reward * PROTOCOL_FEE_BPS) / 10000;
        uint256 payoutInSource = j.reward - fee;
        protocolTokenFees[j.paymentToken] += fee;
        if (j.paymentToken == address(usdc)) {
            protocolFees += fee;
        }

        // Update job
        j.status = JobStatus.Completed;
        j.rating = _rating;

        // Update agent reputation
        a.completedJobs++;
        a.totalScore += _rating;

        // Fetch agent owner from IdentityRegistry
        address agentOwner = identityRegistry.ownerOf(j.assignedAgent);

        // Fetch agent's preferred payout currency settings
        address preferredToken = agentPayoutToken[j.assignedAgent];
        if (preferredToken == address(0)) {
            preferredToken = j.paymentToken; // fallback to the job's funding token
        }

        uint256 finalPayoutAmount = payoutInSource;

        // 2. Perform on-chain swap using StableFX if preference differs
        if (preferredToken != j.paymentToken) {
            uint256 minAmountOut = (payoutInSource * 95) / 100; // Slippage tolerance: 5%
            finalPayoutAmount = _swapTokens(j.paymentToken, preferredToken, payoutInSource, minAmountOut);
        }

        // Pay agent in preferred token
        require(IERC20(preferredToken).transfer(agentOwner, finalPayoutAmount), "Payment failed");

        // Submit feedback to official ReputationRegistry (using defensive try-catch)
        bytes32 refHash = keccak256(abi.encodePacked("successful_job", _jobId));
        int128 score = int128(int256((uint256(_rating) - 1) * 25)); // 1-5 mapped to 0-100
        try reputationRegistry.giveFeedback(
            j.assignedAgent,
            score,
            0, // category
            "successful_job",
            "Job completed successfully",
            "",
            "",
            refHash
        ) {} catch {}

        emit JobApproved(_jobId, _rating);
        emit PaymentReleased(_jobId, j.assignedAgent, finalPayoutAmount);
    }

    function failJob(uint256 _jobId, string calldata _reason) external {
        Job storage j = jobs[_jobId];
        require(j.poster == msg.sender, "Only poster can fail");
        require(j.status == JobStatus.InProgress || j.status == JobStatus.Submitted, "Invalid status");

        j.status = JobStatus.Failed;
        j.failedAt = block.timestamp;

        emit JobFailed(_jobId, j.assignedAgent, _reason);
    }

    function claimFailedRefund(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.Failed, "Job not failed");
        require(j.failedAt > 0, "No failure registered");
        require(block.timestamp >= j.failedAt + 24 hours, "Dispute window still open");

        Agent storage a = agents[j.assignedAgent];

        // Slash agent stake
        uint256 slashAmount = (a.stakedAmount * SLASH_PERCENTAGE) / 100;
        if (slashAmount > 0) {
            a.stakedAmount -= slashAmount;
            protocolTokenFees[address(usdc)] += slashAmount;
            protocolFees += slashAmount;
            emit AgentSlashed(j.assignedAgent, slashAmount, "Job failed finalization");
        }

        // Deactivate if stake too low
        if (a.stakedAmount < MIN_STAKE) {
            a.isActive = false;
            emit AgentDeactivated(j.assignedAgent);
        }

        a.failedJobs++;

        // Refund poster
        require(IERC20(j.paymentToken).transfer(j.poster, j.reward), "Refund failed");

        // Submit feedback to official ReputationRegistry (defensive try-catch)
        bytes32 refHash = keccak256(abi.encodePacked("failed_job_finalized", _jobId));
        int128 score = -50;
        try reputationRegistry.giveFeedback(
            j.assignedAgent,
            score,
            0,
            "failed_job",
            "Job failed finalization",
            "",
            "",
            refHash
        ) {} catch {}

        emit JobFailedFinalized(_jobId, j.assignedAgent);
    }

    function openDispute(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.Failed, "Job not failed");
        require(j.failedAt > 0, "No failure registered");
        require(block.timestamp < j.failedAt + 24 hours, "Dispute window closed");
        require(identityRegistry.ownerOf(j.assignedAgent) == msg.sender, "Only assigned agent can dispute");

        j.status = JobStatus.Disputed;

        disputes[_jobId] = Dispute({
            disputedAt: block.timestamp,
            approveWeight: 0,
            rejectWeight: 0,
            resolved: false
        });

        emit DisputeOpened(_jobId, j.assignedAgent, msg.sender);
    }

    function castVote(uint256 _jobId, uint256 _agentId, bool _supportAgent) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.Disputed, "Job not disputed");
        Dispute storage d = disputes[_jobId];
        require(!d.resolved, "Dispute already resolved");
        require(block.timestamp < d.disputedAt + 48 hours, "Voting window closed");

        // Verify voter is the owner of the voting agent
        require(identityRegistry.ownerOf(_agentId) == msg.sender, "Not agent owner");
        
        // Verify eligibility of the voting agent
        require(isEligibleValidator(_agentId), "Agent not eligible validator");
        
        // Verify agent is not the assigned agent of the job being disputed
        require(j.assignedAgent != _agentId, "Assigned agent cannot vote");

        // Prevent double voting
        require(!hasVoted[_jobId][_agentId], "Already voted");
        hasVoted[_jobId][_agentId] = true;
        disputeVoters[_jobId].push(_agentId);

        // Calculate vote weight based on agent reputation (average score * 100)
        Agent storage a = agents[_agentId];
        uint256 weight = (a.totalScore * 100) / a.completedJobs;

        if (_supportAgent) {
            d.approveWeight += weight;
        } else {
            d.rejectWeight += weight;
        }

        emit DisputeVoteCast(_jobId, _agentId, msg.sender, _supportAgent, weight);
    }

    function resolveDispute(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.Disputed, "Job not disputed");
        Dispute storage d = disputes[_jobId];
        require(!d.resolved, "Already resolved");
        require(block.timestamp >= d.disputedAt + 48 hours, "Voting window still open");

        d.resolved = true;

        uint256 validatorFee = j.reward / 100; // 1% validator fee
        uint256 rewardAfterVoterFee = j.reward - validatorFee;

        // Distribute voter fees to the voters
        uint256 voterCount = disputeVoters[_jobId].length;
        if (voterCount > 0 && validatorFee > 0) {
            uint256 share = validatorFee / voterCount;
            if (share > 0) {
                for (uint256 i = 0; i < voterCount; i++) {
                    uint256 voterAgentId = disputeVoters[_jobId][i];
                    address voterOwner = identityRegistry.ownerOf(voterAgentId);
                    IERC20(j.paymentToken).transfer(voterOwner, share);
                }
            }
        }

        // Tally results
        if (d.approveWeight > d.rejectWeight) {
            // Agent wins
            j.status = JobStatus.Completed;

            Agent storage a = agents[j.assignedAgent];
            a.completedJobs++;
            a.totalScore += 5; // Default 5 rating for successful dispute defense

            // Calculate protocol fee from the remaining reward
            uint256 protocolFee = (rewardAfterVoterFee * PROTOCOL_FEE_BPS) / 10000;
            uint256 finalPayout = rewardAfterVoterFee - protocolFee;
            protocolTokenFees[j.paymentToken] += protocolFee;
            if (j.paymentToken == address(usdc)) {
                protocolFees += protocolFee;
            }

            address agentOwner = identityRegistry.ownerOf(j.assignedAgent);
            address preferredToken = agentPayoutToken[j.assignedAgent];
            if (preferredToken == address(0)) {
                preferredToken = j.paymentToken;
            }

            uint256 finalPayoutAmount = finalPayout;
            if (preferredToken != j.paymentToken) {
                uint256 minAmountOut = (finalPayout * 95) / 100;
                finalPayoutAmount = _swapTokens(j.paymentToken, preferredToken, finalPayout, minAmountOut);
            }

            require(IERC20(preferredToken).transfer(agentOwner, finalPayoutAmount), "Payout failed");

            // Feedback (reputation increase)
            bytes32 refHash = keccak256(abi.encodePacked("dispute_won", _jobId));
            try reputationRegistry.giveFeedback(
                j.assignedAgent,
                100, // max reputation score
                0,
                "dispute_won",
                "Dispute resolved in favor of agent",
                "",
                "",
                refHash
            ) {} catch {}

            emit DisputeResolved(_jobId, true, d.approveWeight, d.rejectWeight);
            emit PaymentReleased(_jobId, j.assignedAgent, finalPayoutAmount);

        } else {
            // Poster wins (or tie)
            j.status = JobStatus.Failed;

            Agent storage a = agents[j.assignedAgent];
            uint256 slashAmount = (a.stakedAmount * SLASH_PERCENTAGE) / 100;
            if (slashAmount > 0) {
                a.stakedAmount -= slashAmount;
                protocolTokenFees[address(usdc)] += slashAmount;
                protocolFees += slashAmount;
                emit AgentSlashed(j.assignedAgent, slashAmount, "Dispute lost");
            }

            if (a.stakedAmount < MIN_STAKE) {
                a.isActive = false;
                emit AgentDeactivated(j.assignedAgent);
            }

            a.failedJobs++;

            // Refund poster remaining reward
            require(IERC20(j.paymentToken).transfer(j.poster, rewardAfterVoterFee), "Refund failed");

            // Feedback (reputation slash)
            bytes32 refHash = keccak256(abi.encodePacked("dispute_lost", _jobId));
            try reputationRegistry.giveFeedback(
                j.assignedAgent,
                -75,
                0,
                "dispute_lost",
                "Dispute resolved in favor of poster",
                "",
                "",
                refHash
            ) {} catch {}

            emit DisputeResolved(_jobId, false, d.approveWeight, d.rejectWeight);
        }
    }

    function isEligibleValidator(uint256 _agentId) public view returns (bool) {
        Agent storage a = agents[_agentId];
        if (!a.isActive) return false;
        if (a.completedJobs <= 10) return false;
        if (a.totalScore <= a.completedJobs * 4) return false;
        return true;
    }

    function getDispute(uint256 _jobId) external view returns (
        uint256 disputedAt,
        uint256 approveWeight,
        uint256 rejectWeight,
        bool resolved,
        uint256 failedTime,
        uint256 voterCount
    ) {
        Dispute storage d = disputes[_jobId];
        return (d.disputedAt, d.approveWeight, d.rejectWeight, d.resolved, jobs[_jobId].failedAt, disputeVoters[_jobId].length);
    }

    function cancelJob(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        require(j.poster == msg.sender, "Only poster can cancel");
        require(j.status == JobStatus.Open, "Can only cancel open jobs");

        j.status = JobStatus.Cancelled;
        require(IERC20(j.paymentToken).transfer(j.poster, j.reward), "Refund failed");

        emit JobCancelled(_jobId);
    }

    // ══════════════════════════════════════════════════════
    // View Functions
    // ══════════════════════════════════════════════════════

    function getJob(uint256 _jobId) external view returns (
        address poster, string memory description, string memory requiredCapabilities,
        uint256 reward, uint256 deadline, uint256 assignedAgent,
        JobStatus status, string memory resultHash, uint8 rating, uint256 createdAt,
        address paymentToken, uint256 failedAt
    ) {
        Job storage j = jobs[_jobId];
        return (j.poster, j.description, j.requiredCapabilities, j.reward, j.deadline,
                j.assignedAgent, j.status, j.resultHash, j.rating, j.createdAt, j.paymentToken, j.failedAt);
    }

    function getAgent(uint256 _agentId) external view returns (
        address agentOwner, string memory name, string memory capabilities,
        uint256 stakedAmount, uint256 completedJobs, uint256 totalScore,
        uint256 failedJobs, bool isActive, uint256 registeredAt
    ) {
        Agent storage a = agents[_agentId];
        address resolvedOwner = address(0);
        try identityRegistry.ownerOf(_agentId) returns (address o) {
            resolvedOwner = o;
        } catch {}
        return (resolvedOwner, "", "", a.stakedAmount, a.completedJobs,
                a.totalScore, a.failedJobs, a.isActive, a.registeredAt);
    }

    // ── Internal StableFX swap routing helper ──
    function _swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        if (stableFX == address(0)) {
            return amountIn; // Fallback
        }
        IERC20(tokenIn).approve(stableFX, amountIn);
        try IStableFX(stableFX).swap(tokenIn, tokenOut, amountIn, minAmountOut) returns (uint256 amountOut) {
            return amountOut;
        } catch {
            return amountIn; // Fallback to source token if swap precompile errors/fails
        }
    }

    // ── Owner Functions ──

    function withdrawFees() external {
        require(msg.sender == owner, "Only owner");
        uint256 amount = protocolFees;
        protocolFees = 0;
        protocolTokenFees[address(usdc)] = 0;
        require(usdc.transfer(owner, amount), "Withdraw failed");
    }

    function withdrawTokenFees(address _token) external {
        require(msg.sender == owner, "Only owner");
        uint256 amount = protocolTokenFees[_token];
        protocolTokenFees[_token] = 0;
        if (_token == address(usdc)) {
            protocolFees = 0;
        }
        require(IERC20(_token).transfer(owner, amount), "Withdraw failed");
    }
}
