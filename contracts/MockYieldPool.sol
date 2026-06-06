// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockYieldPool {
    uint256 public immutable startTimestamp;
    uint256 public constant APY_BPS = 850; // 8.50% APY simulated

    event YieldDeposited(address indexed token, address indexed user, uint256 amount);
    event YieldWithdrawn(address indexed token, address indexed user, uint256 amount, address receiver);

    constructor() {
        startTimestamp = block.timestamp;
    }

    function deposit(address token, uint256 amount) external returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit YieldDeposited(token, msg.sender, amount);
        return true;
    }

    function withdraw(address token, uint256 amount, address receiver) external returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient pool liquidity");
        require(IERC20(token).transfer(receiver, amount), "Transfer failed");
        emit YieldWithdrawn(token, msg.sender, amount, receiver);
        return true;
    }

    // Exchange rate starts at 1e18 (1.0) and grows at 8.5% APY
    function getExchangeRate(address /* token */) external view returns (uint256) {
        uint256 elapsed = block.timestamp - startTimestamp;
        // rate = 1e18 + (1e18 * APY_BPS * elapsed) / (365 days * 10000)
        uint256 rate = 1e18 + (1e18 * APY_BPS * elapsed) / (365 days * 10000);
        return rate;
    }
}
