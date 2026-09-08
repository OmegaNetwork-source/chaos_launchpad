# Multi-Chain Deployment Guide

Fuse contracts are designed to be **chain-portable**. This document covers deployment across different EVM chains.

## Current Deployments

| Chain | Status | Native Asset | Chain ID | Factory |
|-------|--------|--------------|----------|---------|
| **Arc Testnet** | ✅ Active | USDC (18 decimals) | 5042002 | `0xC84589BE267E2F7811231e71e46E2f7a9f4d7fD3` |
| **LitVM LiteForge** | ✅ Active | zkLTC (18 decimals) | 4441 | `0x5A2F02120E355Dd914308c525E8350C0c02cd945` |

### Chain Details

#### Arc Testnet (Circle)
- **RPC:** `https://rpc.testnet.arc.network`
- **Explorer:** https://testnet.arcscan.app
- **Native Token:** USDC (18 decimals)
- **Faucet:** https://faucet.circle.com

#### LitVM LiteForge Testnet (Caldera)
- **RPC:** `https://liteforge.rpc.caldera.xyz/http`
- **WebSocket:** `wss://liteforge.rpc.caldera.xyz/ws`
- **Explorer:** https://liteforge.explorer.caldera.xyz
- **Native Token:** zkLTC (18 decimals)

## Architecture: Native Value Mode

The bonding curve accepts **native value** (`msg.value`) for all trades. This design is chain-agnostic:

```solidity
// BondingCurve.sol - works on any EVM chain
function buy(uint256 minTokensOut) external payable {
    // msg.value is the native asset (USDC on Arc, zkLTC on LitVM)
    // Math is identical - both use 18 decimals
}
```

### Why Native Value?

1. **Simpler UX** — No ERC-20 approvals needed for the quote asset
2. **Gas efficient** — Native transfers cost less than ERC-20 transfers
3. **Chain portable** — Same contract works on Arc (USDC-native) and LitVM (zkLTC-native)

### Chain-Specific Considerations

| Concern | Arc Testnet | LitVM LiteForge |
|---------|-------------|-----------------|
| Native asset | USDC | zkLTC |
| Native decimals | 18 | 18 |
| `msg.value` | USDC amount | zkLTC amount |
| Zero-address transfers | **Reverts** | Succeeds |
| Fee recipient | Works normally | Works normally |

## Frontend Multi-Chain Support

The Fuse web app supports both chains with a network switcher:

```typescript
// web/src/config/chains.ts
export const supportedChains = {
  arcTestnet: {
    id: 5042002,
    name: 'Arc Testnet',
    factoryAddress: '0xC84589BE267E2F7811231e71e46E2f7a9f4d7fD3',
    nativeSymbol: 'USDC',
    explorer: 'https://testnet.arcscan.app',
  },
  litvm: {
    id: 4441,
    name: 'LitVM LiteForge',
    factoryAddress: '0x5A2F02120E355Dd914308c525E8350C0c02cd945',
    nativeSymbol: 'zkLTC',
    explorer: 'https://liteforge.explorer.caldera.xyz',
  },
}
```

## Deploying to a New Chain

### 1. Configure Environment

```bash
export RPC_URL=https://rpc.newchain.example
export PRIVATE_KEY=0x...
```

### 2. Run Deploy Script

```bash
cd contracts

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC_URL \
  --broadcast
```

### 3. Update Frontend

Add the chain to `web/src/config/chains.ts`:

```typescript
newChain: {
  id: CHAIN_ID,
  name: 'New Chain',
  factoryAddress: 'DEPLOYED_ADDRESS',
  nativeSymbol: 'TOKEN',
  explorer: 'https://explorer.newchain.example',
  rpcUrl: 'https://rpc.newchain.example',
}
```

## Shared ABIs for Olympus/Hermes

All chains share identical ABIs. The SDK exports them:

```typescript
import { 
  FACTORY_ABI, 
  BONDING_CURVE_ABI, 
  TOKEN_ABI 
} from '@fuse-launchpad/sdk'

// Same ABIs work on Arc, LitVM, or any future chain
```

### Key Functions (Stable Interface)

```solidity
// LaunchpadFactory
function createToken(string name, string symbol, string metadataURI) 
  returns (address token, address curve)
function createTokenWithParams(string name, string symbol, string metadataURI, CurveParams params)
  returns (address token, address curve)
function getToken(address) returns (TokenInfo)
function getAllTokens() returns (address[])
function defaultParams() returns (CurveParams)

// BondingCurve  
function buy(uint256 minTokensOut) payable returns (uint256 tokensOut)
function sell(uint256 tokensIn, uint256 minOut) returns (uint256 out)
function getBuyQuote(uint256 amountIn) returns (uint256 out, uint256 protocolFee, uint256 creatorFee)
function getSellQuote(uint256 amountIn) returns (uint256 out, uint256 protocolFee, uint256 creatorFee)
function claimCreatorFees()
function graduationTarget() returns (uint256)
function creatorFeeBps() returns (uint256)

// BondingCurveToken (ERC-20)
function balanceOf(address) returns (uint256)
function transfer(address, uint256) returns (bool)
```

## Multi-Chain SDK Usage

```typescript
import { FuseSDK } from '@fuse-launchpad/sdk'

// Arc deployment
const fuseArc = new FuseSDK({
  factoryAddress: '0xC84589BE267E2F7811231e71e46E2f7a9f4d7fD3',
  rpcUrl: 'https://rpc.testnet.arc.network',
})

// LitVM deployment
const fuseLit = new FuseSDK({
  factoryAddress: '0x5A2F02120E355Dd914308c525E8350C0c02cd945',
  rpcUrl: 'https://liteforge.rpc.caldera.xyz/http',
})

// Same API, different chains
await fuseArc.listTokens()
await fuseLit.listTokens()
```

## Checklist for New Chain Deployment

- [x] Fund deployer wallet on target chain
- [x] Run `forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast`
- [x] Record factory address in `DEPLOYED.md`
- [x] Add chain config to `web/src/config/chains.ts`
- [x] Update web app with network switcher
- [ ] Test create → buy → sell → graduate flow on new chain
- [ ] Update API indexer to poll new chain RPC (if applicable)

## Contact

For multi-chain deployment questions or Olympus/Hermes integration:
- See `INTEGRATION.md` for agent/chat hooks
- Contract ABIs are stable across all deployments
