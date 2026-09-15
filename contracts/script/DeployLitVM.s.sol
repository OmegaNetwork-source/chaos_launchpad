// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/LaunchpadFactory.sol";

/**
 * @title DeployLitVM
 * @notice Deployment script for Chaos Launchpad on LitVM (LiteForge testnet)
 *
 * ## Network Details
 * - Chain ID: 4441
 * - RPC: https://liteforge.rpc.caldera.xyz/http
 * - Explorer: https://liteforge.explorer.caldera.xyz
 * - Native Gas: zkLTC (address(0) as quote for native pools)
 *
 * ## Quote Token Allowlist (owner-only control)
 * On LitVM, quote tokens are:
 * - Native zkLTC: address(0) - allowlisted by default in constructor
 * - pOmega: 0xCdE5530b1AD4a4F38870b3B3eF28E7455Cb88125 - platform token, already allowlisted on factory
 *
 * Only the factory owner can allowlist additional quote tokens.
 * This prevents malicious quote tokens (no-op ERC20s) from being used.
 *
 * ## Usage
 *
 * 1. Set environment variables:
 *    export PRIVATE_KEY=0x...
 *    export LITVM_RPC_URL=https://liteforge.rpc.caldera.xyz/http
 *    # Optional: Set OMEGA_TOKEN if the address is known
 *    # export OMEGA_TOKEN=0x...
 *
 * 2. Fund deployer wallet with zkLTC on LitVM
 *
 * 3. Run deployment (simulation first):
 *    forge script script/DeployLitVM.s.sol:DeployLitVM \
 *      --rpc-url $LITVM_RPC_URL
 *
 * 4. Run deployment (broadcast):
 *    forge script script/DeployLitVM.s.sol:DeployLitVM \
 *      --rpc-url $LITVM_RPC_URL \
 *      --broadcast
 *
 * ## Post-Deployment
 * When Omega token address is available, call setQuoteTokenAllowed:
 *   cast send $FACTORY_ADDRESS "setQuoteTokenAllowed(address,bool)" $OMEGA_TOKEN true \
 *     --rpc-url $LITVM_RPC_URL --private-key $PRIVATE_KEY
 */
contract DeployLitVM is Script {
    address constant OLYMPUS_TREASURY = 0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Optional: Omega token address (if known at deploy time)
        address omegaToken = vm.envOr("OMEGA_TOKEN", address(0));

        console.log("=== Chaos Launchpad LitVM Deployment ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("");

        if (block.chainid != 4441) {
            console.log("WARNING: Expected chain ID 4441 (LitVM), got:", block.chainid);
            console.log("");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy factory - native zkLTC (address(0)) is allowlisted by default
        LaunchpadFactory factory = new LaunchpadFactory();

        // If Omega token address is provided, allowlist it
        if (omegaToken != address(0)) {
            factory.setQuoteTokenAllowed(omegaToken, true);
            console.log("Omega Token allowlisted:", omegaToken);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("LaunchpadFactory:", address(factory));
        console.log("Fee Recipient:", factory.feeRecipient());
        console.log("Factory Owner:", factory.owner());
        console.log("");
        console.log("=== Quote Token Allowlist Status ===");
        console.log("Native zkLTC (address(0)):", factory.isQuoteTokenAllowed(address(0)) ? "ALLOWED" : "NOT ALLOWED");
        if (omegaToken != address(0)) {
            console.log("Omega Token:", factory.isQuoteTokenAllowed(omegaToken) ? "ALLOWED" : "NOT ALLOWED");
        } else {
            console.log("Omega Token: NOT SET (use setQuoteTokenAllowed when address is known)");
        }
        console.log("");
        console.log("=== Fee Structure ===");
        console.log("Curve Protocol: 1.00% -> Olympus");
        console.log("Curve Creator:  0.30% -> Token creator");
        console.log("Post-grad Protocol: 0.25% skim");
        console.log("Post-grad Creator:  0-0.25% (opt-in)");
        console.log("");
        console.log("=== Security Notes ===");
        console.log("- Balance delta check enabled (no-op ERC20 protection)");
        console.log("- Quote token allowlist is OWNER-ONLY");
        console.log("- Only factory owner can add new quote tokens");
        console.log("");
        console.log("=== Environment Variables ===");
        console.log("VITE_FACTORY_ADDRESS_LITVM=%s", address(factory));
        console.log("FACTORY_ADDRESS_LITVM=%s", address(factory));
        console.log("");
        console.log("=== Post-Deployment: Allowlist Omega Token ===");
        console.log("When Omega token address is available, run:");
        console.log("cast send %s \"setQuoteTokenAllowed(address,bool)\" $OMEGA_TOKEN true \\", address(factory));
        console.log("  --rpc-url https://liteforge.rpc.caldera.xyz/http --private-key $PRIVATE_KEY");
    }
}

/**
 * @title AllowlistOmegaToken
 * @notice Script to allowlist Omega token on an existing factory
 *
 * Usage:
 *   export FACTORY_ADDRESS=0x...
 *   export OMEGA_TOKEN=0x...
 *   export PRIVATE_KEY=0x...
 *
 *   forge script script/DeployLitVM.s.sol:AllowlistOmegaToken \
 *     --rpc-url https://liteforge.rpc.caldera.xyz/http \
 *     --broadcast
 */
contract AllowlistOmegaToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        address omegaToken = vm.envAddress("OMEGA_TOKEN");

        console.log("=== Allowlist Omega Token ===");
        console.log("Factory:", factoryAddress);
        console.log("Omega Token:", omegaToken);

        LaunchpadFactory factory = LaunchpadFactory(factoryAddress);

        // Verify caller is owner
        address owner = factory.owner();
        address deployer = vm.addr(deployerPrivateKey);
        require(deployer == owner, "Only factory owner can allowlist tokens");

        console.log("Current allowlist status:", factory.isQuoteTokenAllowed(omegaToken) ? "ALLOWED" : "NOT ALLOWED");

        vm.startBroadcast(deployerPrivateKey);
        factory.setQuoteTokenAllowed(omegaToken, true);
        vm.stopBroadcast();

        console.log("New allowlist status:", factory.isQuoteTokenAllowed(omegaToken) ? "ALLOWED" : "NOT ALLOWED");
        console.log("");
        console.log("=== Omega Token Allowlisted Successfully ===");
    }
}
