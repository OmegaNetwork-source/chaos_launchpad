// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/LaunchpadFactory.sol";

/**
 * @title Deploy
 * @notice Chain-portable deployment script for Spark contracts
 *
 * ## Supported Chains
 * - Arc Testnet (5042002) — USDC as native gas
 * - LitVM (planned) — ETH as native gas
 * - Any EVM with 18-decimal native token
 *
 * ## Fee Structure (same on all chains)
 * - Curve protocol fee: 1.00% (100 bps) → Olympus treasury
 * - Curve creator fee: 0.30% (30 bps) → Creator vault (claimable)
 * - Post-grad protocol: 0.25% (25 bps) of swap input → feeRecipient
 * - Post-grad creator: 0-0.25% (default 0, opt-in)
 *
 * ## Fee Recipient
 * Olympus Treasury: 0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41
 * (hardcoded in LaunchpadFactory, configurable by owner)
 *
 * ## Usage
 *
 * 1. Set environment variables:
 *    export PRIVATE_KEY=0x...
 *    export RPC_URL=https://rpc.testnet.arc.network  # or any EVM RPC
 *
 * 2. Fund deployer wallet on target chain
 *
 * 3. Run deployment:
 *    forge script script/Deploy.s.sol:Deploy \
 *      --rpc-url $RPC_URL \
 *      --broadcast
 *
 * See MULTI_CHAIN.md for chain-specific notes.
 */
contract Deploy is Script {
    address constant OLYMPUS_TREASURY = 0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41;
    address constant DEPLOYER_WALLET = 0xC46c1f8B4FEF6D45C6f3BCB433e928c4db4FbaE0;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Spark Deployment ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("");

        if (deployer != DEPLOYER_WALLET) {
            console.log("NOTE: Deployer differs from default wallet");
            console.log("Expected:", DEPLOYER_WALLET);
            console.log("Actual:", deployer);
            console.log("");
        }

        vm.startBroadcast(deployerPrivateKey);

        LaunchpadFactory factory = new LaunchpadFactory();

        vm.stopBroadcast();

        console.log("=== Deployment Complete ===");
        console.log("LaunchpadFactory:", address(factory));
        console.log("Fee Recipient:", factory.feeRecipient());
        console.log("");
        console.log("=== Fee Structure ===");
        console.log("Curve Protocol: 1.00%% -> Olympus");
        console.log("Curve Creator:  0.30%% -> Token creator");
        console.log("Post-grad Protocol: 0.25%% skim");
        console.log("Post-grad Creator:  0-0.25%% (opt-in)");
        console.log("");
        console.log("=== Set in .env ===");
        console.log("VITE_FACTORY_ADDRESS=%s", address(factory));
        console.log("FACTORY_ADDRESS=%s", address(factory));
    }
}

/**
 * @title DeployAndCreateSample
 * @notice Deploy + create a sample token for testing
 */
contract DeployAndCreateSample is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        LaunchpadFactory factory = new LaunchpadFactory();
        console.log("Factory:", address(factory));

        (address token, address curve) = factory.createToken(
            "Sample Meme",
            "SMEME",
            '{"name":"Sample Meme","description":"A test memecoin"}'
        );

        console.log("Sample Token:", token);
        console.log("Sample Curve:", curve);

        vm.stopBroadcast();
    }
}
