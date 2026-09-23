# Chaos Launchpad

Memecoin bonding-curve launchpad on **LitVM LiteForge** (zkLTC native gas).

See [DEPLOYED.md](DEPLOYED.md) for contracts. Web app in `web/`. Live site: https://chaos.omeganetwork.co

**Create a coin in seconds. Trade on a bonding curve. Watch it graduate to the DEX.**

## Features

- **Instant token creation** — Deploy your memecoin with name, ticker, and image
- **Bonding curve trading** — Buy and sell tokens on a constant-product curve
- **Native zkLTC** — Trades use LitVM native gas (18 decimals)
- **Automatic graduation** — When the graduation target is raised, liquidity moves to a DEX pair
- **Full-stack** — Solidity contracts, React website, REST API, and TypeScript SDK

## LitVM LiteForge (live product chain)

| Property | Value |
|----------|-------|
| Chain ID | `4441` (hex `0x1159`) |
| RPC | `https://liteforge.rpc.caldera.xyz/http` |
| WebSocket | `wss://liteforge.rpc.caldera.xyz/ws` |
| Explorer | https://liteforge.explorer.caldera.xyz |
| Faucet | https://liteforge.hub.caldera.xyz |
| Native Token | zkLTC (18 decimals) |
| Factory | `0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7` (`VITE_FACTORY_ADDRESS_LITVM`) |

The web app is **LitVM-only** (no Arc / dual-chain switcher).

## Project Structure

```
chaos_launchpad/
├── contracts/          # Foundry smart contracts
│   ├── src/
│   │   ├── BondingCurve.sol       # Constant-product bonding curve
│   │   ├── BondingCurveToken.sol  # ERC-20 meme token
│   │   ├── LaunchpadFactory.sol   # Factory + registry
│   │   └── SimplePair.sol         # DEX pair for graduated tokens
│   ├── test/           # Foundry tests
│   └── script/         # Deployment scripts
├── web/                # React + Vite + Tailwind frontend
├── api/                # Hono API server with SQLite indexer
└── sdk/                # TypeScript SDK for integration
```

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 20+
- pnpm

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Tests

```bash
cd contracts
forge test -vv
```

### 3. Deploy to LitVM (optional — factory already live)

1. Get testnet zkLTC from the [LitVM faucet](https://liteforge.hub.caldera.xyz)

2. Create `.env` file in `/contracts`:
```bash
cp contracts/.env.example contracts/.env
# Edit with your private key and LitVM RPC
```

3. Deploy:
```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url https://liteforge.rpc.caldera.xyz/http --broadcast
```

4. Copy the factory address to `web/.env` as `VITE_FACTORY_ADDRESS_LITVM`.

### 4. Run the Website

```bash
# Create .env with LitVM factory address
cp web/.env.example web/.env
# Confirm VITE_FACTORY_ADDRESS_LITVM

# Start dev server
pnpm --filter @fuse-launchpad/web dev
# or: cd web && pnpm dev
```

Open http://localhost:43215

### 5. Run the API (optional)

```bash
cp api/.env.example api/.env
# Point RPC/factory at LitVM

pnpm dev:api
```

API runs at http://localhost:43216

## Fee Structure

| Fee | Rate | Recipient |
|-----|------|-----------|
| Protocol fee | 1.00% (100 bps) | Olympus Treasury `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41` (fixed) |
| Creator fee | 0-1.00% (0-100 bps) | Token creator (claimable via `claimCreatorFees()`) |
| **Default total** | **1.30%** | — |

Fees are charged on both buy and sell transactions on the bonding curve.

## Adjustable Curve Parameters

Tokens can be created with custom bonding curve parameters (via `createTokenWithParams`):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `virtualQuote` | 30 (native) | Initial virtual liquidity (affects starting price) |
| `graduationTarget` | 100 (native) | Native threshold to graduate to DEX |
| `creatorFeeBps` | 30 (0.30%) | Creator's fee percentage (0–100 bps) |

### Using Custom Parameters (Solidity)

```solidity
CurveParams memory params = CurveParams({
    virtualQuote: 50e18,
    graduationTarget: 200e18,
    creatorFeeBps: 50,
    quoteToken: address(0) // native zkLTC
});

(address token, address curve) = factory.createTokenWithParams(
    "My Token",
    "MTK",
    metadataURI,
    params
);
```

## Bonding Curve Math

Chaos uses a **constant-product** bonding curve (similar to Uniswap):

```
virtualQuote × virtualTokens = k (constant)
```

**For buys:**
```
tokensOut = virtualTokens - k / (virtualQuote + quoteIn)
```

**For sells:**
```
quoteOut = virtualQuote - k / (virtualTokens + tokensIn)
```

### Tokenomics

| Parameter | Value |
|-----------|-------|
| Total supply | 1,000,000,000 tokens |
| Curve supply | 800,000,000 (80%) |
| LP reserve | 200,000,000 (20%) |
| Initial virtual quote | 30 zkLTC |
| Graduation target | 100 zkLTC raised |
| Protocol fee | 1.00% → `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41` |
| Creator fee | 0.30% → Token creator (claimable) |

## SDK Usage

```typescript
import { FuseSDK } from '@fuse-launchpad/sdk'
import { parseUnits } from 'viem'

const chaos = new FuseSDK({
  factoryAddress: '0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7',
})

const tokens = await chaos.listTokens()

const quote = await chaos.getBuyQuote(
  curveAddress,
  parseUnits('10', 18)
)
```

See [sdk/README.md](sdk/README.md) for full documentation.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /tokens` | List all tokens with pagination |
| `GET /tokens/:address` | Get token details and curve state |
| `GET /quote/buy?curve=&amount=` | Get buy quote |
| `GET /quote/sell?curve=&amount=` | Get sell quote |
| `GET /stats` | Platform statistics |
| `POST /sync` | Trigger manual re-index |

## Development

### Web

```bash
cd web
pnpm install
pnpm dev             # Dev server on :43215
pnpm build           # Production build
```

### Contracts

```bash
cd contracts
forge build
forge test -vvv
```

## Security Considerations

- **Testnet only** — Do not deploy to mainnet without audit
- **No private keys in git** — Use `.env` files (gitignored)
- **Slippage protection** — Frontend enforces 5% slippage by default
- **Reentrancy guards** — All state-changing functions protected
- **Pausable** — Factory can be paused in emergencies

## License

MIT

## Links

- [LitVM Faucet](https://liteforge.hub.caldera.xyz)
- [LiteForge Explorer](https://liteforge.explorer.caldera.xyz)
- [DEPLOYED.md](DEPLOYED.md) — contract addresses
- Live app: https://chaos.omeganetwork.co
