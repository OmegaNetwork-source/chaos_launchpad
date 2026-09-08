// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";

/**
 * @title CreateTokens
 * @notice Script to create sample meme tokens on Arc Testnet
 * @dev Run with: forge script script/CreateTokens.s.sol:CreateTokens --rpc-url $ARC_RPC_URL --broadcast
 */
contract CreateTokens is Script {
    address constant FACTORY = 0xC84589BE267E2F7811231e71e46E2f7a9f4d7fD3;
    
    struct TokenConfig {
        string name;
        string symbol;
        string description;
        string image;
    }
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        TokenConfig[] memory tokens = new TokenConfig[](8);
        
        tokens[0] = TokenConfig({
            name: "Arc Doge",
            symbol: "ARCDOGE",
            description: "The first Doge on Arc Testnet. Much USDC. Very Circle. Wow.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=arcdoge"
        });
        
        tokens[1] = TokenConfig({
            name: "Circle Cat",
            symbol: "CCAT",
            description: "A cat that only walks in circles. Built on Arc.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=circlecat"
        });
        
        tokens[2] = TokenConfig({
            name: "Spark Moon",
            symbol: "SPARK",
            description: "To the moon with Spark! The official memecoin of the launchpad.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=sparkmoon"
        });
        
        tokens[3] = TokenConfig({
            name: "USDC Frog",
            symbol: "FROGUSDC",
            description: "Pepe's cousin who only accepts stablecoins. Ribbit ribbit.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=usdcfrog"
        });
        
        tokens[4] = TokenConfig({
            name: "Based Arc",
            symbol: "BASED",
            description: "The most based token on Arc. Extremely based.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=basedarc"
        });
        
        tokens[5] = TokenConfig({
            name: "Wojak Finance",
            symbol: "WOJAK",
            description: "I bought the top and I will buy it again.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=wojak"
        });
        
        tokens[6] = TokenConfig({
            name: "Diamond Hands",
            symbol: "DIAMOND",
            description: "Never selling. Ever. Not even for USDC. Well maybe for USDC.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=diamond"
        });
        
        tokens[7] = TokenConfig({
            name: "Testnet Chad",
            symbol: "CHAD",
            description: "Real Chads test on testnet first. This is the way.",
            image: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=chad"
        });
        
        vm.startBroadcast(deployerPrivateKey);
        
        LaunchpadFactory factory = LaunchpadFactory(FACTORY);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            string memory metadataURI = string.concat(
                '{"name":"', tokens[i].name,
                '","symbol":"', tokens[i].symbol,
                '","description":"', tokens[i].description,
                '","image":"', tokens[i].image,
                '"}'
            );
            
            (address token, address curve) = factory.createToken(
                tokens[i].name,
                tokens[i].symbol,
                metadataURI
            );
            
            console.log("Created token:", tokens[i].symbol);
            console.log("  Token:", token);
            console.log("  Curve:", curve);
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== All tokens created successfully ===");
    }
}
