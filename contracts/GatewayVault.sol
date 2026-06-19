// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract GatewayVault {
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    
    // Mapping to track each user's deposited USDC balance
    mapping(address => uint256) public deposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(IERC20(USDC).transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        deposits[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(deposits[msg.sender] >= amount, "Insufficient deposit balance");
        deposits[msg.sender] -= amount;
        require(IERC20(USDC).transfer(msg.sender, amount), "USDC transfer failed");
        emit Withdrawn(msg.sender, amount);
    }
}
