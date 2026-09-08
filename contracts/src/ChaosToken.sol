// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ChaosToken
 * @notice Platform ERC-20 token for use as a quote pair in Chaos bonding curves
 */
contract ChaosToken is ERC20 {
    constructor(address initialHolder) ERC20("Chaos Platform Token", "CHAOS") {
        _mint(initialHolder, 1_000_000_000e18); // 1 billion CHAOS
    }
}
