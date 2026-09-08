// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/ChaosToken.sol";

contract DeployChaosTokenScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Deploying CHAOS Token ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);
        ChaosToken chaos = new ChaosToken(deployer);
        vm.stopBroadcast();

        console.log("CHAOS Token deployed at:", address(chaos));
        console.log("Initial supply:", chaos.totalSupply() / 1e18, "CHAOS");
        console.log("Deployer balance:", chaos.balanceOf(deployer) / 1e18, "CHAOS");
    }
}
