// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IJobChainV2 {
    enum JobStatus { Open, InProgress, Submitted, Completed, Failed, Cancelled, Disputed }
    enum AuctionType { Fixed, Bid, Dutch }

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
    ) external returns (uint256);

    function acceptBidFromManager(
        uint256 _jobId,
        uint256 _agentId,
        uint256 _price
    ) external;

    function getJobAuctionDetails(uint256 _jobId) external view returns (
        address poster,
        JobStatus status,
        AuctionType auctionType,
        uint256 reward,
        address paymentToken
    );

    function agents(uint256 _agentId) external view returns (
        uint256 stakedAmount,
        uint256 completedJobs,
        uint256 totalScore,
        uint256 failedJobs,
        bool isActive,
        uint256 registeredAt
    );

    function identityRegistry() external view returns (address);
    function usdc() external view returns (address);
}

contract JobAuctionManager {
    address public owner;
    address public jobChain;

    struct Bid {
        uint256 agentId;
        uint256 price;
        address bidder;
        bool refunded;
    }

    mapping(uint256 => Bid[]) public jobBids;
    mapping(uint256 => uint256) public lowestBidIndex;

    event BidSubmitted(uint256 indexed jobId, uint256 indexed agentId, uint256 price, address indexed bidder);
    event BidAccepted(uint256 indexed jobId, uint256 indexed agentId, uint256 price);

    constructor(address _jobChain) {
        owner = msg.sender;
        jobChain = _jobChain;
    }

    function postJobAuction(
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _deadline,
        address _paymentToken,
        IJobChainV2.AuctionType _auctionType,
        uint256 _startPrice,
        uint256 _floorPrice,
        uint256 _decayPeriod
    ) external returns (uint256) {
        require(_deadline > block.timestamp, "Deadline must be future");

        uint256 rewardAmount = _startPrice;
        if (_auctionType == IJobChainV2.AuctionType.Fixed) {
            require(_startPrice > 0, "Reward must be > 0");
        } else if (_auctionType == IJobChainV2.AuctionType.Dutch) {
            require(_startPrice >= _floorPrice, "Start must be >= Floor");
            require(_decayPeriod > 0, "Decay period must be > 0");
        } else if (_auctionType == IJobChainV2.AuctionType.Bid) {
            require(_startPrice > 0, "Max reward cap must be > 0");
        }

        // Pull payment token from poster
        require(IERC20(_paymentToken).transferFrom(msg.sender, address(this), rewardAmount), "Escrow lock failed");

        // Approve JobChain to transfer reward
        IERC20(_paymentToken).approve(jobChain, rewardAmount);

        // Call JobChain to post job
        uint256 jobId = IJobChainV2(jobChain).postJobFromManager(
            msg.sender,
            _description,
            _requiredCapabilities,
            rewardAmount,
            _deadline,
            _paymentToken,
            _auctionType,
            _startPrice,
            _floorPrice,
            _decayPeriod
        );

        return jobId;
    }

    function submitBid(uint256 _jobId, uint256 _agentId, uint256 _price) external {
        (address poster, IJobChainV2.JobStatus status, IJobChainV2.AuctionType auctionType, uint256 reward, address paymentToken) = IJobChainV2(jobChain).getJobAuctionDetails(_jobId);
        require(status == IJobChainV2.JobStatus.Open, "Job not open");
        require(auctionType == IJobChainV2.AuctionType.Bid, "Job not bid-based");
        
        address identityReg = IJobChainV2(jobChain).identityRegistry();
        require(IIdentityRegistry(identityReg).ownerOf(_agentId) == msg.sender, "Not agent owner");
        
        (,,,,bool isActive,) = IJobChainV2(jobChain).agents(_agentId);
        require(isActive, "Agent not active");
        require(_price > 0, "Price must be > 0");

        address usdc = IJobChainV2(jobChain).usdc();
        // Require USDC transfer of 1e6 (1 USDC) as spam protection
        require(IERC20(usdc).transferFrom(msg.sender, address(this), 1e6), "USDC bid deposit failed");

        uint256 len = jobBids[_jobId].length;
        if (len > 0) {
            uint256 leadingIdx = lowestBidIndex[_jobId];
            Bid storage leadingBid = jobBids[_jobId][leadingIdx];
            require(_price < leadingBid.price, "Must bid lower reward");

            // Refund the previous leading bidder
            if (!leadingBid.refunded) {
                leadingBid.refunded = true;
                require(IERC20(usdc).transfer(leadingBid.bidder, 1e6), "Refund failed");
            }
            lowestBidIndex[_jobId] = len;
        } else {
            require(_price < reward, "Price must be below max cap");
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
        (address poster, IJobChainV2.JobStatus status, IJobChainV2.AuctionType auctionType,,) = IJobChainV2(jobChain).getJobAuctionDetails(_jobId);
        require(status == IJobChainV2.JobStatus.Open, "Job not open");
        require(poster == msg.sender, "Only poster can accept bid");
        require(_bidIndex < jobBids[_jobId].length, "Invalid bid index");
        require(_bidIndex == lowestBidIndex[_jobId], "Can only accept leading bid");

        Bid storage b = jobBids[_jobId][_bidIndex];
        require(!b.refunded, "Bid already refunded");

        b.refunded = true;

        // Call JobChain to assign the agent and refund excess
        IJobChainV2(jobChain).acceptBidFromManager(_jobId, b.agentId, b.price);

        emit BidAccepted(_jobId, b.agentId, b.price);
    }

    function getBidsLength(uint256 _jobId) external view returns (uint256) {
        return jobBids[_jobId].length;
    }
}
