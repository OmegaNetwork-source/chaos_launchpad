// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IFuse.sol";
import "./BondingCurveToken.sol";

/**
 * @title BondingCurve
 * @notice Implements a constant-product bonding curve for memecoin trading
 * @dev Supports both native value (msg.value) and ERC-20 quote tokens
 *
 * ## Curve Math (Constant Product)
 * The curve maintains: virtualQuote * virtualTokens = k (constant)
 *
 * For buys:  tokensOut = virtualTokens - k / (virtualQuote + quoteIn)
 * For sells: quoteOut = virtualQuote - k / (virtualTokens + tokensIn)
 *
 * ## Quote Tokens
 * - quoteToken == address(0): Native value mode (USDC on Arc, zkLTC on LitVM)
 * - quoteToken != address(0): ERC-20 quote mode (approve + transferFrom)
 *
 * ## Fee Structure (curve)
 * - Protocol fee: 1.00% (100 bps) → Olympus treasury (fixed)
 * - Creator fee: 0-1.00% (0-100 bps) → Creator vault (configurable)
 *
 * ## Post-grad fees (SimplePair)
 * - Protocol: 25 bps of swap input → feeRecipient
 * - Creator: 0-25 bps of swap input (opt-in via creatorPostGradFeeBps, default 0)
 *
 * ## Configurable Parameters (at creation time)
 * - virtualQuote: Initial virtual quote reserve (5-1000, affects starting price)
 * - graduationTarget: Quote target for graduation (5-10000)
 * - creatorFeeBps: Creator fee in basis points (0-100)
 * - quoteToken: Quote token address (address(0) for native)
 * - creatorPostGradFeeBps: Post-grad AMM creator fee (0-25), default 0
 */
contract BondingCurve is IBondingCurve, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;
    uint256 public constant LP_SUPPLY = 200_000_000e18;

    // Default values
    uint256 public constant DEFAULT_VIRTUAL_QUOTE = 30e18;
    uint256 public constant DEFAULT_GRADUATION_TARGET = 100e18;
    uint256 public constant DEFAULT_CREATOR_FEE_BPS = 30;

    // Safe bounds for configurable parameters
    uint256 public constant MIN_VIRTUAL_QUOTE = 5e18;
    uint256 public constant MAX_VIRTUAL_QUOTE = 1000e18;
    uint256 public constant MIN_GRADUATION_TARGET = 5e18;
    uint256 public constant MAX_GRADUATION_TARGET = 10000e18;
    uint256 public constant MAX_CREATOR_FEE_BPS = 100;
    uint256 public constant MAX_CREATOR_POST_GRAD_FEE_BPS = 25;

    // Protocol fee is fixed
    uint256 public constant PROTOCOL_FEE_BPS = 100;

    address public token;
    address public immutable factory;
    address public creator;
    address public quoteToken; // address(0) = native

    // Configurable parameters
    uint256 public graduationTarget;
    uint256 public creatorFeeBps;
    uint256 public creatorPostGradFeeBps; // 0-25 bps; default 0 (opt-in)

    uint256 public virtualQuote;
    uint256 public virtualTokens;
    uint256 public realQuoteRaised;
    uint256 public tokensSold;
    bool public graduated;
    address public pair;

    uint256 public creatorFeesAccrued;
    uint256 public creatorFeesClaimed;

    error AlreadyGraduated();
    error AlreadyInitialized();
    error NotInitialized();
    error SlippageExceeded();
    error ZeroAmount();
    error InsufficientTokens();
    error TransferFailed();
    error OnlyFactory();
    error OnlyCreator();
    error OnlyPair();
    error NoFeesToClaim();
    error InvalidParams();
    error WrongQuoteMode();

    event CreatorFeesClaimed(address indexed creator, uint256 amount);

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier whenNotGraduated() {
        if (graduated) revert AlreadyGraduated();
        _;
    }

    modifier whenInitialized() {
        if (token == address(0)) revert NotInitialized();
        _;
    }

    constructor(address factory_) {
        factory = factory_;
        virtualQuote = DEFAULT_VIRTUAL_QUOTE;
        virtualTokens = CURVE_SUPPLY;
        graduationTarget = DEFAULT_GRADUATION_TARGET;
        creatorFeeBps = DEFAULT_CREATOR_FEE_BPS;
    }

    function initialize(
        string memory name,
        string memory symbol,
        string memory metadataURI,
        address creator_
    ) external onlyFactory {
        if (token != address(0)) revert AlreadyInitialized();

        creator = creator_;
        BondingCurveToken newToken = new BondingCurveToken(name, symbol, metadataURI, address(this));
        token = address(newToken);
    }

    function initializeWithParams(
        string memory name,
        string memory symbol,
        string memory metadataURI,
        address creator_,
        CurveParams memory params
    ) external onlyFactory {
        if (token != address(0)) revert AlreadyInitialized();

        // Apply custom params
        if (params.virtualQuote > 0) {
            if (params.virtualQuote < MIN_VIRTUAL_QUOTE || params.virtualQuote > MAX_VIRTUAL_QUOTE) {
                revert InvalidParams();
            }
            virtualQuote = params.virtualQuote;
        }

        if (params.graduationTarget > 0) {
            if (params.graduationTarget < MIN_GRADUATION_TARGET || params.graduationTarget > MAX_GRADUATION_TARGET) {
                revert InvalidParams();
            }
            graduationTarget = params.graduationTarget;
        }

        if (params.creatorFeeBps > MAX_CREATOR_FEE_BPS) {
            revert InvalidParams();
        }
        creatorFeeBps = params.creatorFeeBps;

        if (params.creatorPostGradFeeBps > MAX_CREATOR_POST_GRAD_FEE_BPS) {
            revert InvalidParams();
        }
        creatorPostGradFeeBps = params.creatorPostGradFeeBps;

        // Set quote token (address(0) = native)
        quoteToken = params.quoteToken;

        creator = creator_;
        BondingCurveToken newToken = new BondingCurveToken(name, symbol, metadataURI, address(this));
        token = address(newToken);
    }

    function state() external view override returns (CurveState memory) {
        return CurveState({
            virtualQuote: virtualQuote,
            virtualTokens: virtualTokens,
            realQuoteRaised: realQuoteRaised,
            tokensSold: tokensSold,
            graduated: graduated,
            pair: pair
        });
    }

    function getCurrentPrice() public view override returns (uint256) {
        if (virtualTokens == 0) return type(uint256).max;
        return (virtualQuote * 1e18) / virtualTokens;
    }

    function getProgress() public view override returns (uint256) {
        if (graduated) return 10000;
        if (realQuoteRaised >= graduationTarget) return 10000;
        return (realQuoteRaised * 10000) / graduationTarget;
    }

    function getBuyQuote(uint256 quoteIn) public view override returns (uint256 tokensOut, uint256 protocolFee, uint256 creatorFee) {
        if (graduated || quoteIn == 0) return (0, 0, 0);

        protocolFee = (quoteIn * PROTOCOL_FEE_BPS) / 10000;
        creatorFee = (quoteIn * creatorFeeBps) / 10000;
        uint256 quoteAfterFee = quoteIn - protocolFee - creatorFee;

        uint256 k = virtualQuote * virtualTokens;
        uint256 newVirtualTokens = k / (virtualQuote + quoteAfterFee);
        tokensOut = virtualTokens - newVirtualTokens;

        if (tokensOut > virtualTokens) {
            tokensOut = virtualTokens;
        }
    }

    function getSellQuote(uint256 tokensIn) public view override returns (uint256 quoteOut, uint256 protocolFee, uint256 creatorFee) {
        if (graduated || tokensIn == 0) return (0, 0, 0);

        uint256 k = virtualQuote * virtualTokens;
        uint256 newVirtualQuote = k / (virtualTokens + tokensIn);
        uint256 grossQuoteOut = virtualQuote - newVirtualQuote;

        if (grossQuoteOut > realQuoteRaised) {
            grossQuoteOut = realQuoteRaised;
        }

        protocolFee = (grossQuoteOut * PROTOCOL_FEE_BPS) / 10000;
        creatorFee = (grossQuoteOut * creatorFeeBps) / 10000;
        quoteOut = grossQuoteOut - protocolFee - creatorFee;
    }

    /// @notice Buy tokens with native value (msg.value)
    function buy(uint256 minTokensOut)
        external
        payable
        override
        nonReentrant
        whenInitialized
        whenNotGraduated
        returns (uint256 tokensOut)
    {
        if (quoteToken != address(0)) revert WrongQuoteMode();
        if (msg.value == 0) revert ZeroAmount();

        tokensOut = _executeBuy(msg.value, minTokensOut);
    }

    /// @notice Buy tokens with ERC-20 quote token (requires approval)
    function buyWithToken(uint256 quoteAmount, uint256 minTokensOut)
        external
        override
        nonReentrant
        whenInitialized
        whenNotGraduated
        returns (uint256 tokensOut)
    {
        if (quoteToken == address(0)) revert WrongQuoteMode();
        if (quoteAmount == 0) revert ZeroAmount();

        // Transfer quote tokens from buyer
        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), quoteAmount);

        tokensOut = _executeBuy(quoteAmount, minTokensOut);
    }

    function _executeBuy(uint256 quoteIn, uint256 minTokensOut) internal returns (uint256 tokensOut) {
        uint256 protocolFee;
        uint256 creatorFee;
        (tokensOut, protocolFee, creatorFee) = getBuyQuote(quoteIn);

        if (tokensOut < minTokensOut) revert SlippageExceeded();
        if (tokensOut == 0) revert ZeroAmount();

        uint256 quoteAfterFee = quoteIn - protocolFee - creatorFee;
        virtualQuote += quoteAfterFee;
        virtualTokens -= tokensOut;
        realQuoteRaised += quoteAfterFee;
        tokensSold += tokensOut;
        creatorFeesAccrued += creatorFee;

        // Transfer protocol fee to Olympus treasury
        if (protocolFee > 0) {
            address feeRecipient = ILaunchpadFactory(factory).feeRecipient();
            _transferQuote(feeRecipient, protocolFee);
        }

        // Mint tokens to buyer
        IBondingCurveToken(token).mint(msg.sender, tokensOut);

        emit TokensPurchased(msg.sender, quoteIn, tokensOut, protocolFee + creatorFee, getCurrentPrice());

        // Check graduation
        if (realQuoteRaised >= graduationTarget) {
            _graduate();
        }
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut)
        external
        override
        nonReentrant
        whenInitialized
        whenNotGraduated
        returns (uint256 quoteOut)
    {
        if (tokensIn == 0) revert ZeroAmount();

        uint256 protocolFee;
        uint256 creatorFee;
        (quoteOut, protocolFee, creatorFee) = getSellQuote(tokensIn);

        if (quoteOut < minQuoteOut) revert SlippageExceeded();
        if (quoteOut == 0) revert ZeroAmount();

        if (IBondingCurveToken(token).balanceOf(msg.sender) < tokensIn) {
            revert InsufficientTokens();
        }

        uint256 totalDeducted = quoteOut + protocolFee + creatorFee;
        virtualQuote -= totalDeducted;
        virtualTokens += tokensIn;
        realQuoteRaised -= totalDeducted;
        creatorFeesAccrued += creatorFee;

        // Burn tokens from seller
        IBondingCurveToken(token).burn(msg.sender, tokensIn);

        // Transfer quote to seller
        _transferQuote(msg.sender, quoteOut);

        // Transfer protocol fee to Olympus treasury
        if (protocolFee > 0) {
            address feeRecipient = ILaunchpadFactory(factory).feeRecipient();
            _transferQuote(feeRecipient, protocolFee);
        }

        emit TokensSold(msg.sender, tokensIn, quoteOut, protocolFee + creatorFee, getCurrentPrice());
    }

    function claimCreatorFees() external nonReentrant {
        if (msg.sender != creator) revert OnlyCreator();

        uint256 claimable = creatorFeesAccrued - creatorFeesClaimed;
        if (claimable == 0) revert NoFeesToClaim();

        creatorFeesClaimed = creatorFeesAccrued;
        _transferQuote(creator, claimable);

        emit CreatorFeesClaimed(creator, claimable);
    }

    function getClaimableCreatorFees() external view returns (uint256) {
        return creatorFeesAccrued - creatorFeesClaimed;
    }

    /**
     * @notice Accrue post-grad creator fees sent by SimplePair (quote denomination)
     * @dev Only callable by the graduated pair; funds must already be on this contract
     */
    function notifyPostGradCreatorFee(uint256 amount) external {
        if (msg.sender != pair) revert OnlyPair();
        if (amount == 0) return;
        creatorFeesAccrued += amount;
    }

    function _transferQuote(address to, uint256 amount) internal {
        if (quoteToken == address(0)) {
            (bool success,) = to.call{ value: amount }("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(quoteToken).safeTransfer(to, amount);
        }
    }

    function _graduate() internal {
        graduated = true;

        uint256 unsoldTokens = CURVE_SUPPLY - tokensSold;
        IBondingCurveToken(token).mint(address(this), LP_SUPPLY + unsoldTokens);

        address pairAddr = ILaunchpadFactory(factory).deployPair(token, realQuoteRaised);
        pair = pairAddr;

        uint256 lpTokens = LP_SUPPLY + unsoldTokens;
        IBondingCurveToken(token).transfer(pairAddr, lpTokens);

        if (quoteToken == address(0)) {
            (bool success,) = pairAddr.call{ value: realQuoteRaised }("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(quoteToken).safeTransfer(pairAddr, realQuoteRaised);
        }

        ISimplePair(pairAddr).sync();
        ILaunchpadFactory(factory).markGraduated(token, pairAddr);

        emit Graduated(token, pairAddr, realQuoteRaised);
    }

    receive() external payable { }
}
