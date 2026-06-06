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

interface IMockYieldPool {
    function deposit(address token, uint256 amount) external returns (bool);
    function withdraw(address token, uint256 amount, address receiver) external returns (bool);
    function getExchangeRate(address token) external view returns (uint256);
}

interface IZKVerifier {
    function verifyCapability(
        uint256 agentId,
        string calldata capabilities,
        bytes calldata signature
    ) external view returns (bool);

    function verifyExecution(
        uint256 jobId,
        string calldata resultHash,
        bytes calldata proof
    ) external view returns (bool);
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
    address public yieldPool;
    address public verifier;
    uint256 public cumulativeYield; // Total accumulated yield in USDC equivalent (6 decimals)
    uint256 public yieldTVL; // Current TVL in USDC equivalent (6 decimals)

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
    enum AuctionType { Fixed, Bid, Dutch }

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
        uint256 exchangeRateAtDeposit;
        uint256 agentExchangeRateAtPickup;
        bool depositedInPool;
        bool stakeDepositedInPool;
        AuctionType auctionType;
        uint256 startPrice;
        uint256 floorPrice;
        uint256 decayPeriod;
        uint256 parentJobId;
        bool hasParent;
    }

    struct Bid {
        uint256 agentId;
        uint256 price;
        address bidder;
        bool refunded;
    }

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Bid[]) public jobBids;
    mapping(uint256 => uint256) public lowestBidIndex;
    mapping(uint256 => uint256[]) public subJobIds;
    uint256 public nextJobId;

    // ── Recurring Schedules (Phase 13) ──
    struct Schedule {
        uint256 id;
        address poster;
        string description;
        string requiredCapabilities;
        uint256 reward;
        uint256 interval;
        uint256 nextExecution;
        uint256 fundedBalance;
        uint256 maxExecutions;
        uint256 executionsCount;
        address paymentToken;
        bool active;
    }

    mapping(uint256 => Schedule) public schedules;
    uint256 public nextScheduleId;

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
    uint256 public PROTOCOL_FEE_BPS = 250; // 2.5% (made mutable by DAO)
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
    event YieldDistributed(uint256 indexed jobId, uint256 agentShare, uint256 posterShare, uint256 protocolShare);
    event YieldPoolAlert(string message);
    event BidSubmitted(uint256 indexed jobId, uint256 indexed agentId, uint256 price, address indexed bidder);
    event BidAccepted(uint256 indexed jobId, uint256 indexed agentId, uint256 price);
    event SubJobPosted(uint256 indexed parentJobId, uint256 indexed childJobId, uint256 reward);

    event ScheduleRegistered(uint256 indexed scheduleId, address indexed poster, uint256 interval, uint256 reward, uint256 totalBudget);
    event ScheduleExecuted(uint256 indexed scheduleId, uint256 indexed jobId, uint256 executionIndex, uint256 keeperReward);
    event ScheduleCancelled(uint256 indexed scheduleId, uint256 refundedBalance);
    event ScheduleReplenished(uint256 indexed scheduleId, uint256 amount);
    event ScheduleWithdrawn(uint256 indexed scheduleId, uint256 amount);

    // ══════════════════════════════════════════════════════
    // Constructor
    // ══════════════════════════════════════════════════════

    address public revenueDistributor;

    constructor(
        address _usdc,
        address _eurc,
        address _identityRegistry,
        address _reputationRegistry,
        address _stableFX,
        address _yieldPool,
        address _verifier,
        address _revenueDistributor
    ) {
        usdc = IERC20(_usdc);
        eurc = IERC20(_eurc);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        stableFX = _stableFX;
        yieldPool = _yieldPool;
        verifier = _verifier;
        revenueDistributor = _revenueDistributor;
        owner = msg.sender;
    }

    // ── Setter for Verifier address ──
    function setVerifier(address _verifier) external {
        require(msg.sender == owner, "Only owner");
        verifier = _verifier;
    }

    // ── Setter for StableFX address ──
    function setStableFX(address _stableFX) external {
        require(msg.sender == owner, "Only owner");
        stableFX = _stableFX;
    }

    // ── Setter for YieldPool address ──
    function setYieldPool(address _yieldPool) external {
        require(msg.sender == owner, "Only owner");
        yieldPool = _yieldPool;
    }

    // ── Helper conversion to USDC ──
    function _convertToUSDC(uint256 amount) internal pure returns (uint256) {
        return (amount * 108) / 100;
    }

    // ── Helper withdrawal from YieldPool ──
    function _withdrawFromPool(address token, uint256 amount) internal returns (bool) {
        if (yieldPool == address(0)) {
            return false;
        }
        try IMockYieldPool(yieldPool).withdraw(token, amount, address(this)) returns (bool success) {
            return success;
        } catch {
            emit YieldPoolAlert("Withdrawal failed from yield pool, using contract cash");
            return false;
        }
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

        // Try depositing to YieldPool
        if (yieldPool != address(0)) {
            usdc.approve(yieldPool, _amount);
            try IMockYieldPool(yieldPool).deposit(address(usdc), _amount) returns (bool success) {
                if (success) {
                    yieldTVL += _amount;
                }
            } catch {}
        }

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

        uint256 rate = 0;
        bool deposited = false;

        // Try depositing to YieldPool
        if (yieldPool != address(0)) {
            IERC20(_paymentToken).approve(yieldPool, _reward);
            try IMockYieldPool(yieldPool).deposit(_paymentToken, _reward) returns (bool success) {
                if (success) {
                    rate = IMockYieldPool(yieldPool).getExchangeRate(_paymentToken);
                    deposited = true;
                    uint256 usdcEquivalent = _paymentToken == address(usdc) ? _reward : _convertToUSDC(_reward);
                    yieldTVL += usdcEquivalent;
                }
            } catch {}
        }

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
            failedAt: 0,
            exchangeRateAtDeposit: rate,
            agentExchangeRateAtPickup: 0,
            depositedInPool: deposited,
            stakeDepositedInPool: false,
            auctionType: AuctionType.Fixed,
            startPrice: _reward,
            floorPrice: _reward,
            decayPeriod: 0,
            parentJobId: 0,
            hasParent: false
        });

        emit JobPosted(id, msg.sender, _reward, _requiredCapabilities, _deadline);
        return id;
    }

    function postJobAuction(
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _deadline,
        address _paymentToken,
        AuctionType _auctionType,
        uint256 _startPrice,
        uint256 _floorPrice,
        uint256 _decayPeriod
    ) external returns (uint256) {
        require(_paymentToken == address(usdc) || _paymentToken == address(eurc), "Unsupported payment token");
        require(_deadline > block.timestamp, "Deadline must be future");

        uint256 rewardAmount = _startPrice;
        if (_auctionType == AuctionType.Fixed) {
            require(_startPrice > 0, "Reward must be > 0");
        } else if (_auctionType == AuctionType.Dutch) {
            require(_startPrice >= _floorPrice, "Start must be >= Floor");
            require(_decayPeriod > 0, "Decay period must be > 0");
        } else if (_auctionType == AuctionType.Bid) {
            require(_startPrice > 0, "Max reward cap must be > 0");
        }

        require(IERC20(_paymentToken).transferFrom(msg.sender, address(this), rewardAmount), "Escrow lock failed");

        uint256 rate = 0;
        bool deposited = false;

        // Try depositing to YieldPool
        if (yieldPool != address(0)) {
            IERC20(_paymentToken).approve(yieldPool, rewardAmount);
            try IMockYieldPool(yieldPool).deposit(_paymentToken, rewardAmount) returns (bool success) {
                if (success) {
                    rate = IMockYieldPool(yieldPool).getExchangeRate(_paymentToken);
                    deposited = true;
                    uint256 usdcEquivalent = _paymentToken == address(usdc) ? rewardAmount : _convertToUSDC(rewardAmount);
                    yieldTVL += usdcEquivalent;
                }
            } catch {}
        }

        uint256 id = nextJobId++;
        jobs[id] = Job({
            poster: msg.sender,
            description: _description,
            requiredCapabilities: _requiredCapabilities,
            reward: rewardAmount,
            deadline: _deadline,
            assignedAgent: 0,
            status: JobStatus.Open,
            resultHash: "",
            rating: 0,
            createdAt: block.timestamp,
            paymentToken: _paymentToken,
            failedAt: 0,
            exchangeRateAtDeposit: rate,
            agentExchangeRateAtPickup: 0,
            depositedInPool: deposited,
            stakeDepositedInPool: false,
            auctionType: _auctionType,
            startPrice: _startPrice,
            floorPrice: _floorPrice,
            decayPeriod: _decayPeriod,
            parentJobId: 0,
            hasParent: false
        });

        emit JobPosted(id, msg.sender, rewardAmount, _requiredCapabilities, _deadline);
        return id;
    }

    function postSubJob(
        uint256 _parentJobId,
        string calldata _desc,
        uint256 _reward,
        uint256 _deadline
    ) external returns (uint256) {
        Job storage parentJob = jobs[_parentJobId];
        require(parentJob.status == JobStatus.InProgress, "Parent job not in progress");
        // Verify Caller is the assigned agent owner of the parent job
        require(identityRegistry.ownerOf(parentJob.assignedAgent) == msg.sender, "Not assigned agent owner");
        
        // Ensure reward can be locked from parent reward
        require(_reward <= parentJob.reward, "Sub-job reward exceeds parent");
        
        // Prevent recursive stack overflows: depth limit 3
        uint256 currentParentId = _parentJobId;
        bool currentHasParent = parentJob.hasParent;
        uint256 depth = 1;
        while (currentHasParent) {
            depth++;
            require(depth <= 3, "Max delegation depth exceeded");
            Job storage p = jobs[currentParentId];
            currentParentId = p.parentJobId;
            currentHasParent = p.hasParent;
        }
        
        // Deduct from parent reward
        parentJob.reward -= _reward;
        
        // Setup child job
        uint256 id = nextJobId++;
        Job storage j = jobs[id];
        j.poster = msg.sender; // Parent agent owner is the poster
        j.description = _desc;
        j.reward = _reward;
        j.deadline = _deadline;
        j.status = JobStatus.Open;
        j.createdAt = block.timestamp;
        j.paymentToken = parentJob.paymentToken;
        j.parentJobId = _parentJobId;
        j.hasParent = true;
        j.depositedInPool = parentJob.depositedInPool;
        
        // If parent was deposited in YieldPool, update child rate
        if (j.depositedInPool && yieldPool != address(0)) {
            j.exchangeRateAtDeposit = IMockYieldPool(yieldPool).getExchangeRate(j.paymentToken);
        }
        
        subJobIds[_parentJobId].push(id);
        
        emit JobPosted(id, msg.sender, _reward, "", _deadline);
        emit SubJobPosted(_parentJobId, id, _reward);
        return id;
    }

    function getSubJobIds(uint256 _jobId) external view returns (uint256[] memory) {
        return subJobIds[_jobId];
    }

    function getCurrentReward(uint256 _jobId) public view returns (uint256) {
        Job storage j = jobs[_jobId];
        if (j.auctionType == AuctionType.Fixed || j.auctionType == AuctionType.Bid) {
            return j.reward;
        }

        // Dutch Auction
        if (block.timestamp <= j.createdAt) {
            return j.startPrice;
        }

        uint256 elapsed = block.timestamp - j.createdAt;
        if (elapsed >= j.decayPeriod) {
            return j.floorPrice;
        }

        uint256 totalDrop = j.startPrice - j.floorPrice;
        uint256 currentDrop = (totalDrop * elapsed) / j.decayPeriod;
        return j.startPrice - currentDrop;
    }

    function submitBid(uint256 _jobId, uint256 _agentId, uint256 _price) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.Open, "Job not open");
        require(j.auctionType == AuctionType.Bid, "Job not bid-based");
        require(identityRegistry.ownerOf(_agentId) == msg.sender, "Not agent owner");
        require(agents[_agentId].isActive, "Agent not active");
        require(_price > 0, "Price must be > 0");

        // Require USDC transfer of 1e6 (1 USDC) as spam protection
        require(usdc.transferFrom(msg.sender, address(this), 1e6), "USDC bid deposit failed");

        uint256 len = jobBids[_jobId].length;
        if (len > 0) {
            uint256 leadingIdx = lowestBidIndex[_jobId];
            Bid storage leadingBid = jobBids[_jobId][leadingIdx];
            require(_price < leadingBid.price, "Must bid lower reward");

            // Refund the previous leading bidder
            if (!leadingBid.refunded) {
                leadingBid.refunded = true;
                require(usdc.transfer(leadingBid.bidder, 1e6), "Refund failed");
            }
            lowestBidIndex[_jobId] = len;
        } else {
            require(_price < j.reward, "Price must be below max cap");
            lowestBidIndex[_jobId] = 0;
        }

        jobBids[_jobId].push(Bid({
            agentId: _agentId,
            price: _price,
            bidder: msg.sender,
            refunded: false
        }));

        emit BidSubmitted(_jobId, _agentId, _price, msg.sender);
    }

    function acceptBid(uint256 _jobId, uint256 _bidIndex) external {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.Open, "Job not open");
        require(j.poster == msg.sender, "Only poster can accept bid");
        require(_bidIndex < jobBids[_jobId].length, "Invalid bid index");
        require(_bidIndex == lowestBidIndex[_jobId], "Can only accept leading bid");

        Bid storage b = jobBids[_jobId][_bidIndex];
        require(!b.refunded, "Bid already refunded");

        b.refunded = true;

        uint256 excess = j.reward - b.price;
        j.reward = b.price;
        j.status = JobStatus.InProgress;
        j.assignedAgent = b.agentId;

        // Record agent exchange rate at pickup time
        if (yieldPool != address(0)) {
            j.agentExchangeRateAtPickup = IMockYieldPool(yieldPool).getExchangeRate(address(usdc));
            j.stakeDepositedInPool = true;
        }

        // Refund the winner's bid deposit
        require(usdc.transfer(b.bidder, 1e6), "Winner deposit refund failed");

        if (excess > 0) {
            // Withdraw excess from YieldPool if deposited
            if (j.depositedInPool && yieldPool != address(0)) {
                IMockYieldPool(yieldPool).withdraw(j.paymentToken, excess, address(this));
                uint256 usdcEquivalent = j.paymentToken == address(usdc) ? excess : _convertToUSDC(excess);
                if (yieldTVL >= usdcEquivalent) {
                    yieldTVL -= usdcEquivalent;
                }
            }
            // Refund the excess to the poster
            require(IERC20(j.paymentToken).transfer(j.poster, excess), "Poster excess refund failed");
        }

        emit BidAccepted(_jobId, b.agentId, b.price);
        emit JobPickedUp(_jobId, b.agentId);
    }

    function pickupJob(uint256 _jobId, uint256 _agentId, bytes calldata _capabilityProof) external {
        Job storage j = jobs[_jobId];
        Agent storage a = agents[_agentId];

        require(j.status == JobStatus.Open, "Job not open");
        require(j.auctionType != AuctionType.Bid, "Use acceptBid for bidding jobs");
        require(identityRegistry.ownerOf(_agentId) == msg.sender, "Not agent owner");
        require(a.isActive, "Agent not active");
        require(a.stakedAmount >= MIN_STAKE, "Insufficient stake");
        require(block.timestamp < j.deadline, "Job expired");

        // Verify capability attestation if verifier is set and job has required capabilities
        if (verifier != address(0) && bytes(j.requiredCapabilities).length > 0) {
            require(
                IZKVerifier(verifier).verifyCapability(_agentId, j.requiredCapabilities, _capabilityProof),
                "Invalid capability attestation signature"
            );
        }

        j.status = JobStatus.InProgress;
        j.assignedAgent = _agentId;

        // Dynamic pricing adjustment for Dutch Auctions
        if (j.auctionType == AuctionType.Dutch) {
            uint256 currentReward = getCurrentReward(_jobId);
            require(currentReward >= j.floorPrice, "Claim reward below floor");

            uint256 excess = j.reward - currentReward;
            j.reward = currentReward;

            if (excess > 0) {
                // If deposited in YieldPool, withdraw the excess first
                if (j.depositedInPool && yieldPool != address(0)) {
                    IMockYieldPool(yieldPool).withdraw(j.paymentToken, excess, address(this));
                    uint256 usdcEquivalent = j.paymentToken == address(usdc) ? excess : _convertToUSDC(excess);
                    if (yieldTVL >= usdcEquivalent) {
                        yieldTVL -= usdcEquivalent;
                    }
                }
                // Return the excess to the poster
                require(IERC20(j.paymentToken).transfer(j.poster, excess), "Excess refund failed");
            }
        }

        // Record agent exchange rate at pickup time
        if (yieldPool != address(0)) {
            j.agentExchangeRateAtPickup = IMockYieldPool(yieldPool).getExchangeRate(address(usdc));
            j.stakeDepositedInPool = true;
        }

        emit JobPickedUp(_jobId, _agentId);
    }

    function submitResult(uint256 _jobId, string calldata _resultHash, bytes calldata _proof) public {
        Job storage j = jobs[_jobId];
        require(j.status == JobStatus.InProgress, "Job not in progress");
        require(identityRegistry.ownerOf(j.assignedAgent) == msg.sender, "Not assigned agent");

        // Verify cryptographic execution proof if verifier is set
        if (verifier != address(0)) {
            require(
                IZKVerifier(verifier).verifyExecution(_jobId, _resultHash, _proof),
                "Invalid ZK/Execution proof"
            );
        }

        j.status = JobStatus.Submitted;
        j.resultHash = _resultHash;

        emit ResultSubmitted(_jobId, j.assignedAgent, _resultHash);
    }

    function submitResultWithProof(uint256 _jobId, string calldata _resultHash, bytes calldata _proof) external {
        submitResult(_jobId, _resultHash, _proof);
    }

    function approveAndRelease(uint256 _jobId, uint8 _rating) external {
        Job storage j = jobs[_jobId];
        require(j.poster == msg.sender, "Only poster can approve");
        require(j.status == JobStatus.Submitted, "Result not submitted");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");

        // Verify all child jobs are completed
        uint256[] storage children = subJobIds[_jobId];
        for (uint256 i = 0; i < children.length; i++) {
            require(jobs[children[i]].status == JobStatus.Completed, "Child jobs not completed");
        }

        Agent storage a = agents[j.assignedAgent];

        uint256 rewardYield = 0;
        uint256 stakeYield = 0;

        if (yieldPool != address(0)) {
            uint256 currentRate = IMockYieldPool(yieldPool).getExchangeRate(j.paymentToken);
            if (j.depositedInPool && j.exchangeRateAtDeposit > 0 && currentRate > j.exchangeRateAtDeposit) {
                rewardYield = (j.reward * (currentRate - j.exchangeRateAtDeposit)) / j.exchangeRateAtDeposit;
            }
            if (j.stakeDepositedInPool && j.agentExchangeRateAtPickup > 0) {
                uint256 currentUsdcRate = IMockYieldPool(yieldPool).getExchangeRate(address(usdc));
                if (currentUsdcRate > j.agentExchangeRateAtPickup) {
                    stakeYield = (MIN_STAKE * (currentUsdcRate - j.agentExchangeRateAtPickup)) / j.agentExchangeRateAtPickup;
                }
            }
        }

        // Split rewardYield: 50% Agent, 30% Poster, 20% Protocol
        uint256 agentRewardShare = (rewardYield * 50) / 100;
        uint256 posterRewardShare = (rewardYield * 30) / 100;
        uint256 protocolRewardShare = rewardYield - agentRewardShare - posterRewardShare;

        // Split stakeYield: 50% Agent, 30% Poster, 20% Protocol
        uint256 agentStakeShare = (stakeYield * 50) / 100;
        uint256 posterStakeShare = (stakeYield * 30) / 100;
        uint256 protocolStakeShare = stakeYield - agentStakeShare - posterStakeShare;

        // Withdraw reward + rewardYield from pool
        if (j.depositedInPool) {
            uint256 withdrawAmount = j.reward + rewardYield;
            bool withdrawn = _withdrawFromPool(j.paymentToken, withdrawAmount);
            if (withdrawn) {
                uint256 usdcEquivalent = j.paymentToken == address(usdc) ? withdrawAmount : _convertToUSDC(withdrawAmount);
                if (yieldTVL >= usdcEquivalent) {
                    yieldTVL -= usdcEquivalent;
                } else {
                    yieldTVL = 0;
                }
                cumulativeYield += j.paymentToken == address(usdc) ? rewardYield : _convertToUSDC(rewardYield);
            }
        }

        // Withdraw stakeYield from pool
        if (j.stakeDepositedInPool && stakeYield > 0) {
            bool withdrawn = _withdrawFromPool(address(usdc), stakeYield);
            if (withdrawn) {
                cumulativeYield += stakeYield;
            }
        }

        // 1. Calculate fee in the source token
        uint256 fee = (j.reward * PROTOCOL_FEE_BPS) / 10000;
        uint256 payoutInSource = j.reward - fee + agentRewardShare;
        protocolTokenFees[j.paymentToken] += (fee + protocolRewardShare);
        if (j.paymentToken == address(usdc)) {
            protocolFees += (fee + protocolRewardShare);
        }

        // Add protocol stake yield share
        protocolTokenFees[address(usdc)] += protocolStakeShare;
        if (address(usdc) == address(usdc)) {
            protocolFees += protocolStakeShare;
        }

        // Refund poster's share of yield
        if (posterRewardShare > 0) {
            require(IERC20(j.paymentToken).transfer(j.poster, posterRewardShare), "Poster reward interest failed");
        }
        if (posterStakeShare > 0) {
            require(usdc.transfer(j.poster, posterStakeShare), "Poster stake interest failed");
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

        if (agentStakeShare > 0) {
            require(usdc.transfer(agentOwner, agentStakeShare), "Agent stake interest failed");
        }

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
        emit YieldDistributed(_jobId, agentRewardShare + agentStakeShare, posterRewardShare + posterStakeShare, protocolRewardShare + protocolStakeShare);
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

        uint256 rewardYield = 0;
        if (yieldPool != address(0) && j.depositedInPool && j.exchangeRateAtDeposit > 0) {
            uint256 currentRate = IMockYieldPool(yieldPool).getExchangeRate(j.paymentToken);
            if (currentRate > j.exchangeRateAtDeposit) {
                rewardYield = (j.reward * (currentRate - j.exchangeRateAtDeposit)) / j.exchangeRateAtDeposit;
            }
        }

        // Withdraw reward + rewardYield from pool
        if (j.depositedInPool) {
            uint256 withdrawAmount = j.reward + rewardYield;
            bool withdrawn = _withdrawFromPool(j.paymentToken, withdrawAmount);
            if (withdrawn) {
                uint256 usdcEquivalent = j.paymentToken == address(usdc) ? withdrawAmount : _convertToUSDC(withdrawAmount);
                if (yieldTVL >= usdcEquivalent) {
                    yieldTVL -= usdcEquivalent;
                } else {
                    yieldTVL = 0;
                }
                cumulativeYield += j.paymentToken == address(usdc) ? rewardYield : _convertToUSDC(rewardYield);
            }
        }

        // Poster gets principal + 80% of yield, 20% to protocol
        uint256 posterShare = (rewardYield * 80) / 100;
        uint256 protocolShare = rewardYield - posterShare;

        protocolTokenFees[j.paymentToken] += protocolShare;
        if (j.paymentToken == address(usdc)) {
            protocolFees += protocolShare;
        }

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

        // Refund poster or return to parent reward pool
        if (j.hasParent) {
            Job storage parentJob = jobs[j.parentJobId];
            parentJob.reward += j.reward;
            if (posterShare > 0) {
                require(IERC20(j.paymentToken).transfer(j.poster, posterShare), "Refund failed");
            }
        } else {
            require(IERC20(j.paymentToken).transfer(j.poster, j.reward + posterShare), "Refund failed");
        }

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
        emit YieldDistributed(_jobId, 0, posterShare, protocolShare);
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

        uint256 rewardYield = 0;
        uint256 stakeYield = 0;

        if (yieldPool != address(0)) {
            uint256 currentRate = IMockYieldPool(yieldPool).getExchangeRate(j.paymentToken);
            if (j.depositedInPool && j.exchangeRateAtDeposit > 0 && currentRate > j.exchangeRateAtDeposit) {
                rewardYield = (j.reward * (currentRate - j.exchangeRateAtDeposit)) / j.exchangeRateAtDeposit;
            }
            if (j.stakeDepositedInPool && j.agentExchangeRateAtPickup > 0) {
                uint256 currentUsdcRate = IMockYieldPool(yieldPool).getExchangeRate(address(usdc));
                if (currentUsdcRate > j.agentExchangeRateAtPickup) {
                    stakeYield = (MIN_STAKE * (currentUsdcRate - j.agentExchangeRateAtPickup)) / j.agentExchangeRateAtPickup;
                }
            }
        }

        // Withdraw reward + rewardYield from pool
        if (j.depositedInPool) {
            uint256 withdrawAmount = j.reward + rewardYield;
            bool withdrawn = _withdrawFromPool(j.paymentToken, withdrawAmount);
            if (withdrawn) {
                uint256 usdcEquivalent = j.paymentToken == address(usdc) ? withdrawAmount : _convertToUSDC(withdrawAmount);
                if (yieldTVL >= usdcEquivalent) {
                    yieldTVL -= usdcEquivalent;
                } else {
                    yieldTVL = 0;
                }
                cumulativeYield += j.paymentToken == address(usdc) ? rewardYield : _convertToUSDC(rewardYield);
            }
        }

        // Withdraw stakeYield from pool
        if (j.stakeDepositedInPool && stakeYield > 0) {
            bool withdrawn = _withdrawFromPool(address(usdc), stakeYield);
            if (withdrawn) {
                cumulativeYield += stakeYield;
            }
        }

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

            // Split rewardYield: 50% Agent, 30% Poster, 20% Protocol
            uint256 agentRewardShare = (rewardYield * 50) / 100;
            uint256 posterRewardShare = (rewardYield * 30) / 100;
            uint256 protocolRewardShare = rewardYield - agentRewardShare - posterRewardShare;

            // Split stakeYield: 50% Agent, 30% Poster, 20% Protocol
            uint256 agentStakeShare = (stakeYield * 50) / 100;
            uint256 posterStakeShare = (stakeYield * 30) / 100;
            uint256 protocolStakeShare = stakeYield - agentStakeShare - posterStakeShare;

            // Calculate protocol fee from the remaining reward
            uint256 protocolFee = (rewardAfterVoterFee * PROTOCOL_FEE_BPS) / 10000;
            uint256 finalPayout = rewardAfterVoterFee - protocolFee + agentRewardShare;
            protocolTokenFees[j.paymentToken] += (protocolFee + protocolRewardShare);
            if (j.paymentToken == address(usdc)) {
                protocolFees += (protocolFee + protocolRewardShare);
            }

            protocolTokenFees[address(usdc)] += protocolStakeShare;
            if (address(usdc) == address(usdc)) {
                protocolFees += protocolStakeShare;
            }

            if (posterRewardShare > 0) {
                require(IERC20(j.paymentToken).transfer(j.poster, posterRewardShare), "Poster interest refund failed");
            }
            if (posterStakeShare > 0) {
                require(usdc.transfer(j.poster, posterStakeShare), "Poster stake interest failed");
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

            if (agentStakeShare > 0) {
                require(usdc.transfer(agentOwner, agentStakeShare), "Agent stake interest failed");
            }

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
            emit YieldDistributed(_jobId, agentRewardShare + agentStakeShare, posterRewardShare + posterStakeShare, protocolRewardShare + protocolStakeShare);

        } else {
            // Poster wins (or tie)
            j.status = JobStatus.Failed;

            // Split rewardYield: 80% Poster, 20% Protocol, 0% Agent
            uint256 posterShare = (rewardYield * 80) / 100;
            uint256 protocolShare = rewardYield - posterShare;

            protocolTokenFees[j.paymentToken] += protocolShare;
            if (j.paymentToken == address(usdc)) {
                protocolFees += protocolShare;
            }

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

            // Refund poster remaining reward + poster's share of yield
            require(IERC20(j.paymentToken).transfer(j.poster, rewardAfterVoterFee + posterShare), "Refund failed");

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
            emit YieldDistributed(_jobId, 0, posterShare, protocolShare);
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

        uint256 rewardYield = 0;
        if (yieldPool != address(0) && j.depositedInPool && j.exchangeRateAtDeposit > 0) {
            uint256 currentRate = IMockYieldPool(yieldPool).getExchangeRate(j.paymentToken);
            if (currentRate > j.exchangeRateAtDeposit) {
                rewardYield = (j.reward * (currentRate - j.exchangeRateAtDeposit)) / j.exchangeRateAtDeposit;
            }
        }

        // Withdraw reward + rewardYield from pool
        if (j.depositedInPool) {
            uint256 withdrawAmount = j.reward + rewardYield;
            bool withdrawn = _withdrawFromPool(j.paymentToken, withdrawAmount);
            if (withdrawn) {
                uint256 usdcEquivalent = j.paymentToken == address(usdc) ? withdrawAmount : _convertToUSDC(withdrawAmount);
                if (yieldTVL >= usdcEquivalent) {
                    yieldTVL -= usdcEquivalent;
                } else {
                    yieldTVL = 0;
                }
                cumulativeYield += j.paymentToken == address(usdc) ? rewardYield : _convertToUSDC(rewardYield);
            }
        }

        // Poster gets principal + 80% of yield, 20% to protocol
        uint256 posterShare = (rewardYield * 80) / 100;
        uint256 protocolShare = rewardYield - posterShare;

        protocolTokenFees[j.paymentToken] += protocolShare;
        if (j.paymentToken == address(usdc)) {
            protocolFees += protocolShare;
        }

        // Refund poster or return to parent reward pool
        if (j.hasParent) {
            Job storage parentJob = jobs[j.parentJobId];
            parentJob.reward += j.reward;
            if (posterShare > 0) {
                require(IERC20(j.paymentToken).transfer(j.poster, posterShare), "Refund failed");
            }
        } else {
            require(IERC20(j.paymentToken).transfer(j.poster, j.reward + posterShare), "Refund failed");
        }

        emit JobCancelled(_jobId);
        emit YieldDistributed(_jobId, 0, posterShare, protocolShare);
    }

    // ══════════════════════════════════════════════════════
    // View Functions
    // ══════════════════════════════════════════════════════

    function getJob(uint256 _jobId) external view returns (
        address poster, string memory description, string memory requiredCapabilities,
        uint256 reward, uint256 deadline, uint256 assignedAgent,
        JobStatus status, string memory resultHash, uint8 rating, uint256 createdAt,
        address paymentToken, uint256 failedAt,
        AuctionType auctionType, uint256 startPrice, uint256 floorPrice, uint256 decayPeriod,
        uint256 parentJobId, bool hasParent
    ) {
        Job storage j = jobs[_jobId];
        return (j.poster, j.description, j.requiredCapabilities, j.reward, j.deadline,
                j.assignedAgent, j.status, j.resultHash, j.rating, j.createdAt, j.paymentToken, j.failedAt,
                j.auctionType, j.startPrice, j.floorPrice, j.decayPeriod,
                j.parentJobId, j.hasParent);
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

    function getJobYield(uint256 _jobId) external view returns (
        uint256 exchangeRateAtDeposit,
        uint256 agentExchangeRateAtPickup,
        bool depositedInPool,
        bool stakeDepositedInPool,
        uint256 rewardYield,
        uint256 stakeYield
    ) {
        Job storage j = jobs[_jobId];
        uint256 rYield = 0;
        uint256 sYield = 0;
        if (yieldPool != address(0)) {
            uint256 currentRate = IMockYieldPool(yieldPool).getExchangeRate(j.paymentToken);
            if (j.depositedInPool && j.exchangeRateAtDeposit > 0 && currentRate > j.exchangeRateAtDeposit) {
                rYield = (j.reward * (currentRate - j.exchangeRateAtDeposit)) / j.exchangeRateAtDeposit;
            }
            if (j.stakeDepositedInPool && j.agentExchangeRateAtPickup > 0) {
                uint256 currentUsdcRate = IMockYieldPool(yieldPool).getExchangeRate(address(usdc));
                if (currentUsdcRate > j.agentExchangeRateAtPickup) {
                    sYield = (MIN_STAKE * (currentUsdcRate - j.agentExchangeRateAtPickup)) / j.agentExchangeRateAtPickup;
                }
            }
        }
        return (j.exchangeRateAtDeposit, j.agentExchangeRateAtPickup, j.depositedInPool, j.stakeDepositedInPool, rYield, sYield);
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

    // ── Owner & DAO Functions ──

    function setRevenueDistributor(address _revenueDistributor) external {
        require(msg.sender == owner, "Only owner");
        revenueDistributor = _revenueDistributor;
    }

    function setProtocolFeeBps(uint256 _bps) external {
        require(msg.sender == revenueDistributor, "Only DAO distributor can call");
        require(_bps <= 1000, "Max fee limit 10%");
        PROTOCOL_FEE_BPS = _bps;
    }

    function withdrawFees() external {
        uint256 amount = protocolFees;
        protocolFees = 0;
        protocolTokenFees[address(usdc)] = 0;
        
        _withdrawFromPool(address(usdc), amount);

        require(usdc.transfer(revenueDistributor, amount), "Withdraw failed");
    }

    function withdrawTokenFees(address _token) external {
        uint256 amount = protocolTokenFees[_token];
        protocolTokenFees[_token] = 0;
        if (_token == address(usdc)) {
            protocolFees = 0;
        }

        _withdrawFromPool(_token, amount);

        require(IERC20(_token).transfer(revenueDistributor, amount), "Withdraw failed");
    }

    // ── Recurring Schedules Implementation (Phase 13) ──

    function registerSchedule(
        string calldata _desc,
        string calldata _requiredCapabilities,
        uint256 _interval,
        uint256 _reward,
        uint256 _maxExecutions,
        address _paymentToken
    ) external returns (uint256) {
        require(_interval > 0, "Interval must be > 0");
        require(_reward > 0, "Reward must be > 0");
        require(_maxExecutions > 0, "Max executions must be > 0");
        require(_paymentToken == address(usdc) || _paymentToken == address(eurc), "Invalid payment token");

        uint256 totalBudget = _reward * _maxExecutions;
        require(IERC20(_paymentToken).transferFrom(msg.sender, address(this), totalBudget), "Transfer failed");

        uint256 id = nextScheduleId++;
        schedules[id] = Schedule({
            id: id,
            poster: msg.sender,
            description: _desc,
            requiredCapabilities: _requiredCapabilities,
            reward: _reward,
            interval: _interval,
            nextExecution: block.timestamp, // Eligible immediately
            fundedBalance: totalBudget,
            maxExecutions: _maxExecutions,
            executionsCount: 0,
            paymentToken: _paymentToken,
            active: true
        });

        emit ScheduleRegistered(id, msg.sender, _interval, _reward, totalBudget);
        return id;
    }

    function executeScheduledJob(uint256 _scheduleId) external {
        Schedule storage s = schedules[_scheduleId];
        require(s.active, "Schedule not active");
        require(block.timestamp >= s.nextExecution, "Not execution time yet");
        require(s.fundedBalance >= s.reward, "Insufficient schedule balance");
        require(s.executionsCount < s.maxExecutions, "Max executions reached");

        uint256 keeperReward = (s.reward * 2) / 100; // 2% keeper incentive
        uint256 jobReward = s.reward - keeperReward;

        s.fundedBalance -= s.reward;
        s.executionsCount++;
        s.nextExecution = block.timestamp + s.interval;

        // If no budget left or max executions reached, deactivate
        if (s.executionsCount >= s.maxExecutions || s.fundedBalance < s.reward) {
            s.active = false;
        }

        // Spawn Job
        uint256 jobId = nextJobId++;
        uint256 rate = 0;
        bool deposited = false;

        if (yieldPool != address(0)) {
            try IERC20(s.paymentToken).approve(yieldPool, jobReward) {} catch {}
            try IMockYieldPool(yieldPool).deposit(s.paymentToken, jobReward) returns (bool success) {
                if (success) {
                    rate = IMockYieldPool(yieldPool).getExchangeRate(s.paymentToken);
                    deposited = true;
                    uint256 usdcEquivalent = s.paymentToken == address(usdc) ? jobReward : _convertToUSDC(jobReward);
                    yieldTVL += usdcEquivalent;
                }
            } catch {}
        }

        jobs[jobId] = Job({
            poster: s.poster,
            description: s.description,
            requiredCapabilities: s.requiredCapabilities,
            reward: jobReward,
            deadline: block.timestamp + 24 hours,
            assignedAgent: 0,
            status: JobStatus.Open,
            resultHash: "",
            rating: 0,
            createdAt: block.timestamp,
            paymentToken: s.paymentToken,
            failedAt: 0,
            exchangeRateAtDeposit: rate,
            agentExchangeRateAtPickup: 0,
            depositedInPool: deposited,
            stakeDepositedInPool: false,
            auctionType: AuctionType.Fixed,
            startPrice: jobReward,
            floorPrice: jobReward,
            decayPeriod: 0,
            parentJobId: 0,
            hasParent: false
        });

        emit JobPosted(jobId, s.poster, jobReward, s.requiredCapabilities, block.timestamp + 24 hours);
        emit ScheduleExecuted(_scheduleId, jobId, s.executionsCount, keeperReward);

        // Transfer incentive to Keeper
        require(IERC20(s.paymentToken).transfer(msg.sender, keeperReward), "Keeper transfer failed");
    }

    function cancelSchedule(uint256 _scheduleId) external {
        Schedule storage s = schedules[_scheduleId];
        require(s.poster == msg.sender, "Only poster can cancel");
        require(s.active, "Schedule not active");

        // Lock checks
        bool inExecutionWindow = (block.timestamp >= s.nextExecution && block.timestamp < s.nextExecution + 1 hours);
        require(!inExecutionWindow, "Lock: execution window active");

        s.active = false;
        uint256 refundAmount = s.fundedBalance;
        s.fundedBalance = 0;

        if (refundAmount > 0) {
            require(IERC20(s.paymentToken).transfer(s.poster, refundAmount), "Refund failed");
        }

        emit ScheduleCancelled(_scheduleId, refundAmount);
    }

    function replenishSchedule(uint256 _scheduleId, uint256 _amount) external {
        Schedule storage s = schedules[_scheduleId];
        require(s.poster == msg.sender, "Only poster can replenish");
        require(_amount > 0, "Amount must be > 0");

        // Lock checks
        bool inExecutionWindow = (block.timestamp >= s.nextExecution && block.timestamp < s.nextExecution + 1 hours);
        require(!inExecutionWindow, "Lock: execution window active");

        require(IERC20(s.paymentToken).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        s.fundedBalance += _amount;

        if (s.fundedBalance >= s.reward && s.executionsCount < s.maxExecutions) {
            s.active = true;
        }

        emit ScheduleReplenished(_scheduleId, _amount);
    }

    function withdrawSchedule(uint256 _scheduleId, uint256 _amount) external {
        Schedule storage s = schedules[_scheduleId];
        require(s.poster == msg.sender, "Only poster can withdraw");
        require(_amount > 0, "Amount must be > 0");
        require(s.fundedBalance >= _amount, "Insufficient balance");

        // Lock checks
        bool inExecutionWindow = (block.timestamp >= s.nextExecution && block.timestamp < s.nextExecution + 1 hours);
        require(!inExecutionWindow, "Lock: execution window active");

        s.fundedBalance -= _amount;
        if (s.fundedBalance < s.reward) {
            s.active = false;
        }

        require(IERC20(s.paymentToken).transfer(s.poster, _amount), "Withdraw failed");
        emit ScheduleWithdrawn(_scheduleId, _amount);
    }

    function getSchedule(uint256 _scheduleId) external view returns (
        address poster,
        string memory description,
        string memory requiredCapabilities,
        uint256 reward,
        uint256 interval,
        uint256 nextExecution,
        uint256 fundedBalance,
        uint256 maxExecutions,
        uint256 executionsCount,
        address paymentToken,
        bool active
    ) {
        Schedule storage s = schedules[_scheduleId];
        return (
            s.poster,
            s.description,
            s.requiredCapabilities,
            s.reward,
            s.interval,
            s.nextExecution,
            s.fundedBalance,
            s.maxExecutions,
            s.executionsCount,
            s.paymentToken,
            s.active
        );
    }
}
