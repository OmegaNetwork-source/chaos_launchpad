// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/LaunchpadFactory.sol";
import "../src/BondingCurve.sol";

contract CreateTokensLitVMv2 is Script {
    address constant FACTORY = 0x6cca297514fe2b68349e64bF6949B0f6A9CBC03A;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== Creating Sample Tokens on LitVM ===");
        console.log("Factory:", FACTORY);

        LaunchpadFactory factory = LaunchpadFactory(FACTORY);

        vm.startBroadcast(deployerPrivateKey);

        // Token 1: Lite Doge
        (address t1, address c1) = factory.createToken(
            "Lite Doge",
            "LDOGE",
            '{"name":"Lite Doge","description":"Much lite, very fast, wow","image":"https://api.dicebear.com/7.x/fun-emoji/svg?seed=ldoge"}'
        );
        console.log("LDOGE Token:", t1);
        console.log("LDOGE Curve:", c1);

        // Token 2: ZK Moon
        (address t2, address c2) = factory.createToken(
            "ZK Moon",
            "ZKMOON",
            '{"name":"ZK Moon","description":"Zero knowledge, maximum gains","image":"https://api.dicebear.com/7.x/fun-emoji/svg?seed=zkmoon"}'
        );
        console.log("ZKMOON Token:", t2);
        console.log("ZKMOON Curve:", c2);

        // Token 3: Forge Fire
        (address t3, address c3) = factory.createToken(
            "Forge Fire",
            "FIRE",
            '{"name":"Forge Fire","description":"Forged in the flames of LitVM","image":"https://api.dicebear.com/7.x/fun-emoji/svg?seed=fire"}'
        );
        console.log("FIRE Token:", t3);
        console.log("FIRE Curve:", c3);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Done ===");
    }
}
