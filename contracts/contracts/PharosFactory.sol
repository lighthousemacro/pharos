// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PharosMarket} from "./PharosMarket.sol";

/// @title  PharosFactory
/// @notice Deploys and registers binary macro markets. Creation is gated to
///         the market-creator agent (`owner`). Every market is wired to the
///         oracle agent (`resolver`) and the Lighthouse pricing service
///         (`pricingOracle`) at birth, and seeded with USDC liquidity in the
///         same transaction so a market is never live without depth.
contract PharosFactory {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    address public owner;          // market-creator agent
    address public resolver;       // oracle agent
    address public pricingOracle;  // Lighthouse pricing service signer

    address[] public markets;
    mapping(bytes32 => address) public marketByKey; // dedupe key -> market

    event MarketCreated(
        address indexed market,
        string question,
        string resolverKind,
        int256 strikeScaled,
        uint64 resolveTime,
        uint16 frameworkProbBps,
        uint256 seedUsdc
    );
    event RolesUpdated(address owner, address resolver, address pricingOracle);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(IERC20 _usdc, address _resolver, address _pricingOracle) {
        usdc = _usdc;
        owner = msg.sender;
        resolver = _resolver;
        pricingOracle = _pricingOracle;
    }

    function setRoles(address _owner, address _resolver, address _pricingOracle) external onlyOwner {
        owner = _owner;
        resolver = _resolver;
        pricingOracle = _pricingOracle;
        emit RolesUpdated(_owner, _resolver, _pricingOracle);
    }

    /// @notice Deploy + seed a market. Caller (the creator agent) must have
    ///         approved this factory for `seedUsdc`. The agent itself becomes
    ///         the LP and can reclaim the pool residual after resolution.
    /// @param key A stable dedupe key, e.g. keccak256("CPI_MOM:2026-05").
    function createMarket(
        bytes32 key,
        string calldata question,
        int256 strikeScaled,
        uint64 resolveTime,
        string calldata resolverKind,
        uint16 frameworkProbBps,
        uint256 seedUsdc
    ) external onlyOwner returns (address market) {
        require(marketByKey[key] == address(0), "exists");
        require(seedUsdc > 0, "no seed");

        PharosMarket m = new PharosMarket(
            usdc,
            question,
            strikeScaled,
            resolveTime,
            resolverKind,
            frameworkProbBps,
            resolver,
            pricingOracle,
            msg.sender // LP = creator agent / treasury
        );
        market = address(m);

        // Pull seed from the agent, fund the new market atomically.
        usdc.safeTransferFrom(msg.sender, address(this), seedUsdc);
        usdc.forceApprove(market, seedUsdc);
        m.fund(seedUsdc);

        markets.push(market);
        marketByKey[key] = market;
        emit MarketCreated(market, question, resolverKind, strikeScaled, resolveTime, frameworkProbBps, seedUsdc);
    }

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function allMarkets() external view returns (address[] memory) {
        return markets;
    }
}
