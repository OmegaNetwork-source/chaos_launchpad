// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/LaunchpadFactory.sol";

/**
 * @title CreateTokensLitVM
 * @notice Create sample tokens on LitVM testnet
 */
contract CreateTokensLitVM is Script {
    address constant LITVM_FACTORY = 0x5A2F02120E355Dd914308c525E8350C0c02cd945;

    struct TokenData {
        string name;
        string symbol;
        string description;
        string image;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        LaunchpadFactory factory = LaunchpadFactory(LITVM_FACTORY);

        TokenData[] memory tokens = new TokenData[](5);
        
        tokens[0] = TokenData({
            name: "Lite Doge",
            symbol: "LDOGE",
            description: "The goodest boy on LitVM",
            image: "https://raw.githubusercontent.com/meme-assets/doge/main/doge.png"
        });
        
        tokens[1] = TokenData({
            name: "zkLitecoin Moon",
            symbol: "ZKMOON",
            description: "To the moon on zkLTC gas",
            image: ""
        });
        
        tokens[2] = TokenData({
            name: "Fuse Fire",
            symbol: "FIRE",
            description: "Setting LitVM ablaze",
            image: ""
        });
        
        tokens[3] = TokenData({
            name: "Caldera Cat",
            symbol: "CCAT",
            description: "Purrfect for Caldera rollups",
            image: ""
        });
        
        tokens[4] = TokenData({
            name: "LiteForge Legend",
            symbol: "FORGE",
            description: "Forged in lite fire",
            image: ""
        });

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 i = 0; i < tokens.length; i++) {
            string memory metadataURI = string(abi.encodePacked(
                '{"name":"', tokens[i].name,
                '","symbol":"', tokens[i].symbol,
                '","description":"', tokens[i].description,
                '","image":"', tokens[i].image, '"}'
            ));

            (address token, address curve) = factory.createToken(
                tokens[i].name,
                tokens[i].symbol,
                metadataURI
            );

            console.log("Created:", tokens[i].symbol);
            console.log("  Token:", token);
            console.log("  Curve:", curve);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== LitVM Tokens Created ===");
        console.log("Factory:", LITVM_FACTORY);
        console.log("Explorer: https://liteforge.explorer.caldera.xyz");
    }
}
