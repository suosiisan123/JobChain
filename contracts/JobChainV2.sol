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
    error OnlyManager();
    error OnlyOwner();
    error NotAgentOwner();
    error InvalidAmount();
    error TransferFailed();
    error UnsupportedPaymentToken();
    error InvalidDeadline();
    error InvalidPrice();
    error InvalidDecayPeriod();
    error ParentJobNotInProgress();
    error NotAssignedAgentOwner();
    error SubJobRewardExceedsParent();
    error MaxDelegationDepthExceeded();
    error JobNotOpen();
    error UseAcceptBidForBiddingJobs();
    error AgentNotActive();
    error InsufficientStake();
    error JobExpired();
    error InvalidCapabilityAttestation();
    error ClaimRewardBelowFloor();
    error JobNotInProgress();
    error NotAssignedAgent();
    error InvalidZKExecutionProof();
    error NotPoster();
    error ResultNotSubmitted();
    error InvalidRating();
    error ChildJobsNotCompleted();
    error InvalidStatus();
    error JobNotFailed();
    error NoFailureRegistered();
    error DisputeWindowStillOpen();
    error JobNotDisputed();
    error OnlyRevenueDistributor();
    error MaxFeeLimitExceeded();

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

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint256[]) public subJobIds;
    uint256 public nextJobId;

    // ── Manager Authorizations ──
    mapping(address => bool) public isManager;

    modifier onlyManager() {
        if (!isManager[msg.sender]) revert OnlyManager();
        _;
    }



    // ── Protocol Treasury ──
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

    event YieldDistributed(uint256 indexed jobId, uint256 agentShare, uint256 posterShare, uint256 protocolShare);
    event YieldPoolAlert(string message);

    event SubJobPosted(uint256 indexed parentJobId, uint256 indexed childJobId, uint256 reward);



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

    // ── Owner & DAO Address Administration ──
    function setSystemAddresses(
        address _verifier,
        address _stableFX,
        address _yieldPool,
        address _revenueDistributor
    ) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (_verifier != address(0)) verifier = _verifier;
        if (_stableFX != address(0)) stableFX = _stableFX;
        if (_yieldPool != address(0)) yieldPool = _yieldPool;
        if (_revenueDistributor != address(0)) revenueDistributor = _revenueDistributor;
    }

    // ── Helper conversion to USDC ──
    function _convertToUSDC(uint256 amount) internal pure returns (uint256) {
        return (amount * 108) / 100;
    }

    function _depositToPool(address token, uint256 amount) internal returns (uint256 rate, bool success) {
        if (yieldPool != address(0) && amount > 0) {
            try IERC20(token).approve(yieldPool, amount) {} catch {}
            try IMockYieldPool(yieldPool).deposit(token, amount) returns (bool ok) {
                if (ok) {
                    rate = IMockYieldPool(yieldPool).getExchangeRate(token);
                    success = true;
                    yieldTVL += (token == address(usdc) ? amount : _convertToUSDC(amount));
                }
            } catch {}
        }
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

    function _calculateYield(uint256 _jobId) internal view returns (uint256 rewardYield, uint256 stakeYield) {
        Job storage j = jobs[_jobId];
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
    }

    function _withdrawRewardYield(uint256 _jobId, uint256 rewardYield) internal {
        Job storage j = jobs[_jobId];
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
    }

    function _withdrawStakeYield(uint256 _jobId, uint256 stakeYield) internal {
        Job storage j = jobs[_jobId];
        if (j.stakeDepositedInPool && stakeYield > 0) {
            bool withdrawn = _withdrawFromPool(address(usdc), stakeYield);
            if (withdrawn) {
                cumulativeYield += stakeYield;
            }
        }
    }

    function _payoutAgent(
        uint256 _jobId,
        uint256 payoutInSource,
        uint256 agentStakeShare,
        int128 feedbackScore,
        string memory tag,
        string memory comment
    ) internal {
        Job storage j = jobs[_jobId];
        address agentOwner = identityRegistry.ownerOf(j.assignedAgent);
        address preferredToken = agentPayoutToken[j.assignedAgent];
        if (preferredToken == address(0)) {
            preferredToken = j.paymentToken;
        }
        uint256 finalPayoutAmount = payoutInSource;
        if (preferredToken != j.paymentToken) {
            uint256 minAmountOut = (payoutInSource * 95) / 100;
            finalPayoutAmount = _swapTokens(j.paymentToken, preferredToken, payoutInSource, minAmountOut);
        }
        if (!IERC20(preferredToken).transfer(agentOwner, finalPayoutAmount)) revert TransferFailed();
        if (agentStakeShare > 0) {
            if (!usdc.transfer(agentOwner, agentStakeShare)) revert TransferFailed();
        }
        bytes32 refHash = keccak256(abi.encodePacked(tag, _jobId));
        try reputationRegistry.giveFeedback(
            j.assignedAgent,
            feedbackScore,
            0,
            tag,
            comment,
            "",
            "",
            refHash
        ) {} catch {}
        emit PaymentReleased(_jobId, j.assignedAgent, finalPayoutAmount);
    }

    function _slashAgent(uint256 agentId, string memory reason) internal {
        Agent storage a = agents[agentId];
        uint256 slashAmount = (a.stakedAmount * SLASH_PERCENTAGE) / 100;
        if (slashAmount > 0) {
            a.stakedAmount -= slashAmount;
            protocolTokenFees[address(usdc)] += slashAmount;
            emit AgentSlashed(agentId, slashAmount, reason);
        }
        if (a.stakedAmount < MIN_STAKE) {
            a.isActive = false;
            emit AgentDeactivated(agentId);
        }
        a.failedJobs++;
    }

    // ══════════════════════════════════════════════════════
    // Agent Collateral (Staking) & Account Settings
    // ══════════════════════════════════════════════════════

    function stakeCollateral(uint256 _agentId, uint256 _amount) external {
        if (identityRegistry.ownerOf(_agentId) != msg.sender) revert NotAgentOwner();
        if (_amount == 0) revert InvalidAmount();

        if (!usdc.transferFrom(msg.sender, address(this), _amount)) revert TransferFailed();
        
        Agent storage a = agents[_agentId];
        if (a.registeredAt == 0) {
            a.isActive = true;
            a.registeredAt = block.timestamp;
        }
        a.stakedAmount += _amount;

        _depositToPool(address(usdc), _amount);
        emit AgentStaked(_agentId, _amount, a.stakedAmount);
    }
    function _postJobInternal(
        address _poster,
        string memory _description,
        string memory _requiredCapabilities,
        uint256 _reward,
        uint256 _deadline,
        address _paymentToken,
        AuctionType _auctionType,
        uint256 _startPrice,
        uint256 _floorPrice,
        uint256 _decayPeriod,
        uint256 _parentJobId,
        bool _hasParent
    ) internal returns (uint256) {
        uint256 rate = 0;
        bool deposited = false;

        (rate, deposited) = _depositToPool(_paymentToken, _reward);

        uint256 id = nextJobId++;
        jobs[id] = Job({
            poster: _poster,
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
            auctionType: _auctionType,
            startPrice: _startPrice,
            floorPrice: _floorPrice,
            decayPeriod: _decayPeriod,
            parentJobId: _parentJobId,
            hasParent: _hasParent
        });

        emit JobPosted(id, _poster, _reward, _requiredCapabilities, _deadline);
        return id;
    }

    function postJob(
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _reward,
        uint256 _deadline,
        address _paymentToken
    ) external returns (uint256) {
        return postJobAuction(
            _description,
            _requiredCapabilities,
            _deadline,
            _paymentToken,
            AuctionType.Fixed,
            _reward,
            _reward,
            0
        );
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
    ) public returns (uint256) {
        if (_paymentToken != address(usdc) && _paymentToken != address(eurc)) revert UnsupportedPaymentToken();
        if (_deadline <= block.timestamp) revert InvalidDeadline();

        uint256 rewardAmount = _startPrice;
        if (_auctionType == AuctionType.Fixed) {
            if (_startPrice == 0) revert InvalidPrice();
        } else if (_auctionType == AuctionType.Dutch) {
            if (_startPrice < _floorPrice) revert InvalidPrice();
            if (_decayPeriod == 0) revert InvalidDecayPeriod();
        } else if (_auctionType == AuctionType.Bid) {
            if (_startPrice == 0) revert InvalidPrice();
        }

        if (!IERC20(_paymentToken).transferFrom(msg.sender, address(this), rewardAmount)) revert TransferFailed();

        return _postJobInternal(
            msg.sender,
            _description,
            _requiredCapabilities,
            rewardAmount,
            _deadline,
            _paymentToken,
            _auctionType,
            _startPrice,
            _floorPrice,
            _decayPeriod,
            0,
            false
        );
    }

    function postSubJob(
        uint256 _parentJobId,
        string calldata _desc,
        uint256 _reward,
        uint256 _deadline
    ) external returns (uint256) {
        Job storage parentJob = jobs[_parentJobId];
        if (parentJob.status != JobStatus.InProgress) revert ParentJobNotInProgress();
        if (identityRegistry.ownerOf(parentJob.assignedAgent) != msg.sender) revert NotAssignedAgentOwner();
        if (_reward > parentJob.reward) revert SubJobRewardExceedsParent();
        
        uint256 currentParentId = _parentJobId;
        bool currentHasParent = parentJob.hasParent;
        uint256 depth = 1;
        while (currentHasParent) {
            depth++;
            if (depth > 3) revert MaxDelegationDepthExceeded();
            Job storage p = jobs[currentParentId];
            currentParentId = p.parentJobId;
            currentHasParent = p.hasParent;
        }
        
        parentJob.reward -= _reward;
        
        uint256 id = _postJobInternal(
            msg.sender,
            _desc,
            "",
            _reward,
            _deadline,
            parentJob.paymentToken,
            AuctionType.Fixed,
            0,
            0,
            0,
            _parentJobId,
            true
        );
        subJobIds[_parentJobId].push(id);
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

    function setManager(address _manager, bool _status) external {
        if (msg.sender != owner) revert OnlyOwner();
        isManager[_manager] = _status;
    }

    function getJobAuctionDetails(uint256 _jobId) external view returns (
        address poster,
        JobStatus status,
        AuctionType auctionType,
        uint256 reward,
        address paymentToken
    ) {
        Job storage j = jobs[_jobId];
        return (j.poster, j.status, j.auctionType, j.reward, j.paymentToken);
    }

    function postJobFromManager(
        address _poster,
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _reward,
        uint256 _deadline,
        address _paymentToken,
        AuctionType _auctionType,
        uint256 _startPrice,
        uint256 _floorPrice,
        uint256 _decayPeriod
    ) external onlyManager returns (uint256) {
        if (!IERC20(_paymentToken).transferFrom(msg.sender, address(this), _reward)) revert TransferFailed();
        return _postJobInternal(
            _poster,
            _description,
            _requiredCapabilities,
            _reward,
            _deadline,
            _paymentToken,
            _auctionType,
            _startPrice,
            _floorPrice,
            _decayPeriod,
            0,
            false
        );
    }

    function acceptBidFromManager(
        uint256 _jobId,
        uint256 _agentId,
        uint256 _price
    ) external onlyManager {
        Job storage j = jobs[_jobId];
        if (j.status != JobStatus.Open) revert JobNotOpen();

        uint256 excess = j.reward - _price;
        j.reward = _price;
        j.status = JobStatus.InProgress;
        j.assignedAgent = _agentId;

        // Record agent exchange rate at pickup time
        if (yieldPool != address(0)) {
            j.agentExchangeRateAtPickup = IMockYieldPool(yieldPool).getExchangeRate(address(usdc));
            j.stakeDepositedInPool = true;
        }

        // Refund the winner's bid deposit
        if (!usdc.transfer(identityRegistry.ownerOf(_agentId), 1e6)) revert TransferFailed();

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
            if (!IERC20(j.paymentToken).transfer(j.poster, excess)) revert TransferFailed();
        }

        emit JobPickedUp(_jobId, _agentId);
    }

    function pickupJob(uint256 _jobId, uint256 _agentId, bytes calldata _capabilityProof) external {
        Job storage j = jobs[_jobId];
        Agent storage a = agents[_agentId];

        if (j.status != JobStatus.Open) revert JobNotOpen();
        if (j.auctionType == AuctionType.Bid) revert UseAcceptBidForBiddingJobs();
        if (identityRegistry.ownerOf(_agentId) != msg.sender) revert NotAgentOwner();
        if (!a.isActive) revert AgentNotActive();
        if (a.stakedAmount < MIN_STAKE) revert InsufficientStake();
        if (block.timestamp >= j.deadline) revert JobExpired();

        // Verify capability attestation if verifier is set and job has required capabilities
        if (verifier != address(0) && bytes(j.requiredCapabilities).length > 0) {
            if (!IZKVerifier(verifier).verifyCapability(_agentId, j.requiredCapabilities, _capabilityProof)) revert InvalidCapabilityAttestation();
        }

        j.status = JobStatus.InProgress;
        j.assignedAgent = _agentId;

        // Dynamic pricing adjustment for Dutch Auctions
        if (j.auctionType == AuctionType.Dutch) {
            uint256 currentReward = getCurrentReward(_jobId);
            if (currentReward < j.floorPrice) revert ClaimRewardBelowFloor();

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
                if (!IERC20(j.paymentToken).transfer(j.poster, excess)) revert TransferFailed();
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
        if (j.status != JobStatus.InProgress) revert JobNotInProgress();
        if (identityRegistry.ownerOf(j.assignedAgent) != msg.sender) revert NotAssignedAgent();

        // Verify cryptographic execution proof if verifier is set
        if (verifier != address(0)) {
            if (!IZKVerifier(verifier).verifyExecution(_jobId, _resultHash, _proof)) revert InvalidZKExecutionProof();
        }

        j.status = JobStatus.Submitted;
        j.resultHash = _resultHash;

        emit ResultSubmitted(_jobId, j.assignedAgent, _resultHash);
    }

    function _distributeCompletedPayouts(
        uint256 _jobId,
        uint256 _reward,
        uint256 _rewardYield,
        uint256 _stakeYield,
        int128 _feedbackScore,
        string memory _feedbackTag,
        string memory _feedbackComment
    ) internal {
        Job storage j = jobs[_jobId];

        // Split rewardYield: 50% Agent, 30% Poster, 20% Protocol
        uint256 agentRewardShare = (_rewardYield * 50) / 100;
        uint256 posterRewardShare = (_rewardYield * 30) / 100;
        uint256 protocolRewardShare = _rewardYield - agentRewardShare - posterRewardShare;

        // Split stakeYield: 50% Agent, 30% Poster, 20% Protocol
        uint256 agentStakeShare = (_stakeYield * 50) / 100;
        uint256 posterStakeShare = (_stakeYield * 30) / 100;
        uint256 protocolStakeShare = _stakeYield - agentStakeShare - posterStakeShare;

        uint256 protocolFee = (_reward * PROTOCOL_FEE_BPS) / 10000;
        uint256 finalPayout = _reward - protocolFee + agentRewardShare;

        protocolTokenFees[j.paymentToken] += (protocolFee + protocolRewardShare);
        protocolTokenFees[address(usdc)] += protocolStakeShare;

        if (posterRewardShare > 0) {
            if (!IERC20(j.paymentToken).transfer(j.poster, posterRewardShare)) revert TransferFailed();
        }
        if (posterStakeShare > 0) {
            if (!usdc.transfer(j.poster, posterStakeShare)) revert TransferFailed();
        }

        _payoutAgent(_jobId, finalPayout, agentStakeShare, _feedbackScore, _feedbackTag, _feedbackComment);
        emit YieldDistributed(_jobId, agentRewardShare + agentStakeShare, posterRewardShare + posterStakeShare, protocolRewardShare + protocolStakeShare);
    }

    function approveAndRelease(uint256 _jobId, uint8 _rating) external {
        Job storage j = jobs[_jobId];
        if (j.poster != msg.sender) revert NotPoster();
        if (j.status != JobStatus.Submitted) revert ResultNotSubmitted();
        if (_rating < 1 || _rating > 5) revert InvalidRating();

        // Verify all child jobs are completed
        uint256[] storage children = subJobIds[_jobId];
        for (uint256 i = 0; i < children.length; i++) {
            if (jobs[children[i]].status != JobStatus.Completed) revert ChildJobsNotCompleted();
        }

        (uint256 rewardYield, uint256 stakeYield) = _calculateYield(_jobId);
        _withdrawRewardYield(_jobId, rewardYield);
        _withdrawStakeYield(_jobId, stakeYield);

        // Update job
        j.status = JobStatus.Completed;
        j.rating = _rating;

        // Update agent reputation
        Agent storage a = agents[j.assignedAgent];
        a.completedJobs++;
        a.totalScore += _rating;

        int128 feedbackScore = int128(int256((uint256(_rating) - 1) * 25)); // 1-5 mapped to 0-100
        _distributeCompletedPayouts(_jobId, j.reward, rewardYield, stakeYield, feedbackScore, "successful_job", "Job completed successfully");

        emit JobApproved(_jobId, _rating);
    }

    function failJob(uint256 _jobId, string calldata _reason) external {
        Job storage j = jobs[_jobId];
        if (j.poster != msg.sender) revert NotPoster();
        if (j.status != JobStatus.InProgress && j.status != JobStatus.Submitted) revert InvalidStatus();

        j.status = JobStatus.Failed;
        j.failedAt = block.timestamp;

        emit JobFailed(_jobId, j.assignedAgent, _reason);
    }

    function claimFailedRefund(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        if (j.status != JobStatus.Failed) revert JobNotFailed();
        if (j.failedAt == 0) revert NoFailureRegistered();
        if (block.timestamp < j.failedAt + 24 hours) revert DisputeWindowStillOpen();


        (uint256 rewardYield, ) = _calculateYield(_jobId);
        _withdrawRewardYield(_jobId, rewardYield);

        // Poster gets principal + 80% of yield, 20% to protocol
        uint256 posterShare = (rewardYield * 80) / 100;
        uint256 protocolShare = rewardYield - posterShare;

        protocolTokenFees[j.paymentToken] += protocolShare;

        _slashAgent(j.assignedAgent, "Job failed finalization");

        // Refund poster or return to parent reward pool
        if (j.hasParent) {
            Job storage parentJob = jobs[j.parentJobId];
            parentJob.reward += j.reward;
            if (posterShare > 0) {
                if (!IERC20(j.paymentToken).transfer(j.poster, posterShare)) revert TransferFailed();
            }
        } else {
            if (!IERC20(j.paymentToken).transfer(j.poster, j.reward + posterShare)) revert TransferFailed();
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

    function getJobDisputeDetails(uint256 _jobId) external view returns (
        uint256 assignedAgent,
        uint256 failedAt
    ) {
        Job storage j = jobs[_jobId];
        return (j.assignedAgent, j.failedAt);
    }

    function setStatusFromManager(uint256 _jobId, JobStatus _status) external onlyManager {
        Job storage j = jobs[_jobId];
        j.status = _status;
    }

    function _distributeVoterFees(address _token, uint256 _totalFee, address[] calldata _voters) internal {
        if (_voters.length > 0 && _totalFee > 0) {
            uint256 share = _totalFee / _voters.length;
            if (share > 0) {
                _withdrawFromPool(_token, _totalFee);
                for (uint256 i = 0; i < _voters.length; i++) {
                    if (!IERC20(_token).transfer(_voters[i], share)) revert TransferFailed();
                }
            }
        }
    }

    function resolveDisputeFromManager(
        uint256 _jobId,
        bool _agentWins,
        address[] calldata _voters
    ) external onlyManager {
        Job storage j = jobs[_jobId];
        if (j.status != JobStatus.Disputed) revert JobNotDisputed();

        (uint256 rewardYield, uint256 stakeYield) = _calculateYield(_jobId);
        _withdrawRewardYield(_jobId, rewardYield);

        uint256 validatorFee = j.reward / 100;
        uint256 rewardAfterVoterFee = j.reward - validatorFee;

        _distributeVoterFees(j.paymentToken, validatorFee, _voters);

        if (_agentWins) {
            j.status = JobStatus.Completed;
            Agent storage a = agents[j.assignedAgent];
            a.completedJobs++;
            a.totalScore += 5; // Default 5 rating for successful dispute defense

            _withdrawStakeYield(_jobId, stakeYield);

            _distributeCompletedPayouts(_jobId, rewardAfterVoterFee, rewardYield, stakeYield, 100, "dispute_won", "Dispute resolved in favor of agent");
        } else {
            j.status = JobStatus.Failed;

            // Split rewardYield: 80% Poster, 20% Protocol, 0% Agent
            uint256 posterShare = (rewardYield * 80) / 100;
            uint256 protocolShare = rewardYield - posterShare;

            protocolTokenFees[j.paymentToken] += protocolShare;

            _slashAgent(j.assignedAgent, "Dispute lost");

            // Refund poster remaining reward + poster's share of yield
            if (!IERC20(j.paymentToken).transfer(j.poster, rewardAfterVoterFee + posterShare)) revert TransferFailed();

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

            emit YieldDistributed(_jobId, 0, posterShare, protocolShare);
        }
    }

    function cancelJob(uint256 _jobId) external {
        Job storage j = jobs[_jobId];
        if (j.poster != msg.sender) revert NotPoster();
        if (j.status != JobStatus.Open) revert JobNotOpen();

        j.status = JobStatus.Cancelled;

        (uint256 rewardYield, ) = _calculateYield(_jobId);
        _withdrawRewardYield(_jobId, rewardYield);

        // Poster gets principal + 80% of yield, 20% to protocol
        uint256 posterShare = (rewardYield * 80) / 100;
        uint256 protocolShare = rewardYield - posterShare;

        protocolTokenFees[j.paymentToken] += protocolShare;

        // Refund poster or return to parent reward pool
        if (j.hasParent) {
            Job storage parentJob = jobs[j.parentJobId];
            parentJob.reward += j.reward;
            if (posterShare > 0) {
                if (!IERC20(j.paymentToken).transfer(j.poster, posterShare)) revert TransferFailed();
            }
        } else {
            if (!IERC20(j.paymentToken).transfer(j.poster, j.reward + posterShare)) revert TransferFailed();
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
        (rewardYield, stakeYield) = _calculateYield(_jobId);
        return (j.exchangeRateAtDeposit, j.agentExchangeRateAtPickup, j.depositedInPool, j.stakeDepositedInPool, rewardYield, stakeYield);
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

    // setRevenueDistributor functionality merged into setSystemAddresses

    function setProtocolFeeBps(uint256 _bps) external {
        if (msg.sender != revenueDistributor || _bps > 1000) revert InvalidAmount();
        PROTOCOL_FEE_BPS = _bps;
    }

    function withdrawFees() external {
        withdrawTokenFees(address(usdc));
    }

    function withdrawTokenFees(address _token) public {
        uint256 amount = protocolTokenFees[_token];
        protocolTokenFees[_token] = 0;
        // Protocol fees are queryable via view function

        _withdrawFromPool(_token, amount);

        if (!IERC20(_token).transfer(revenueDistributor, amount)) revert TransferFailed();
    }

    // ── Scheduler Contract Integration ──

    function protocolFees() external view returns (uint256) {
        return protocolTokenFees[address(usdc)];
    }
}
