// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

/**
 * @title SeedBuys
 * @notice Script to seed real tokens with small buys on Arc Testnet
 * @dev Run with: forge script script/SeedBuys.s.sol:SeedBuys --rpc-url $ARC_RPC_URL --broadcast
 */
contract SeedBuys is Script {
    // Curve addresses from token creation
    address constant ARCDOGE_CURVE = 0x102A39b2c7B3991716D5987CB3e85C9B95eb14e4;
    address constant SPARK_CURVE = 0x19d6257e0cd9c563A82156893ACF0b9E83212710;
    address constant BASED_CURVE = 0xA06bfbC1c31a291Bc7C3fa2F356cA01162A2BA4B;
    address constant CHAD_CURVE = 0x186643d34C34DE59Db15FB8C611E844BC2CD845F;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Seed ARCDOGE with 5 USDC
        BondingCurve(payable(ARCDOGE_CURVE)).buy{value: 5 ether}(0);
        console.log("Bought ARCDOGE for 5 USDC");
        
        // Seed SPARK with 3 USDC
        BondingCurve(payable(SPARK_CURVE)).buy{value: 3 ether}(0);
        console.log("Bought SPARK for 3 USDC");
        
        // Seed BASED with 2 USDC
        BondingCurve(payable(BASED_CURVE)).buy{value: 2 ether}(0);
        console.log("Bought BASED for 2 USDC");
        
        // Seed CHAD with 1 USDC
        BondingCurve(payable(CHAD_CURVE)).buy{value: 1 ether}(0);
        console.log("Bought CHAD for 1 USDC");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Seed buys complete ===");
    }
}
