// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title  PharosMarket — a single binary macro prediction market
/// @author Lighthouse Macro
/// @notice One question, two outcomes (YES = 1, NO = 0), USDC collateral, a
///         constant-product AMM for the crowd price, and a *separate* posted
///         framework probability — the Lighthouse Macro fair value. The product
///         is the spread between the two.
///
/// @dev SOLVENCY INVARIANT (proven in test/pharos.test.ts):
///
///        totalCollateral == outstandingYes == outstandingNo
///
///      Every USDC deposited mints exactly one complete set (1 YES + 1 NO),
///      split between the trader and the pool. Exactly one side wins and each
///      winning share redeems exactly 1 USDC. Therefore total payout on
///      resolution == totalCollateral. With FEE_BPS = 0 the market is solvent
///      by construction — no oracle, no parameter, no trade sequence can make
///      it pay out more USDC than it holds.
contract PharosMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---- Outcomes ----
    uint8 public constant NO = 0;
    uint8 public constant YES = 1;

    // ---- Immutable config ----
    IERC20 public immutable usdc;
    address public immutable factory;
    string public question;
    /// @notice Strike, scaled by 1e6 (e.g. CPI MoM 0.30% -> 3000; NFP 150k -> 150000000).
    int256 public immutable strikeScaled;
    /// @notice Unix seconds; resolution allowed at/after this (the data release).
    uint64 public immutable resolveTime;
    /// @notice Human tag for the resolver agent ("CPI_MOM", "NFP", "GDP", "FOMC").
    string public resolverKind;

    // ---- Roles ----
    address public resolver;       // oracle agent — calls resolve()
    address public pricingOracle;  // pricing service — calls updateFrameworkProb()
    address public lp;             // liquidity provider — claims residual post-resolution

    // ---- AMM state (share units == USDC 6dp units) ----
    uint256 public rYes;            // pool YES reserve
    uint256 public rNo;             // pool NO reserve
    uint256 public totalCollateral; // USDC held backing complete sets
    mapping(address => uint256) public yesBalance;
    mapping(address => uint256) public noBalance;

    // ---- Framework price (the moat, posted on-chain) ----
    /// @notice Lighthouse Macro fair value for YES, in basis points (0..10000).
    uint16 public frameworkProbBps;

    // ---- Resolution ----
    bool public resolved;
    uint8 public winningOutcome;

    /// @notice Protocol fee. Zero keeps the solvency proof trivial; left as a
    ///         constant so a fee variant is a one-line change, not a refactor.
    uint256 public constant FEE_BPS = 0;
    uint256 private constant BPS = 10_000;

    event Funded(address indexed lp, uint256 amount, uint256 rYes, uint256 rNo);
    event Bought(address indexed buyer, uint8 outcome, uint256 usdcIn, uint256 sharesOut, uint16 marketProbBps);
    event Sold(address indexed seller, uint8 outcome, uint256 sharesIn, uint256 usdcOut, uint16 marketProbBps);
    event FrameworkProbUpdated(uint16 oldBps, uint16 newBps, address indexed by);
    event Resolved(uint8 winningOutcome, address indexed by);
    event Redeemed(address indexed holder, uint8 outcome, uint256 shares, uint256 usdcOut);
    event LiquidityWithdrawn(address indexed lp, uint256 usdcOut);

    modifier onlyResolver() {
        require(msg.sender == resolver, "not resolver");
        _;
    }
    modifier notResolved() {
        require(!resolved, "resolved");
        _;
    }

    constructor(
        IERC20 _usdc,
        string memory _question,
        int256 _strikeScaled,
        uint64 _resolveTime,
        string memory _resolverKind,
        uint16 _frameworkProbBps,
        address _resolver,
        address _pricingOracle,
        address _lp
    ) {
        require(_frameworkProbBps <= BPS, "bad prob");
        require(_resolveTime > block.timestamp, "resolveTime past");
        usdc = _usdc;
        factory = msg.sender;
        question = _question;
        strikeScaled = _strikeScaled;
        resolveTime = _resolveTime;
        resolverKind = _resolverKind;
        frameworkProbBps = _frameworkProbBps;
        resolver = _resolver;
        pricingOracle = _pricingOracle;
        lp = _lp;
    }

    // ----------------------------------------------------------------------
    //  Liquidity
    // ----------------------------------------------------------------------

    /// @notice Seed AMM liquidity. Mints `amount` complete sets into the pool
    ///         (price opens at 0.50). The framework probability is posted
    ///         separately via `frameworkProbBps` — the AMM price floats with
    ///         trading, the framework price is the LHM oracle value, and the
    ///         gap between them is the signal.
    function fund(uint256 amount) external nonReentrant notResolved {
        require(msg.sender == factory || msg.sender == lp, "not lp/factory");
        require(amount > 0, "zero");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        rYes += amount;
        rNo += amount;
        totalCollateral += amount;
        emit Funded(lp, amount, rYes, rNo);
    }

    // ----------------------------------------------------------------------
    //  Trading — constant-product AMM over complete sets
    // ----------------------------------------------------------------------

    /// @notice Shares of `outcome` received for `usdcIn` (view; rounds in
    ///         favour of the pool, so quotes are conservative).
    function calcBuyAmount(uint8 outcome, uint256 usdcIn) public view returns (uint256) {
        require(outcome <= YES, "bad outcome");
        require(usdcIn > 0, "zero");
        uint256 dx = usdcIn - (usdcIn * FEE_BPS) / BPS;
        (uint256 A, uint256 B) = outcome == YES ? (rYes, rNo) : (rNo, rYes);
        require(A > 0 && B > 0, "no liquidity");
        // Mint dx of each into the pool, keep product k = A*B constant by
        // shipping the buyer (A + dx) - k/(B + dx) of the chosen side.
        uint256 finalA = Math.mulDiv(A, B, B + dx); // rounds down -> pool safe
        return (A + dx) - finalA;
    }

    /// @notice Buy `outcome` shares with USDC.
    function buy(uint8 outcome, uint256 usdcIn, uint256 minSharesOut)
        external
        nonReentrant
        notResolved
        returns (uint256 sharesOut)
    {
        sharesOut = calcBuyAmount(outcome, usdcIn);
        require(sharesOut >= minSharesOut, "slippage");
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        uint256 dx = usdcIn - (usdcIn * FEE_BPS) / BPS;
        totalCollateral += usdcIn;

        if (outcome == YES) {
            // pool: +dx both, then ship sharesOut YES to buyer
            rYes = rYes + dx - sharesOut;
            rNo = rNo + dx;
            yesBalance[msg.sender] += sharesOut;
        } else {
            rNo = rNo + dx - sharesOut;
            rYes = rYes + dx;
            noBalance[msg.sender] += sharesOut;
        }
        emit Bought(msg.sender, outcome, usdcIn, sharesOut, marketProbBps());
    }

    /// @notice USDC returned for selling `sharesIn` of `outcome` (view).
    /// @dev Solves (A + s - dx)(B - dx) = A*B for the smaller root dx, where
    ///      A is the sold-side reserve, B the other. Reduces to
    ///      dx^2 - (A+s+B)dx + s*B = 0.
    function calcSellAmount(uint8 outcome, uint256 sharesIn) public view returns (uint256) {
        require(outcome <= YES, "bad outcome");
        require(sharesIn > 0, "zero");
        (uint256 A, uint256 B) = outcome == YES ? (rYes, rNo) : (rNo, rYes);
        require(A > 0 && B > 0, "no liquidity");
        uint256 S = A + sharesIn + B;
        uint256 disc = S * S - 4 * sharesIn * B;
        uint256 dx = (S - Math.sqrt(disc)) / 2; // smaller root, rounds down -> pool safe
        require(dx < B, "exceeds liquidity");
        return dx;
    }

    /// @notice Sell `sharesIn` of `outcome` back to the pool for USDC.
    function sell(uint8 outcome, uint256 sharesIn, uint256 minUsdcOut)
        external
        nonReentrant
        notResolved
        returns (uint256 usdcOut)
    {
        if (outcome == YES) {
            require(yesBalance[msg.sender] >= sharesIn, "insufficient YES");
        } else {
            require(noBalance[msg.sender] >= sharesIn, "insufficient NO");
        }
        usdcOut = calcSellAmount(outcome, sharesIn);
        require(usdcOut >= minUsdcOut, "slippage");
        require(usdcOut <= totalCollateral, "undercollateralized");

        if (outcome == YES) {
            yesBalance[msg.sender] -= sharesIn;
            rYes = rYes + sharesIn - usdcOut;
            rNo = rNo - usdcOut;
        } else {
            noBalance[msg.sender] -= sharesIn;
            rNo = rNo + sharesIn - usdcOut;
            rYes = rYes - usdcOut;
        }
        totalCollateral -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Sold(msg.sender, outcome, sharesIn, usdcOut, marketProbBps());
    }

    // ----------------------------------------------------------------------
    //  Framework price (posted by the Lighthouse pricing oracle)
    // ----------------------------------------------------------------------

    function updateFrameworkProb(uint16 newBps) external notResolved {
        require(msg.sender == pricingOracle, "not pricing oracle");
        require(newBps <= BPS, "bad prob");
        uint16 old = frameworkProbBps;
        frameworkProbBps = newBps;
        emit FrameworkProbUpdated(old, newBps, msg.sender);
    }

    // ----------------------------------------------------------------------
    //  Resolution & redemption
    // ----------------------------------------------------------------------

    function resolve(uint8 _winningOutcome) external onlyResolver notResolved {
        require(_winningOutcome <= YES, "bad outcome");
        require(block.timestamp >= resolveTime, "too early");
        resolved = true;
        winningOutcome = _winningOutcome;
        emit Resolved(_winningOutcome, msg.sender);
    }

    /// @notice Burn winning shares for 1 USDC each. Losing shares pay 0.
    function redeem() external nonReentrant returns (uint256 usdcOut) {
        require(resolved, "not resolved");
        uint256 shares = winningOutcome == YES ? yesBalance[msg.sender] : noBalance[msg.sender];
        require(shares > 0, "nothing to redeem");
        yesBalance[msg.sender] = 0;
        noBalance[msg.sender] = 0;
        usdcOut = shares; // 1 share == 1 USDC (both 6dp)
        require(usdcOut <= totalCollateral, "undercollateralized");
        totalCollateral -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Redeemed(msg.sender, winningOutcome, shares, usdcOut);
    }

    /// @notice LP claims the pool's residual (its winning-side reserve) after
    ///         resolution. The pool's losing-side reserve is worthless, as it
    ///         should be — the LP is the counterparty of last resort.
    function withdrawLiquidity() external nonReentrant returns (uint256 usdcOut) {
        require(resolved, "not resolved");
        require(msg.sender == lp, "not lp");
        usdcOut = winningOutcome == YES ? rYes : rNo;
        rYes = 0;
        rNo = 0;
        if (usdcOut > totalCollateral) usdcOut = totalCollateral; // belt + braces
        totalCollateral -= usdcOut;
        if (usdcOut > 0) usdc.safeTransfer(msg.sender, usdcOut);
        emit LiquidityWithdrawn(msg.sender, usdcOut);
    }

    // ----------------------------------------------------------------------
    //  Views
    // ----------------------------------------------------------------------

    /// @notice Current crowd price for YES, in basis points (0..10000).
    function marketProbBps() public view returns (uint16) {
        uint256 denom = rYes + rNo;
        if (denom == 0) return 5000;
        // YES price == rNo / (rYes + rNo): scarce side is expensive.
        return uint16((rNo * BPS) / denom);
    }

    /// @notice Signed edge in bps: framework YES prob minus crowd YES prob.
    ///         Positive => framework thinks YES is underpriced by the crowd.
    function edgeBps() external view returns (int256) {
        return int256(uint256(frameworkProbBps)) - int256(uint256(marketProbBps()));
    }

    /// @notice Outstanding totals — used by the solvency assertion in tests.
    function outstanding() external view returns (uint256 yes, uint256 no) {
        // pool reserves + every trader balance. The test harness sums trader
        // balances off-chain and checks against totalCollateral.
        return (rYes, rNo);
    }

    function snapshot()
        external
        view
        returns (
            uint16 mktBps,
            uint16 fwBps,
            uint256 collateral,
            uint256 reserveYes,
            uint256 reserveNo,
            bool isResolved,
            uint8 winner
        )
    {
        return (marketProbBps(), frameworkProbBps, totalCollateral, rYes, rNo, resolved, winningOutcome);
    }
}
