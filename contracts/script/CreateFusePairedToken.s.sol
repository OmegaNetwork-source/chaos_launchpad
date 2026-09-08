// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/LaunchpadFactory.sol";
import "../src/BondingCurve.sol";
import "../src/interfaces/IFuse.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreateFusePairedToken
 * @notice Creates a test memecoin paired with FUSE token (ERC-20 quote mode)
 */
contract CreateFusePairedToken is Script {
    // Arc Testnet addresses
    address constant FACTORY = 0x16a50302f1A4AC623159714E8F7cAd4D35669D18;
    address constant FUSE_TOKEN = 0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Creating FUSE-paired Memecoin ===");
        console.log("Factory:", FACTORY);
        console.log("FUSE Token:", FUSE_TOKEN);
        console.log("Creator:", deployer);

        LaunchpadFactory factory = LaunchpadFactory(FACTORY);
        IERC20 fuse = IERC20(FUSE_TOKEN);

        vm.startBroadcast(deployerPrivateKey);

        // Create params with FUSE as quote token
        CurveParams memory params = CurveParams({
            virtualQuote: 50e18,        // 50 FUSE virtual
            graduationTarget: 50e18,    // Graduate at 50 FUSE (low for testing)
            creatorFeeBps: 50,          // 0.5% creator fee
            quoteToken: FUSE_TOKEN      // ERC-20 quote mode!,
            creatorPostGradFeeBps: 0
        });

        string memory metadataURI = '{"name":"Rocket Fuse","symbol":"RKTFUSE","description":"First memecoin paired with FUSE! To the moon!","image":"https://api.dicebear.com/7.x/fun-emoji/svg?seed=rocketfuse","socials":{"twitter":"fusememe","telegram":"t.me/fusememe","website":"https://fuse.meme","discord":"discord.gg/fuse"}}';

        (address token, address curve) = factory.createTokenWithParams(
            "Rocket Fuse",
            "RKTFUSE",
            metadataURI,
            params
        );

        console.log("");
        console.log("=== Token Created ===");
        console.log("Token:", token);
        console.log("Curve:", curve);

        // Now seed some buys with FUSE
        BondingCurve curveContract = BondingCurve(payable(curve));
        
        // Approve FUSE for the curve
        uint256 buyAmount1 = 5e18; // 5 FUSE
        uint256 buyAmount2 = 10e18; // 10 FUSE
        uint256 buyAmount3 = 3e18; // 3 FUSE
        
        fuse.approve(curve, buyAmount1 + buyAmount2 + buyAmount3);
        
        // First buy
        console.log("");
        console.log("=== Seeding Buys ===");
        uint256 tokens1 = curveContract.buyWithToken(buyAmount1, 0);
        console.log("Buy 1: 5 FUSE ->", tokens1 / 1e18, "tokens");
        
        // Second buy
        uint256 tokens2 = curveContract.buyWithToken(buyAmount2, 0);
        console.log("Buy 2: 10 FUSE ->", tokens2 / 1e18, "tokens");
        
        // Third buy
        uint256 tokens3 = curveContract.buyWithToken(buyAmount3, 0);
        console.log("Buy 3: 3 FUSE ->", tokens3 / 1e18, "tokens");

        vm.stopBroadcast();

        // Show final state
        IBondingCurve.CurveState memory state = curveContract.state();
        console.log("");
        console.log("=== Final State ===");
        console.log("Real Quote Raised:", state.realQuoteRaised / 1e18, "FUSE");
        console.log("Tokens Sold:", state.tokensSold / 1e18);
        console.log("Progress:", curveContract.getProgress(), "bps");
        console.log("Current Price:", curveContract.getCurrentPrice());
        console.log("Graduated:", state.graduated);
    }
}
