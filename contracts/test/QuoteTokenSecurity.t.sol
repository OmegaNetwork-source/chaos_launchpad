// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/LaunchpadFactory.sol";
import "../src/BondingCurve.sol";
import "../src/BondingCurveToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title NoOpERC20
 * @notice Malicious ERC20 that claims to transfer but doesn't move any tokens
 * @dev Used to test the balance delta security fix
 */
contract NoOpERC20 is ERC20 {
    constructor() ERC20("NoOp Token", "NOOP") {
        _mint(msg.sender, 1_000_000e18);
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        return true;
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return true;
    }
}

/**
 * @title FeeOnTransferERC20
 * @notice ERC20 that takes a 10% fee on transfers (common pattern)
 * @dev Used to test that balance delta accounting handles fee-on-transfer tokens
 */
contract FeeOnTransferERC20 is ERC20 {
    uint256 public constant FEE_BPS = 1000; // 10%

    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * FEE_BPS) / 10000;
        uint256 amountAfterFee = amount - fee;

        _spendAllowance(from, _msgSender(), amount);
        _transfer(from, to, amountAfterFee);
        _burn(from, fee);

        return true;
    }
}

/**
 * @title HonestERC20
 * @notice Standard ERC20 for comparison tests
 */
contract HonestERC20 is ERC20 {
    constructor() ERC20("Honest Token", "HONEST") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract QuoteTokenSecurityTest is Test {
    LaunchpadFactory public factory;
    NoOpERC20 public noOpToken;
    FeeOnTransferERC20 public feeToken;
    HonestERC20 public honestToken;
    address public owner;
    address public alice;
    address public bob;

    event QuoteTokenAllowlistUpdated(address indexed token, bool allowed);

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        factory = new LaunchpadFactory();
        noOpToken = new NoOpERC20();
        feeToken = new FeeOnTransferERC20();
        honestToken = new HonestERC20();

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);

        honestToken.mint(alice, 1000e18);
        honestToken.mint(bob, 1000e18);
        feeToken.mint(alice, 1000e18);
        feeToken.mint(bob, 1000e18);
    }

    // =========== Quote Token Allowlist Tests ===========

    function test_NativeIsAllowlistedByDefault() public view {
        assertTrue(factory.isQuoteTokenAllowed(address(0)));
        assertTrue(factory.allowedQuoteTokens(address(0)));
    }

    function test_NonAllowlistedQuoteReverts() public {
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken), // Not allowlisted
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        vm.expectRevert(LaunchpadFactory.QuoteTokenNotAllowed.selector);
        factory.createTokenWithParams("Test", "TEST", "", params);
    }

    function test_OnlyOwnerCanAllowlistQuoteToken() public {
        vm.prank(alice); // Not owner
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        factory.setQuoteTokenAllowed(address(honestToken), true);

        // Owner can allowlist
        factory.setQuoteTokenAllowed(address(honestToken), true);
        assertTrue(factory.isQuoteTokenAllowed(address(honestToken)));
    }

    function test_AllowlistEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit QuoteTokenAllowlistUpdated(address(honestToken), true);
        factory.setQuoteTokenAllowed(address(honestToken), true);

        vm.expectEmit(true, false, false, true);
        emit QuoteTokenAllowlistUpdated(address(honestToken), false);
        factory.setQuoteTokenAllowed(address(honestToken), false);
    }

    function test_CanCreateCurveWithAllowlistedToken() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);

        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (address token, address curve) = factory.createTokenWithParams("Test", "TEST", "", params);

        assertTrue(token != address(0));
        assertTrue(curve != address(0));
        assertEq(BondingCurve(payable(curve)).quoteToken(), address(honestToken));
    }

    function test_CanRemoveQuoteFromAllowlist() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);
        assertTrue(factory.isQuoteTokenAllowed(address(honestToken)));

        factory.setQuoteTokenAllowed(address(honestToken), false);
        assertFalse(factory.isQuoteTokenAllowed(address(honestToken)));

        // Should revert after removal
        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        vm.expectRevert(LaunchpadFactory.QuoteTokenNotAllowed.selector);
        factory.createTokenWithParams("Test", "TEST", "", params);
    }

    function test_CanDisableNativeQuote() public {
        assertTrue(factory.isQuoteTokenAllowed(address(0)));

        factory.setQuoteTokenAllowed(address(0), false);
        assertFalse(factory.isQuoteTokenAllowed(address(0)));

        // createToken uses native by default, should revert
        vm.prank(alice);
        vm.expectRevert(LaunchpadFactory.QuoteTokenNotAllowed.selector);
        factory.createToken("Test", "TEST", "");
    }

    // =========== Balance Delta Security Tests (No-Op ERC20 Protection) ===========

    function test_NoOpERC20FreeMintFails() public {
        factory.setQuoteTokenAllowed(address(noOpToken), true);

        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(noOpToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address curve) = factory.createTokenWithParams("NoOp Test", "NOOPT", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));

        // Alice "approves" and tries to buy with no-op token
        // The no-op token's transferFrom returns true but doesn't transfer anything
        vm.startPrank(alice);
        noOpToken.approve(curve, 100e18);

        // Should revert because balance delta is 0
        vm.expectRevert(BondingCurve.InsufficientQuoteReceived.selector);
        curveContract.buyWithToken(100e18, 0);
        vm.stopPrank();
    }

    function test_HonestERC20BuyWorksWithDeltaAccounting() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);

        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (address token, address curve) = factory.createTokenWithParams("Honest Test", "HONTT", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        BondingCurveToken tokenContract = BondingCurveToken(token);

        uint256 buyAmount = 10e18;
        (uint256 expectedTokens,,) = curveContract.getBuyQuote(buyAmount);

        vm.startPrank(bob);
        honestToken.approve(curve, buyAmount);
        uint256 tokensReceived = curveContract.buyWithToken(buyAmount, 0);
        vm.stopPrank();

        assertEq(tokensReceived, expectedTokens);
        assertEq(tokenContract.balanceOf(bob), tokensReceived);
        assertTrue(tokensReceived > 0);
    }

    function test_FeeOnTransferTokenUsesActualReceived() public {
        factory.setQuoteTokenAllowed(address(feeToken), true);

        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(feeToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (address token, address curve) = factory.createTokenWithParams("Fee Test", "FEET", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));
        BondingCurveToken tokenContract = BondingCurveToken(token);

        uint256 buyAmount = 100e18;
        uint256 expectedReceived = buyAmount - (buyAmount * 1000) / 10000; // 10% fee = 90e18

        // Get quote for actual received amount (after fee-on-transfer)
        (uint256 expectedTokens,,) = curveContract.getBuyQuote(expectedReceived);

        vm.startPrank(bob);
        feeToken.approve(curve, buyAmount);
        uint256 tokensReceived = curveContract.buyWithToken(buyAmount, 0);
        vm.stopPrank();

        // Tokens received should match quote for actual received (not declared) amount
        assertEq(tokensReceived, expectedTokens);
        assertEq(tokenContract.balanceOf(bob), tokensReceived);

        // realQuoteRaised should reflect actual received amount (minus curve fees)
        // This proves we're using delta accounting, not declared amount
        IBondingCurve.CurveState memory state = curveContract.state();
        assertTrue(state.realQuoteRaised > 0);
        assertTrue(state.realQuoteRaised < buyAmount); // Less than declared due to transfer fee + curve fees
    }

    function test_ZeroAmountStillReverts() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);

        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (, address curve) = factory.createTokenWithParams("Zero Test", "ZERO", "", params);

        BondingCurve curveContract = BondingCurve(payable(curve));

        vm.prank(bob);
        vm.expectRevert(BondingCurve.ZeroAmount.selector);
        curveContract.buyWithToken(0, 0);
    }

    // =========== Integration: Multiple Allowlisted Tokens ===========

    function test_MultipleAllowlistedTokens() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);
        factory.setQuoteTokenAllowed(address(feeToken), true);

        assertTrue(factory.isQuoteTokenAllowed(address(0))); // Native
        assertTrue(factory.isQuoteTokenAllowed(address(honestToken)));
        assertTrue(factory.isQuoteTokenAllowed(address(feeToken)));

        // Create curves with different quote tokens
        CurveParams memory paramsHonest = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken),
            creatorPostGradFeeBps: 0
        });

        CurveParams memory paramsFee = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(feeToken),
            creatorPostGradFeeBps: 0
        });

        vm.startPrank(alice);
        (address tokenA, address curveA) = factory.createTokenWithParams("Token A", "TKNA", "", paramsHonest);
        (address tokenB, address curveB) = factory.createTokenWithParams("Token B", "TKNB", "", paramsFee);
        (address tokenC, address curveC) = factory.createToken("Token C", "TKNC", ""); // Native
        vm.stopPrank();

        assertEq(BondingCurve(payable(curveA)).quoteToken(), address(honestToken));
        assertEq(BondingCurve(payable(curveB)).quoteToken(), address(feeToken));
        assertEq(BondingCurve(payable(curveC)).quoteToken(), address(0));

        assertTrue(tokenA != address(0));
        assertTrue(tokenB != address(0));
        assertTrue(tokenC != address(0));
    }

    // =========== Edge Cases ===========

    function test_ConstructorEmitsAllowlistEvent() public {
        vm.expectEmit(true, false, false, true);
        emit QuoteTokenAllowlistUpdated(address(0), true);
        new LaunchpadFactory();
    }

    function test_AllowlistSameTokenTwice() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);
        assertTrue(factory.isQuoteTokenAllowed(address(honestToken)));

        // Setting to true again should work (idempotent)
        factory.setQuoteTokenAllowed(address(honestToken), true);
        assertTrue(factory.isQuoteTokenAllowed(address(honestToken)));
    }

    function test_ExistingCurvesStillWorkAfterAllowlistRemoval() public {
        factory.setQuoteTokenAllowed(address(honestToken), true);

        CurveParams memory params = CurveParams({
            virtualQuote: 30e18,
            graduationTarget: 100e18,
            creatorFeeBps: 30,
            quoteToken: address(honestToken),
            creatorPostGradFeeBps: 0
        });

        vm.prank(alice);
        (address token, address curve) = factory.createTokenWithParams("Test", "TEST", "", params);

        // Remove from allowlist
        factory.setQuoteTokenAllowed(address(honestToken), false);

        // Existing curve should still work for buys
        BondingCurve curveContract = BondingCurve(payable(curve));
        BondingCurveToken tokenContract = BondingCurveToken(token);

        vm.startPrank(bob);
        honestToken.approve(curve, 10e18);
        uint256 tokensReceived = curveContract.buyWithToken(10e18, 0);
        vm.stopPrank();

        assertTrue(tokensReceived > 0);
        assertEq(tokenContract.balanceOf(bob), tokensReceived);
    }
}
