// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IJobChainV2 {
    function postJobFromScheduler(
        address _poster,
        string calldata _description,
        string calldata _requiredCapabilities,
        uint256 _reward,
        uint256 _deadline,
        address _paymentToken
    ) external returns (uint256);
}

contract JobScheduler {
    address public owner;
    address public jobChain;
    address public usdc;
    address public eurc;

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

    uint256 public nextScheduleId;
    mapping(uint256 => Schedule) public schedules;

    event ScheduleRegistered(uint256 indexed scheduleId, address indexed poster, uint256 interval, uint256 reward, uint256 totalBudget);
    event ScheduleExecuted(uint256 indexed scheduleId, uint256 indexed jobId, uint256 executionCount, uint256 keeperReward);
    event ScheduleCancelled(uint256 indexed scheduleId, uint256 refundAmount);
    event ScheduleReplenished(uint256 indexed scheduleId, uint256 amountAdded);
    event ScheduleWithdrawn(uint256 indexed scheduleId, uint256 amountWithdrawn);

    constructor(address _jobChain, address _usdc, address _eurc) {
        owner = msg.sender;
        jobChain = _jobChain;
        usdc = _usdc;
        eurc = _eurc;
    }

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
        require(_paymentToken == usdc || _paymentToken == eurc, "Invalid payment token");

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

        if (s.executionsCount >= s.maxExecutions || s.fundedBalance < s.reward) {
            s.active = false;
        }

        // Approve JobChain to transfer reward tokens
        IERC20(s.paymentToken).approve(jobChain, jobReward);

        // Call JobChain to spawn the job
        uint256 jobId = IJobChainV2(jobChain).postJobFromScheduler(
            s.poster,
            s.description,
            s.requiredCapabilities,
            jobReward,
            block.timestamp + 24 hours,
            s.paymentToken
        );

        emit ScheduleExecuted(_scheduleId, jobId, s.executionsCount, keeperReward);

        // Pay keeper
        require(IERC20(s.paymentToken).transfer(msg.sender, keeperReward), "Keeper transfer failed");
    }

    function cancelSchedule(uint256 _scheduleId) external {
        Schedule storage s = schedules[_scheduleId];
        require(s.poster == msg.sender, "Only poster can cancel");
        require(s.active, "Schedule not active");

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
