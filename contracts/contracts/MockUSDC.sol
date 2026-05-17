// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice 6-decimal USDC stand-in for local + Arc testnet. Arc has native
///         USDC; in production the market is pointed at that address instead.
/// @dev    Open faucet `mint` so demo wallets can self-fund. Testnet only.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Open faucet. Testnet convenience, never deploy to mainnet.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
