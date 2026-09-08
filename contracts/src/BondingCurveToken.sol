// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IFuse.sol";

/**
 * @title BondingCurveToken
 * @notice ERC-20 meme token created by the Spark launchpad
 * @dev Only the bonding curve can mint/burn tokens during the bonding phase
 */
contract BondingCurveToken is ERC20, IBondingCurveToken {
    string private _metadataURI;
    address public immutable curve;

    error OnlyCurve();

    modifier onlyCurve() {
        if (msg.sender != curve) revert OnlyCurve();
        _;
    }

    constructor(string memory name_, string memory symbol_, string memory metadataURI_, address curve_)
        ERC20(name_, symbol_)
    {
        _metadataURI = metadataURI_;
        curve = curve_;
    }

    function metadataURI() external view override returns (string memory) {
        return _metadataURI;
    }

    function mint(address to, uint256 amount) external override onlyCurve {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external override onlyCurve {
        _burn(from, amount);
    }
}
