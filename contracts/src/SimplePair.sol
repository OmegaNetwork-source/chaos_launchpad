// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IFuse.sol";

/**
 * @title SimplePair
 * @notice Minimal constant-product AMM for graduated tokens
 * @dev Liquidity is locked at graduation. Swaps skim protocol (+ optional creator) fees
 *      from swap input; remaining input trades against the invariant with no in-pool fee.
 *
 * Fee structure (post-grad):
 * - Protocol: 25 bps (0.25%) of swap input → factory feeRecipient
 * - Creator:  0-25 bps of swap input (opt-in at create) → accrued on curve (quote) or
 *             sent to creator (token input)
 */
contract SimplePair is ISimplePair, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PROTOCOL_POST_GRAD_FEE_BPS = 25; // 0.25%
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public immutable token0;
    address public immutable factory;
    address public immutable curve;
    address public immutable creator;
    address public immutable quoteToken; // address(0) = native
    uint256 public immutable creatorPostGradFeeBps; // 0-25

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 private unlocked = 1;

    error InsufficientOutputAmount();
    error InsufficientLiquidity();
    error InsufficientInputAmount();
    error InvalidK();
    error TransferFailed();
    error Locked();

    modifier lock() {
        if (unlocked != 1) revert Locked();
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor(
        address _token0,
        address _factory,
        address _curve,
        address _creator,
        uint256 _creatorPostGradFeeBps,
        address _quoteToken
    ) {
        token0 = _token0;
        factory = _factory;
        curve = _curve;
        creator = _creator;
        creatorPostGradFeeBps = _creatorPostGradFeeBps;
        quoteToken = _quoteToken;
    }

    function getReserves() public view override returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _quoteBalance() internal view returns (uint256) {
        if (quoteToken == address(0)) return address(this).balance;
        return IERC20(quoteToken).balanceOf(address(this));
    }

    function sync() external override {
        _update(IERC20(token0).balanceOf(address(this)), _quoteBalance());
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "Overflow");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    function _transferQuote(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (quoteToken == address(0)) {
            (bool success,) = to.call{ value: amount }("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(quoteToken).safeTransfer(to, amount);
        }
    }

    function _transferToken(address to, uint256 amount) internal {
        if (amount == 0) return;
        IERC20(token0).safeTransfer(to, amount);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to) external payable override lock nonReentrant {
        if (amount0Out == 0 && amount1Out == 0) revert InsufficientOutputAmount();
        if (amount0Out > 0 && amount1Out > 0) revert InsufficientOutputAmount();

        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        if (amount0Out >= _reserve0 || amount1Out >= _reserve1) revert InsufficientLiquidity();

        if (amount0Out > 0) _transferToken(to, amount0Out);
        if (amount1Out > 0) _transferQuote(to, amount1Out);

        uint256 amount0In;
        uint256 amount1In;
        {
            uint256 balance0 = IERC20(token0).balanceOf(address(this));
            uint256 balance1 = _quoteBalance();
            amount0In = balance0 > uint256(_reserve0) - amount0Out ? balance0 - (uint256(_reserve0) - amount0Out) : 0;
            amount1In = balance1 > uint256(_reserve1) - amount1Out ? balance1 - (uint256(_reserve1) - amount1Out) : 0;
        }
        if (amount0In == 0 && amount1In == 0) revert InsufficientInputAmount();

        bool tokenInput = amount0In > 0;
        (uint256 protocolFee, uint256 creatorFee) = _skimFees(tokenInput ? amount0In : amount1In, tokenInput);

        {
            uint256 balance0 = IERC20(token0).balanceOf(address(this));
            uint256 balance1 = _quoteBalance();
            if (balance0 * balance1 < uint256(_reserve0) * uint256(_reserve1)) revert InvalidK();
            _update(balance0, balance1);
        }

        emit FeesSkimmed(protocolFee, creatorFee, tokenInput);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /**
     * @dev Skim fees from input. Total fee matches getAmountOut so K stays valid.
     *      Quote creator fees accrue on the bonding curve (same claim path).
     *      Token creator fees are sent directly to the creator.
     */
    function _skimFees(uint256 amountIn, bool tokenInput)
        internal
        returns (uint256 protocolFee, uint256 creatorFee)
    {
        uint256 totalFeeBps = PROTOCOL_POST_GRAD_FEE_BPS + creatorPostGradFeeBps;
        uint256 totalFee = (amountIn * totalFeeBps) / BPS_DENOMINATOR;
        protocolFee = (amountIn * PROTOCOL_POST_GRAD_FEE_BPS) / BPS_DENOMINATOR;
        if (protocolFee > totalFee) protocolFee = totalFee;
        creatorFee = totalFee - protocolFee;

        address feeRecipient = ILaunchpadFactory(factory).feeRecipient();

        if (tokenInput) {
            _transferToken(feeRecipient, protocolFee);
            _transferToken(creator, creatorFee);
        } else {
            _transferQuote(feeRecipient, protocolFee);
            if (creatorFee > 0) {
                _transferQuote(curve, creatorFee);
                IBondingCurve(curve).notifyPostGradCreatorFee(creatorFee);
            }
        }
    }

    function getAmountOut(uint256 amountIn, bool tokenToQuote) external view override returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 reserveIn = tokenToQuote ? uint256(_reserve0) : uint256(_reserve1);
        uint256 reserveOut = tokenToQuote ? uint256(_reserve1) : uint256(_reserve0);
        if (reserveIn == 0 || reserveOut == 0) return 0;

        uint256 totalFeeBps = PROTOCOL_POST_GRAD_FEE_BPS + creatorPostGradFeeBps;
        uint256 amountInAfterFee = amountIn - (amountIn * totalFeeBps) / BPS_DENOMINATOR;
        amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);
    }

    receive() external payable { }
}
