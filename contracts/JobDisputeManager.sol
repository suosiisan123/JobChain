// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IJobChainV2 {
    enum JobStatus { Open, InProgress, Submitted, Completed, Failed, Cancelled, Disputed }
    enum AuctionType { Fixed, Bid, Dutch }

    function setStatusFromManager(uint256 _jobId, JobStatus _status) external;
    function resolveDisputeAgentWins(uint256 _jobId, address[] calldata _voters) external;
    function resolveDisputePosterWins(uint256 _jobId, address[] calldata _voters) external;

    function getJobAuctionDetails(uint256 _jobId) external view returns (
        address poster,
        JobStatus status,
        AuctionType auctionType,
        uint256 reward,
        address paymentToken
    );

    function getJobDisputeDetails(uint256 _jobId) external view returns (
        uint256 assignedAgent,
        uint256 failedAt
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
}

contract JobDisputeManager {
    address public owner;
    address public jobChain;

    struct Dispute {
        uint256 disputedAt;
        uint256 approveWeight;
        uint256 rejectWeight;
        bool resolved;
    }

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted;
    mapping(uint256 => uint256[]) public disputeVoters;

    event DisputeOpened(uint256 indexed jobId, uint256 indexed agentId, address indexed opener);
    event DisputeVoteCast(uint256 indexed jobId, uint256 indexed agentId, address indexed voter, bool supportAgent, uint256 weight);
    event DisputeResolved(uint256 indexed jobId, bool resolvedInFavorOfAgent, uint256 approveWeight, uint256 rejectWeight);

    constructor(address _jobChain) {
        owner = msg.sender;
        jobChain = _jobChain;
    }

    function openDispute(uint256 _jobId) external {
        (address poster, IJobChainV2.JobStatus status,,,) = IJobChainV2(jobChain).getJobAuctionDetails(_jobId);
        (uint256 assignedAgent, uint256 failedAt) = IJobChainV2(jobChain).getJobDisputeDetails(_jobId);
        
        require(status == IJobChainV2.JobStatus.Failed, "Job not failed");
        require(failedAt > 0, "No failure registered");
        require(block.timestamp < failedAt + 24 hours, "Dispute window closed");
        
        address identityReg = IJobChainV2(jobChain).identityRegistry();
        require(IIdentityRegistry(identityReg).ownerOf(assignedAgent) == msg.sender, "Only assigned agent can dispute");

        IJobChainV2(jobChain).setStatusFromManager(_jobId, IJobChainV2.JobStatus.Disputed);

        disputes[_jobId] = Dispute({
            disputedAt: block.timestamp,
            approveWeight: 0,
            rejectWeight: 0,
            resolved: false
        });

        emit DisputeOpened(_jobId, assignedAgent, msg.sender);
    }

    function castVote(uint256 _jobId, uint256 _agentId, bool _supportAgent) external {
        (, IJobChainV2.JobStatus status,,,) = IJobChainV2(jobChain).getJobAuctionDetails(_jobId);
        require(status == IJobChainV2.JobStatus.Disputed, "Job not disputed");
        
        Dispute storage d = disputes[_jobId];
        require(!d.resolved, "Dispute already resolved");
        require(block.timestamp < d.disputedAt + 48 hours, "Voting window closed");

        address identityReg = IJobChainV2(jobChain).identityRegistry();
        require(IIdentityRegistry(identityReg).ownerOf(_agentId) == msg.sender, "Not agent owner");
        
        require(isEligibleValidator(_agentId), "Agent not eligible validator");
        
        (uint256 assignedAgent,) = IJobChainV2(jobChain).getJobDisputeDetails(_jobId);
        require(assignedAgent != _agentId, "Assigned agent cannot vote");

        require(!hasVoted[_jobId][_agentId], "Already voted");
        hasVoted[_jobId][_agentId] = true;
        disputeVoters[_jobId].push(_agentId);

        (,,uint256 totalScore,uint256 completedJobs,,) = IJobChainV2(jobChain).agents(_agentId);
        uint256 weight = (totalScore * 100) / completedJobs;

        if (_supportAgent) {
            d.approveWeight += weight;
        } else {
            d.rejectWeight += weight;
        }

        emit DisputeVoteCast(_jobId, _agentId, msg.sender, _supportAgent, weight);
    }

    function resolveDispute(uint256 _jobId) external {
        (, IJobChainV2.JobStatus status,,,) = IJobChainV2(jobChain).getJobAuctionDetails(_jobId);
        require(status == IJobChainV2.JobStatus.Disputed, "Job not disputed");
        
        Dispute storage d = disputes[_jobId];
        require(!d.resolved, "Already resolved");
        require(block.timestamp >= d.disputedAt + 48 hours, "Voting window still open");

        d.resolved = true;

        uint256 voterCount = disputeVoters[_jobId].length;
        address[] memory voters = new address[](voterCount);
        address identityReg = IJobChainV2(jobChain).identityRegistry();
        
        for (uint256 i = 0; i < voterCount; i++) {
            voters[i] = IIdentityRegistry(identityReg).ownerOf(disputeVoters[_jobId][i]);
        }

        if (d.approveWeight > d.rejectWeight) {
            IJobChainV2(jobChain).resolveDisputeAgentWins(_jobId, voters);
            emit DisputeResolved(_jobId, true, d.approveWeight, d.rejectWeight);
        } else {
            IJobChainV2(jobChain).resolveDisputePosterWins(_jobId, voters);
            emit DisputeResolved(_jobId, false, d.approveWeight, d.rejectWeight);
        }
    }

    function isEligibleValidator(uint256 _agentId) public view returns (bool) {
        (,,uint256 totalScore,uint256 completedJobs,bool isActive,) = IJobChainV2(jobChain).agents(_agentId);
        if (!isActive) return false;
        if (completedJobs <= 10) return false;
        if (totalScore <= completedJobs * 4) return false;
        return true;
    }

    function getDispute(uint256 _jobId) external view returns (
        uint256 disputedAt,
        uint256 approveWeight,
        uint256 rejectWeight,
        bool resolved,
        uint256 voterCount
    ) {
        Dispute storage d = disputes[_jobId];
        return (d.disputedAt, d.approveWeight, d.rejectWeight, d.resolved, disputeVoters[_jobId].length);
    }
}
