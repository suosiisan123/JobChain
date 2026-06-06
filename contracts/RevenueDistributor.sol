// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IJobChainV2 {
    function setProtocolFeeBps(uint256 _bps) external;
}

contract RevenueDistributor {
    IERC20 public immutable jobToken;
    address[] public rewardTokens;
    mapping(address => bool) public isRewardToken;

    uint256 public totalStakedJOB;

    struct UserInfo {
        uint256 stakedAmount;
        uint256 lastStakeTimestamp;
        mapping(address => uint256) rewardDebt;
    }
    
    mapping(address => UserInfo) private userInfo;
    
    // Reward token => accRevenuePerShare
    mapping(address => uint256) public accRevenuePerShare;
    // Reward token => lastKnownBalance
    mapping(address => uint256) public lastKnownBalances;

    address public jobChain;
    address public owner;

    // Governance
    struct Proposal {
        uint256 id;
        string description;
        uint256 newProtocolFeeBps;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 endBlock;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    uint256 public nextProposalId;
    mapping(uint256 => Proposal) private proposals;
    uint256 public constant VOTING_PERIOD_BLOCKS = 100; // Short for testing/quick turnarounds
    uint256 public constant QUORUM_PERCENT = 10;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RevenueClaimed(address indexed user);
    
    event ProposalCreated(uint256 indexed id, string description, uint256 newProtocolFeeBps, uint256 endBlock);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _jobToken, address _usdc, address _eurc, address _jobChain) {
        jobToken = IERC20(_jobToken);
        rewardTokens.push(_usdc);
        rewardTokens.push(_eurc);
        isRewardToken[_usdc] = true;
        isRewardToken[_eurc] = true;
        jobChain = _jobChain;
        owner = msg.sender;
    }

    function setJobChain(address _jobChain) external onlyOwner {
        jobChain = _jobChain;
    }

    function getRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }

    function getUserStaked(address _user) external view returns (uint256 stakedAmount, uint256 lastStakeTimestamp) {
        return (userInfo[_user].stakedAmount, userInfo[_user].lastStakeTimestamp);
    }

    function getUserRewardDebt(address _user, address _token) external view returns (uint256) {
        return userInfo[_user].rewardDebt[_token];
    }

    function updateRevenue(address token) public {
        require(isRewardToken[token], "Not reward token");
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        uint256 lastBalance = lastKnownBalances[token];

        if (currentBalance > lastBalance && totalStakedJOB > 0) {
            uint256 newRevenue = currentBalance - lastBalance;
            accRevenuePerShare[token] += (newRevenue * 1e24) / totalStakedJOB;
            lastKnownBalances[token] = currentBalance;
        } else if (currentBalance != lastBalance) {
            lastKnownBalances[token] = currentBalance;
        }
    }

    function stakeJOB(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        UserInfo storage user = userInfo[msg.sender];

        // Claim pending first
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            updateRevenue(token);
            if (user.stakedAmount > 0) {
                uint256 pending = (user.stakedAmount * accRevenuePerShare[token]) / 1e24 - user.rewardDebt[token];
                if (pending > 0) {
                    require(IERC20(token).transfer(msg.sender, pending), "Reward transfer failed");
                }
            }
        }

        require(jobToken.transferFrom(msg.sender, address(this), amount), "Staking transfer failed");

        user.stakedAmount += amount;
        totalStakedJOB += amount;
        user.lastStakeTimestamp = block.timestamp;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            user.rewardDebt[token] = (user.stakedAmount * accRevenuePerShare[token]) / 1e24;
            lastKnownBalances[token] = IERC20(token).balanceOf(address(this));
        }

        emit Staked(msg.sender, amount);
    }

    function unstakeJOB(uint256 amount) external {
        UserInfo storage user = userInfo[msg.sender];
        require(user.stakedAmount >= amount, "Insufficient staked balance");
        require(block.timestamp >= user.lastStakeTimestamp + 1 hours, "Tokens are locked (1 hour staking lockout)");

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            updateRevenue(token);
            uint256 pending = (user.stakedAmount * accRevenuePerShare[token]) / 1e24 - user.rewardDebt[token];
            if (pending > 0) {
                require(IERC20(token).transfer(msg.sender, pending), "Reward transfer failed");
            }
        }

        user.stakedAmount -= amount;
        totalStakedJOB -= amount;

        require(jobToken.transfer(msg.sender, amount), "Unstaking transfer failed");

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            user.rewardDebt[token] = (user.stakedAmount * accRevenuePerShare[token]) / 1e24;
            lastKnownBalances[token] = IERC20(token).balanceOf(address(this));
        }

        emit Unstaked(msg.sender, amount);
    }

    function claimRevenue() external {
        UserInfo storage user = userInfo[msg.sender];
        require(user.stakedAmount > 0, "No stakes");
        require(block.timestamp >= user.lastStakeTimestamp + 1 hours, "Tokens are locked (1 hour staking lockout)");

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            updateRevenue(token);
            uint256 pending = (user.stakedAmount * accRevenuePerShare[token]) / 1e24 - user.rewardDebt[token];
            if (pending > 0) {
                require(IERC20(token).transfer(msg.sender, pending), "Reward transfer failed");
            }
            user.rewardDebt[token] = (user.stakedAmount * accRevenuePerShare[token]) / 1e24;
            lastKnownBalances[token] = IERC20(token).balanceOf(address(this));
        }

        emit RevenueClaimed(msg.sender);
    }

    function getPendingRevenue(address _user, address _token) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        if (user.stakedAmount == 0) return 0;
        
        uint256 currentBalance = IERC20(_token).balanceOf(address(this));
        uint256 lastBalance = lastKnownBalances[_token];
        uint256 tempAcc = accRevenuePerShare[_token];

        if (currentBalance > lastBalance && totalStakedJOB > 0) {
            uint256 newRevenue = currentBalance - lastBalance;
            tempAcc += (newRevenue * 1e24) / totalStakedJOB;
        }

        uint256 debt = user.rewardDebt[_token];
        return (user.stakedAmount * tempAcc) / 1e24 - debt;
    }

    // Governance Proposals
    function createProposal(string calldata _description, uint256 _newProtocolFeeBps) external returns (uint256) {
        require(_newProtocolFeeBps <= 1000, "Max fee limit 10%");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.description = _description;
        p.newProtocolFeeBps = _newProtocolFeeBps;
        p.endBlock = block.number + VOTING_PERIOD_BLOCKS;
        p.executed = false;

        emit ProposalCreated(proposalId, _description, _newProtocolFeeBps, p.endBlock);
        return proposalId;
    }

    function castVote(uint256 _proposalId, bool _support) external {
        Proposal storage p = proposals[_proposalId];
        require(block.number < p.endBlock, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        uint256 weight = userInfo[msg.sender].stakedAmount;
        require(weight > 0, "No voting weight (must stake JOB)");

        if (_support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        p.hasVoted[msg.sender] = true;
        emit VoteCast(_proposalId, msg.sender, _support, weight);
    }

    function executeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(block.number >= p.endBlock, "Voting still active");
        require(!p.executed, "Already executed");

        uint256 totalVotes = p.forVotes + p.againstVotes;
        uint256 requiredQuorum = (totalStakedJOB * QUORUM_PERCENT) / 100;
        require(totalVotes >= requiredQuorum, "Quorum not met");
        require(p.forVotes > p.againstVotes, "Proposal rejected");

        p.executed = true;

        if (jobChain != address(0)) {
            IJobChainV2(jobChain).setProtocolFeeBps(p.newProtocolFeeBps);
        }

        emit ProposalExecuted(_proposalId);
    }

    function getProposal(uint256 _id) external view returns (
        uint256 id,
        string memory description,
        uint256 newProtocolFeeBps,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 endBlock,
        bool executed
    ) {
        Proposal storage p = proposals[_id];
        return (p.id, p.description, p.newProtocolFeeBps, p.forVotes, p.againstVotes, p.endBlock, p.executed);
    }

    function getHasVoted(uint256 _proposalId, address _user) external view returns (bool) {
        return proposals[_proposalId].hasVoted[_user];
    }
}
