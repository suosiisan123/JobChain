// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract JobChainContract {
    IERC20 public usdcToken;

    struct JobEscrow {
        address client;
        address freelancer;
        uint256 amount;
        bool isReleased;
    }

    mapping(uint256 => JobEscrow) public jobs;
    uint256 public nextJobId;

    event JobCreated(uint256 indexed jobId, address client, address freelancer, uint256 amount);
    event JobReleased(uint256 indexed jobId, address freelancer, uint256 amount);

    constructor(address _usdcToken) {
        usdcToken = IERC20(_usdcToken);
    }

    function createJob(uint256 amount, address freelancer) external returns (uint256) {
        require(amount > 0, "Amount > 0");
        require(freelancer != address(0), "Invalid freelancer");

        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Escrow lock failed");

        uint256 id = nextJobId++;
        jobs[id] = JobEscrow(msg.sender, freelancer, amount, false);

        emit JobCreated(id, msg.sender, freelancer, amount);
        return id;
    }

    function releaseJob(uint256 jobId) external {
        JobEscrow storage j = jobs[jobId];
        require(msg.sender == j.client, "Only client can release");
        require(!j.isReleased, "Already released");

        j.isReleased = true;
        require(usdcToken.transfer(j.freelancer, j.amount), "Release failed");

        emit JobReleased(jobId, j.freelancer, j.amount);
    }
}
