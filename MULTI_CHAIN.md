# Chain Deployment Guide

Chaos contracts are **chain-portable** (native `msg.value` quote mode). The **live product** is LitVM-only.

## Live Deployment

| Chain | Status | Native Asset | Chain ID | Factory |
|-------|--------|--------------|----------|---------|
| **LitVM LiteForge** | ✅ Live (product) | zkLTC (18 decimals) | 4441 | `0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7` |

### LitVM LiteForge Testnet (Caldera)

- **RPC:** `https://liteforge.rpc.caldera.xyz/http`
- **WebSocket:** `wss://liteforge.rpc.caldera.xyz/ws`
- **Explorer:** https://liteforge.explorer.caldera.xyz
- **Native Token:** zkLTC (18 decimals)
- **Faucet:** https://liteforge.hub.caldera.xyz

## Architecture: Native Value Mode

The bonding curve accepts **native value** (`msg.value`) for trades. This design is chain-agnostic:

```solidity
// BondingCurve.sol - works on any EVM chain
function buy(uint256 minTokensOut) external payable {
    // msg.value is the native asset (zkLTC on LitVM)
    // Math uses 18 decimals
}
```

### Why Native Value?

1. **Simpler UX** — No ERC-20 approvals needed for the quote asset
2. **Gas efficient** — Native transfers cost less than ERC-20 transfers
3. **Chain portable** — Same contract works on any EVM with an 18-decimal native asset

## Frontend (LitVM-only)

```typescript
// web/src/config/chains.ts
export const supportedChains = [litvm] as const
export const defaultChain = litvm
// factory hardcoded: 0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7
```

There is no dual-chain network switcher in the web app.

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

Add the chain to `web/src/config/chains.ts` and set `supportedChains` / `defaultChain` accordingly. The current product ships LitVM-only.

## Shared ABIs

```typescript
import { FACTORY_ABI, BONDING_CURVE_ABI, TOKEN_ABI } from '@fuse-launchpad/sdk'
```

See `INTEGRATION.md` for agent/chat hooks. Contract ABIs are stable across deployments.
