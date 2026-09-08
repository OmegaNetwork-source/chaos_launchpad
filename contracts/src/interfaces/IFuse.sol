// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBondingCurveToken is IERC20 {
    function metadataURI() external view returns (string memory);
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function curve() external view returns (address);
}

/**
 * @notice Parameters for configuring a bonding curve at creation time
 * @dev All parameters have safe bounds enforced by the BondingCurve contract
 */
struct CurveParams {
    uint256 virtualQuote;           // Initial virtual quote reserve (5-1000 quote tokens, 18 decimals)
    uint256 graduationTarget;       // Quote target for graduation (5-10000 quote tokens, 18 decimals)
    uint256 creatorFeeBps;          // Curve creator fee in basis points (0-100 bps, i.e. 0-1%)
    address quoteToken;             // Quote token address (address(0) = native, otherwise ERC-20)
    uint256 creatorPostGradFeeBps;  // Post-grad AMM creator fee (0-25 bps); default 0 (opt-in)
}

interface IBondingCurve {
    struct CurveState {
        uint256 virtualQuote;
        uint256 virtualTokens;
        uint256 realQuoteRaised;
        uint256 tokensSold;
        bool graduated;
        address pair;
    }

    event TokensPurchased(
        address indexed buyer,
        uint256 quoteIn,
        uint256 tokensOut,
        uint256 fee,
        uint256 newPrice
    );
    event TokensSold(
        address indexed seller,
        uint256 tokensIn,
        uint256 quoteOut,
        uint256 fee,
        uint256 newPrice
    );
    event Graduated(address indexed token, address indexed pair, uint256 liquidity);

    function token() external view returns (address);
    function factory() external view returns (address);
    function creator() external view returns (address);
    function quoteToken() external view returns (address);
    function state() external view returns (CurveState memory);
    function getCurrentPrice() external view returns (uint256);
    function getProgress() external view returns (uint256);
    function getBuyQuote(uint256 quoteIn) external view returns (uint256 tokensOut, uint256 protocolFee, uint256 creatorFee);
    function getSellQuote(uint256 tokensIn) external view returns (uint256 quoteOut, uint256 protocolFee, uint256 creatorFee);
    function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut);
    function buyWithToken(uint256 quoteAmount, uint256 minTokensOut) external returns (uint256 tokensOut);
    function sell(uint256 tokensIn, uint256 minQuoteOut) external returns (uint256 quoteOut);
    function claimCreatorFees() external;
    function getClaimableCreatorFees() external view returns (uint256);
    function creatorFeesAccrued() external view returns (uint256);
    function creatorFeesClaimed() external view returns (uint256);
    function graduationTarget() external view returns (uint256);
    function creatorFeeBps() external view returns (uint256);
    function creatorPostGradFeeBps() external view returns (uint256);
    function notifyPostGradCreatorFee(uint256 amount) external;
}

interface ILaunchpadFactory {
    struct TokenInfo {
        address token;
        address curve;
        string name;
        string symbol;
        string metadataURI;
        address creator;
        uint256 createdAt;
        bool graduated;
        address quoteToken;
    }

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        address quoteToken
    );
    event TokenGraduated(address indexed token, address indexed pair);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    function createToken(string memory name, string memory symbol, string memory metadataURI)
        external
        returns (address token, address curve);
    
    function createTokenWithParams(
        string memory name,
        string memory symbol,
        string memory metadataURI,
        CurveParams memory params
    ) external returns (address token, address curve);
    
    function deployPair(address tokenAddr, uint256 initialQuote) external returns (address pair);
    function markGraduated(address tokenAddr, address pairAddr) external;
    function getToken(address tokenAddr) external view returns (TokenInfo memory);
    function getAllTokens() external view returns (address[] memory);
    function getTokenCount() external view returns (uint256);
    function feeRecipient() external view returns (address);
    function defaultParams() external view returns (CurveParams memory);
}

interface ISimplePair {
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Sync(uint112 reserve0, uint112 reserve1);
    event FeesSkimmed(uint256 protocolFee, uint256 creatorFee, bool tokenInput);

    function token0() external view returns (address);
    function quoteToken() external view returns (address);
    function creator() external view returns (address);
    function creatorPostGradFeeBps() external view returns (uint256);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external payable;
    function sync() external;
    function getAmountOut(uint256 amountIn, bool tokenToQuote) external view returns (uint256 amountOut);
}
