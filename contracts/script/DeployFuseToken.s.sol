// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/FuseToken.sol";

contract DeployFuseTokenScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Deploying FUSE Token ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        FuseToken fuse = new FuseToken(deployer);

        vm.stopBroadcast();

        console.log("FUSE Token deployed at:", address(fuse));
        console.log("Initial supply:", fuse.totalSupply() / 1e18, "FUSE");
        console.log("Deployer balance:", fuse.balanceOf(deployer) / 1e18, "FUSE");
    }
}
