// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/LaunchpadFactory.sol";
import "../src/BondingCurve.sol";
import "../src/BondingCurveToken.sol";
import "../src/SimplePair.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 for testing ERC-20 quote mode
contract MockQuoteToken is ERC20 {
    constructor() ERC20("Mock Quote", "MQUOTE") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FuseTest is Test {
    LaunchpadFactory public factory;
    MockQuoteToken public mockQuote;
    address public olympusTreasury;
    address public alice;
    address public bob;

    uint256 constant PROTOCOL_FEE_BPS = 100;
    uint256 constant CREATOR_FEE_BPS = 30;
    uint256 constant TOTAL_FEE_BPS = 130;
    uint256 constant INITIAL_BALANCE = 1000 ether;

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        address quoteToken
    );
    event TokensPurchased(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 newPrice);
    event TokensSold(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 newPrice);
    event Graduated(address indexed token, address indexed pair, uint256 liquidity);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);

    function setUp() public {
        olympusTreasury = 0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41;
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        factory = new LaunchpadFactory();
        mockQuote = new MockQuoteToken();

        vm.deal(alice, INITIAL_BALANCE);
        vm.deal(bob, INITIAL_BALANCE);
        mockQuote.mint(alice, INITIAL_BALANCE);
        mockQuote.mint(bob, INITIAL_BALANCE);
    }

    function test_FactoryDeployment() public view {
        assertEq(factory.feeRecipient(), olympusTreasury);
        assertEq(factory.getTokenCount(), 0);
    }

    function test_CreateToken() public {
        vm.prank(alice);
        (address token, address curve) = factory.createToken("Test Meme", "TMEME", "https://example.com/meta.json");

        assertEq(factory.getTokenCount(), 1);
        assertEq(factory.tokenToCurve(token), curve);

        ILaunchpadFactory.TokenInfo memory info = factory.getToken(token);
        assertEq(info.name, "Test Meme");
        assertEq(info.symbol, "TMEME");
        assertEq(info.creator, alice);
        assertEq(info.quoteToken, address(0)); // Native quote
        assertFalse(info.graduated);

        BondingCurve curveContract = BondingCurve(payable(curve));
        assertEq(curveContract.creator(), alice);
        assertEq(curveContract.quoteToken(), address(0));
    }

    function test_BuyTokensNative() public {
        vm.prank(alice);
        (address token, address curve) = factory.createToken("Buy Test", "BUY", "");

        BondingCurve curveContract = BondingCurve(payable(curve));
        BondingCurveToken tokenContract = BondingCurveToken(token);

        uint256 buyAmount = 10 ether;
        (uint256 expectedTokens, uint256 protocolFee, uint256 creatorFee) = curveContract.getBuyQuote(buyAmount);

        uint256 aliceBalanceBefore = alice.balance;
        uint256 olympusBalanceBefore = olympusTreasury.balance;

        vm.prank(alice);
        uint256 tokensReceived = curveContract.buy{ value: buyAmount }(0);

        assertEq(tokensReceived, expectedTokens);
        assertEq(tokenContract.balanceOf(alice), tokensReceived);
        assertEq(alice.balance, aliceBalanceBefore - buyAmount);
        assertEq(olympusTreasury.balance, olympusBalanceBefore + protocolFee);
        assertEq(curveContract.creatorFeesAccrued(), creatorFee);
    }

    // =========== ERC-20 Quote Token Tests ===========

    function test_CreateTokenWithERC20Quote() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(mockQuote),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (address token, address curve) = factory.createTokenWithParams("ERC20 Quote", "ERC20Q", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        assertEq(curveContract.quoteToken(), address(mockQuote));

        ILaunchpadFactory.TokenInfo memory info = factory.getToken(token);
        assertEq(info.quoteToken, address(mockQuote));
    }

    function test_BuyWithERC20Quote() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(mockQuote),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (address token, address curve) = factory.createTokenWithParams("ERC20 Buy", "ERC20B", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        BondingCurveToken tokenContract = BondingCurveToken(token);

        uint256 buyAmount = 10e18;
        (uint256 expectedTokens, uint256 protocolFee,) = curveContract.getBuyQuote(buyAmount);

        uint256 olympusQuoteBefore = mockQuote.balanceOf(olympusTreasury);

        // Approve and buy
        vm.startPrank(bob);
        mockQuote.approve(curve, buyAmount);
        uint256 tokensReceived = curveContract.buyWithToken(buyAmount, 0);
        vm.stopPrank();

        assertEq(tokensReceived, expectedTokens);
        assertEq(tokenContract.balanceOf(bob), tokensReceived);
        assertEq(mockQuote.balanceOf(olympusTreasury) - olympusQuoteBefore, protocolFee);
    }

    function test_RevertBuyNativeOnERC20Curve() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(mockQuote),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address curve) = factory.createTokenWithParams("ERC20 Only", "ERC20O", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));

        vm.prank(bob);
        vm.expectRevert(BondingCurve.WrongQuoteMode.selector);
        curveContract.buy{ value: 10 ether }(0);
    }

    function test_RevertBuyWithTokenOnNativeCurve() public {
        vm.prank(alice);
        (, address curve) = factory.createToken("Native Only", "NATIV", "");

        BondingCurve curveContract = BondingCurve(payable(curve));

        vm.prank(bob);
        vm.expectRevert(BondingCurve.WrongQuoteMode.selector);
        curveContract.buyWithToken(10e18, 0);
    }

    // =========== Graduation Range Tests ($5-$10k) ===========

    function test_GraduationRangeMin5() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 5e18,
            graduationTarget: 5e18, // Minimum $5
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address curve) = factory.createTokenWithParams("Min Grad", "MGRAD", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        assertEq(curveContract.graduationTarget(), 5e18);

        // Buy enough to graduate
        vm.prank(alice);
        curveContract.buy{ value: 10 ether }(0);

        assertTrue(curveContract.graduated());
    }

    function test_GraduationRangeMax10k() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 100e18,
            graduationTarget: 10000e18, // Maximum $10k
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address curve) = factory.createTokenWithParams("Max Grad", "XGRAD", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        assertEq(curveContract.graduationTarget(), 10000e18);

        // Buy should not graduate with small amount
        vm.deal(alice, 20000 ether);
        vm.prank(alice);
        curveContract.buy{ value: 5000 ether }(0);

        assertFalse(curveContract.graduated());
    }

    function test_RevertOnTooLowGraduationTarget() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 4e18, // Below min $5
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        vm.expectRevert(BondingCurve.InvalidParams.selector);
        factory.createTokenWithParams("Low Grad", "LGRAD", "", params);
    }

    function test_RevertOnTooHighGraduationTarget() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 10001e18, // Above max $10k
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        vm.expectRevert(BondingCurve.InvalidParams.selector);
        factory.createTokenWithParams("High Grad", "HGRAD", "", params);
    }

    // =========== Existing Tests (updated for new interface) ===========

    function test_ProtocolFeeGoesToOlympus() public {
        vm.prank(alice);
        (, address curve) = factory.createToken("Fee Test", "FEE", "");

        BondingCurve curveContract = BondingCurve(payable(curve));

        uint256 buyAmount = 100 ether;
        (,uint256 expectedProtocolFee,) = curveContract.getBuyQuote(buyAmount);

        uint256 olympusBalanceBefore = olympusTreasury.balance;

        vm.prank(alice);
        curveContract.buy{ value: buyAmount }(0);

        assertEq(olympusTreasury.balance - olympusBalanceBefore, expectedProtocolFee);
    }

    function test_CreatorFeeAccruesAndClaimable() public {
        vm.prank(alice);
        (, address curve) = factory.createToken("Creator Fee Test", "CFT", "");

        BondingCurve curveContract = BondingCurve(payable(curve));

        uint256 buyAmount = 100 ether;
        (,, uint256 expectedCreatorFee) = curveContract.getBuyQuote(buyAmount);

        vm.prank(bob);
        curveContract.buy{ value: buyAmount }(0);

        assertEq(curveContract.creatorFeesAccrued(), expectedCreatorFee);

        uint256 aliceBalanceBefore = alice.balance;

        vm.prank(alice);
        curveContract.claimCreatorFees();

        assertEq(alice.balance, aliceBalanceBefore + expectedCreatorFee);
    }

    function test_SellTokensNative() public {
        vm.startPrank(alice);
        (, address curve) = factory.createToken("Sell Test", "SELL", "");

        BondingCurve curveContract = BondingCurve(payable(curve));

        uint256 tokensReceived = curveContract.buy{ value: 10 ether }(0);
        uint256 sellAmount = tokensReceived / 2;
        (uint256 expectedQuote,,) = curveContract.getSellQuote(sellAmount);

        uint256 balanceBefore = alice.balance;
        uint256 quoteReceived = curveContract.sell(sellAmount, 0);

        assertEq(quoteReceived, expectedQuote);
        assertEq(alice.balance, balanceBefore + quoteReceived);
        vm.stopPrank();
    }

    function test_SlippageProtection() public {
        vm.prank(alice);
        (, address curve) = factory.createToken("Slip Test", "SLIP", "");

        BondingCurve curveContract = BondingCurve(payable(curve));

        (uint256 expectedTokens,,) = curveContract.getBuyQuote(10 ether);

        vm.prank(alice);
        vm.expectRevert(BondingCurve.SlippageExceeded.selector);
        curveContract.buy{ value: 10 ether }(expectedTokens + 1);
    }

    function test_Graduation() public {
        vm.prank(alice);
        (address token, address curve) = factory.createToken("Grad Test", "GRAD", "");

        BondingCurve curveContract = BondingCurve(payable(curve));

        vm.deal(alice, 200 ether);

        vm.prank(alice);
        curveContract.buy{ value: 120 ether }(0);

        IBondingCurve.CurveState memory state = curveContract.state();
        assertTrue(state.graduated);
        assertTrue(state.pair != address(0));
    }

    function test_DefaultParamsReturnsCorrectValues() public view {
        CurveParams memory defaults = factory.defaultParams();
        assertEq(defaults.virtualQuote, 30e18);
        assertEq(defaults.graduationTarget, 100e18);
        assertEq(defaults.creatorFeeBps, 30);
        assertEq(defaults.quoteToken, address(0));
        assertEq(defaults.creatorPostGradFeeBps, 0);
    }

    function test_VirtualQuoteRange() public {
        // Min: 5
        CurveParams memory minParams = CurveParams({
            virtualQuote: 5e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address minCurve) = factory.createTokenWithParams("Min VQ", "MINVQ", "", minParams);
        assertEq(BondingCurve(payable(minCurve)).virtualQuote(), 5e18);

        // Max: 1000
        CurveParams memory maxParams = CurveParams({
            virtualQuote: 1000e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address maxCurve) = factory.createTokenWithParams("Max VQ", "MAXVQ", "", maxParams);
        assertEq(BondingCurve(payable(maxCurve)).virtualQuote(), 1000e18);
    }

    function test_RevertOnTooLowVirtualQuote() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 4e18, // Below min 5
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        vm.expectRevert(BondingCurve.InvalidParams.selector);
        factory.createTokenWithParams("Low VQ", "LVQ", "", params);
    }

    function test_RevertOnTooHighVirtualQuote() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 1001e18, // Above max 1000
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        vm.expectRevert(BondingCurve.InvalidParams.selector);
        factory.createTokenWithParams("High VQ", "HVQ", "", params);
    }

    // =========== Post-grad SimplePair swap fee tests ===========

    function _graduateNative(address creator_, uint256 postGradFeeBps)
        internal
        returns (address token, address curve, address pair)
    {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: postGradFeeBps
        });

        vm.prank(creator_);
        (token, curve) = factory.createTokenWithParams("Swap Grad", "SGRAD", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        vm.deal(creator_, 500 ether);
        vm.prank(creator_);
        curveContract.buy{ value: 120 ether }(0);

        IBondingCurve.CurveState memory st = curveContract.state();
        assertTrue(st.graduated);
        pair = st.pair;
    }

    function test_PostGradSwap_ProtocolFeeSkimmed_QuoteIn() public {
        (address token, address curve, address pair) = _graduateNative(alice, 0);
        SimplePair pairContract = SimplePair(payable(pair));

        (uint112 r0, uint112 r1,) = pairContract.getReserves();
        assertTrue(r0 > 0 && r1 > 0);

        uint256 amountIn = 1 ether;
        uint256 amountOut = pairContract.getAmountOut(amountIn, false); // quote -> token
        assertTrue(amountOut > 0);

        uint256 olympusBefore = olympusTreasury.balance;
        uint256 expectedProtocolFee = (amountIn * 25) / 10000;

        vm.prank(bob);
        pairContract.swap{ value: amountIn }(amountOut, 0, bob);

        assertEq(olympusTreasury.balance - olympusBefore, expectedProtocolFee);
        assertEq(BondingCurveToken(token).balanceOf(bob), amountOut);

        // K preserved (non-decreasing after fee skim)
        (uint112 r0After, uint112 r1After,) = pairContract.getReserves();
        assertTrue(uint256(r0After) * uint256(r1After) >= uint256(r0) * uint256(r1));
        curve; // silence
    }

    function test_PostGradSwap_CreatorFeeAccruesOnCurve_QuoteIn() public {
        (, address curve, address pair) = _graduateNative(alice, 25); // max 25 bps
        SimplePair pairContract = SimplePair(payable(pair));
        BondingCurve curveContract = BondingCurve(payable(curve));

        uint256 accruedBefore = curveContract.creatorFeesAccrued();
        uint256 amountIn = 2 ether;
        uint256 amountOut = pairContract.getAmountOut(amountIn, false);
        uint256 expectedCreatorFee = (amountIn * 25) / 10000;
        uint256 expectedProtocolFee = (amountIn * 25) / 10000;

        uint256 olympusBefore = olympusTreasury.balance;

        vm.prank(bob);
        pairContract.swap{ value: amountIn }(amountOut, 0, bob);

        assertEq(olympusTreasury.balance - olympusBefore, expectedProtocolFee);
        assertEq(curveContract.creatorFeesAccrued() - accruedBefore, expectedCreatorFee);

        // Creator can claim via same curve path
        uint256 claimable = curveContract.getClaimableCreatorFees();
        assertTrue(claimable >= expectedCreatorFee);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        curveContract.claimCreatorFees();
        assertEq(alice.balance, aliceBefore + claimable);
    }

    function test_PostGradSwap_TokenIn_ProtocolAndCreatorDirect() public {
        (address token, , address pair) = _graduateNative(alice, 10);
        SimplePair pairContract = SimplePair(payable(pair));
        BondingCurveToken tokenContract = BondingCurveToken(token);

        // Fund bob with tokens via another quote buy first is hard post-grad;
        // transfer some LP-adjacent tokens: buy before grad by using alice's tokens
        // Alice bought during graduation — take some of alice's tokens
        uint256 aliceTokens = tokenContract.balanceOf(alice);
        assertTrue(aliceTokens > 0);
        uint256 sellAmount = aliceTokens / 10;
        vm.prank(alice);
        tokenContract.transfer(bob, sellAmount);

        uint256 amountOut = pairContract.getAmountOut(sellAmount, true); // token -> quote
        // Match SimplePair._skimFees rounding: total fee first, then split
        uint256 totalFee = (sellAmount * 35) / 10000;
        uint256 expectedProtocolFee = (sellAmount * 25) / 10000;
        if (expectedProtocolFee > totalFee) expectedProtocolFee = totalFee;
        uint256 expectedCreatorFee = totalFee - expectedProtocolFee;

        uint256 olympusTokenBefore = tokenContract.balanceOf(olympusTreasury);
        uint256 aliceTokenBefore = tokenContract.balanceOf(alice);
        uint256 bobQuoteBefore = bob.balance;

        vm.startPrank(bob);
        tokenContract.transfer(pair, sellAmount);
        pairContract.swap(0, amountOut, bob);
        vm.stopPrank();

        assertEq(tokenContract.balanceOf(olympusTreasury) - olympusTokenBefore, expectedProtocolFee);
        assertEq(tokenContract.balanceOf(alice) - aliceTokenBefore, expectedCreatorFee);
        assertEq(bob.balance - bobQuoteBefore, amountOut);
    }

    function test_PostGradSwap_GetAmountOutReflectsFees() public {
        (, , address pair) = _graduateNative(alice, 25);
        SimplePair pairContract = SimplePair(payable(pair));

        (uint112 r0, uint112 r1,) = pairContract.getReserves();
        uint256 amountIn = 1 ether;

        // With 25 + 25 = 50 bps total fee
        uint256 afterFee = amountIn - (amountIn * 50) / 10000;
        uint256 expected = (afterFee * uint256(r0)) / (uint256(r1) + afterFee);
        assertEq(pairContract.getAmountOut(amountIn, false), expected);

        // Zero creator fee pair
        (, , address pair0) = _graduateNative(bob, 0);
        SimplePair p0 = SimplePair(payable(pair0));
        (uint112 a0, uint112 a1,) = p0.getReserves();
        uint256 afterFee0 = amountIn - (amountIn * 25) / 10000;
        uint256 expected0 = (afterFee0 * uint256(a0)) / (uint256(a1) + afterFee0);
        assertEq(p0.getAmountOut(amountIn, false), expected0);
    }

    function test_PostGradCreatorFee_DefaultsToZero() public {
        vm.prank(alice);
        (, address curve) = factory.createToken("No PostGrad", "NPG", "");
        assertEq(BondingCurve(payable(curve)).creatorPostGradFeeBps(), 0);
    }

    function test_RevertOnTooHighPostGradCreatorFee() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(0),
            creatorPostGradFeeBps: 26
        });
        vm.prank(alice);
        vm.expectRevert(BondingCurve.InvalidParams.selector);
        factory.createTokenWithParams("Bad Fee", "BAD", "", params);
    }
}
