// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FuseToken
 * @notice Platform ERC-20 token for use as a quote pair in bonding curves
 * @dev Simple ERC-20 with 18 decimals and large initial supply for testnet
 */
contract FuseToken is ERC20 {
    constructor(address initialHolder) ERC20("Fuse Platform Token", "FUSE") {
        _mint(initialHolder, 1_000_000_000e18); // 1 billion FUSE
    }
}
