// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IFuse.sol";
import "./BondingCurve.sol";
import "./SimplePair.sol";

/**
 * @title LaunchpadFactory
 * @notice Factory contract for creating memecoin bonding curves on Fuse
 * @dev Deploys BondingCurve + BondingCurveToken pairs and manages protocol fees
 *
 * ## Quote Tokens
 * - Supports native value (USDC on Arc, zkLTC on LitVM) as default
 * - Also supports ERC-20 quote tokens for "paired with" functionality
 *
 * ## Fee Structure
 * - Curve protocol fee: 1.00% (100 bps) → Olympus treasury (fixed)
 * - Curve creator fee: 0-1.00% (0-100 bps) → Creator vault (configurable)
 * - Post-grad protocol fee: 0.25% (25 bps) of swap input → feeRecipient
 * - Post-grad creator fee: 0-0.25% (0-25 bps, default 0 / opt-in)
 *
 * ## Configurable Curve Parameters (at creation time)
 * - virtualQuote: 5-1000 (affects starting price/liquidity depth)
 * - graduationTarget: 5-10000 (when token graduates to DEX)
 * - creatorFeeBps: 0-100 bps (creator's curve fee percentage)
 * - quoteToken: address(0) for native, or ERC-20 address
 * - creatorPostGradFeeBps: 0-25 bps post-grad AMM creator fee (default 0)
 */
contract LaunchpadFactory is ILaunchpadFactory, Ownable, Pausable {
    /// @notice Olympus platform treasury for protocol fees
    address public constant OLYMPUS_TREASURY = 0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41;

    address public feeRecipient;

    address[] private _allTokens;
    mapping(address => TokenInfo) private _tokenInfo;
    mapping(address => address) public tokenToCurve;
    mapping(address => address) public curveToToken;

    error InvalidAddress();
    error TokenNotFound();
    error OnlyCurve();

    constructor() Ownable(msg.sender) {
        feeRecipient = OLYMPUS_TREASURY;
    }

    /**
     * @notice Get default curve parameters
     */
    function defaultParams() external pure override returns (CurveParams memory) {
        return CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0), // native by default
            creatorPostGradFeeBps: 0 // opt-in; disclosed to traders after graduation
        });
    }

    /**
     * @notice Create a new memecoin with bonding curve (default parameters, native quote)
     */
    function createToken(string memory name, string memory symbol, string memory metadataURI)
        external
        override
        whenNotPaused
        returns (address tokenAddr, address curveAddr)
    {
        BondingCurve curve = new BondingCurve(address(this));
        curveAddr = address(curve);

        curve.initialize(name, symbol, metadataURI, msg.sender);
        tokenAddr = curve.token();

        _registerToken(tokenAddr, curveAddr, name, symbol, metadataURI, msg.sender, address(0));
    }

    /**
     * @notice Create a new memecoin with custom bonding curve parameters
     * @param params Custom curve parameters including quoteToken
     */
    function createTokenWithParams(
        string memory name,
        string memory symbol,
        string memory metadataURI,
        CurveParams memory params
    )
        external
        override
        whenNotPaused
        returns (address tokenAddr, address curveAddr)
    {
        BondingCurve curve = new BondingCurve(address(this));
        curveAddr = address(curve);

        curve.initializeWithParams(name, symbol, metadataURI, msg.sender, params);
        tokenAddr = curve.token();

        _registerToken(tokenAddr, curveAddr, name, symbol, metadataURI, msg.sender, params.quoteToken);
    }

    function _registerToken(
        address tokenAddr,
        address curveAddr,
        string memory name,
        string memory symbol,
        string memory metadataURI,
        address creator,
        address quoteToken
    ) internal {
        _allTokens.push(tokenAddr);
        tokenToCurve[tokenAddr] = curveAddr;
        curveToToken[curveAddr] = tokenAddr;

        _tokenInfo[tokenAddr] = TokenInfo({
            token: tokenAddr,
            curve: curveAddr,
            name: name,
            symbol: symbol,
            metadataURI: metadataURI,
            creator: creator,
            createdAt: block.timestamp,
            graduated: false,
            quoteToken: quoteToken
        });

        emit TokenCreated(tokenAddr, curveAddr, creator, name, symbol, metadataURI, quoteToken);
    }

    /**
     * @notice Deploy a SimplePair for a graduated token
     * @dev Only callable by BondingCurve contracts
     */
    function deployPair(address tokenAddr, uint256)
        external
        override
        returns (address pairAddr)
    {
        if (curveToToken[msg.sender] != tokenAddr) revert OnlyCurve();

        BondingCurve curve = BondingCurve(payable(msg.sender));
        SimplePair pair = new SimplePair(
            tokenAddr,
            address(this),
            msg.sender,
            curve.creator(),
            curve.creatorPostGradFeeBps(),
            curve.quoteToken()
        );
        pairAddr = address(pair);
    }

    /**
     * @notice Mark a token as graduated
     * @dev Only callable by BondingCurve contracts
     */
    function markGraduated(address tokenAddr, address pairAddr) external override {
        if (curveToToken[msg.sender] != tokenAddr) revert OnlyCurve();

        _tokenInfo[tokenAddr].graduated = true;
        emit TokenGraduated(tokenAddr, pairAddr);
    }

    function getToken(address tokenAddr) external view override returns (TokenInfo memory) {
        if (_tokenInfo[tokenAddr].token == address(0)) revert TokenNotFound();
        return _tokenInfo[tokenAddr];
    }

    function getAllTokens() external view override returns (address[] memory) {
        return _allTokens;
    }

    function getTokenCount() external view override returns (uint256) {
        return _allTokens.length;
    }

    function getTokensPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory tokens, uint256 total)
    {
        total = _allTokens.length;
        if (offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 length = end - offset;
        tokens = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            tokens[i] = _allTokens[total - 1 - offset - i];
        }
    }

    /**
     * @notice Update fee recipient (Olympus treasury)
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        address old = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(old, _feeRecipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
