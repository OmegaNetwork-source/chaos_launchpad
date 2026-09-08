# Chaos Launchpad

Memecoin bonding-curve launchpad on Arc Testnet.

See DEPLOYED.md for contracts. Web app in `web/`.

# Fuse — Memecoin Launchpad on Arc Testnet

Fuse is a standalone pump.fun-style memecoin launchpad built on [Arc Testnet](https://docs.arc.io), Circle's L1 blockchain where USDC is the native gas token.

**Create a coin in seconds. Trade on a bonding curve. Watch it graduate to the DEX.**

## Features

- **Instant token creation** — Deploy your memecoin with name, ticker, and image
- **Bonding curve trading** — Buy and sell tokens on a constant-product curve
- **Native USDC** — All trades use USDC (Arc's native gas token, 18 decimals)
- **Automatic graduation** — When 100 USDC is raised, liquidity moves to a DEX pair
- **Full-stack** — Solidity contracts, React website, REST API, and TypeScript SDK

## Arc Testnet

Arc is Circle's EVM-compatible L1 where USDC is the native gas token:

| Property | Value |
|----------|-------|
| Chain ID | `5042002` (hex `0x4CEF52`) |
| RPC | `https://rpc.testnet.arc.network` |
| WebSocket | `wss://rpc.testnet.arc.network` |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |
| Native Token | USDC (18 decimals for gas, 6 decimals for ERC-20) |

### Arc EVM Differences

- **USDC is native gas** — `msg.value` and `address.balance` use 18 decimals
- **ERC-20 USDC** at `0x3600000000000000000000000000000000000000` uses 6 decimals
- **Never transfer to `address(0)`** — Arc reverts these transfers
- **No onchain randomness** — `PREVRANDAO` returns 0
- See [Arc EVM Differences](https://docs.arc.io/arc/references/evm-differences) for full details

## Project Structure

```
fuse/
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

All 20 tests should pass.

### 3. Deploy to Arc Testnet

1. Get testnet USDC from the [Circle Faucet](https://faucet.circle.com)

2. Create `.env` file in `/contracts`:
```bash
cp contracts/.env.example contracts/.env
# Edit with your private key
```

3. Deploy:
```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast
```

4. Copy the factory address to your web and API `.env` files.

### 4. Run the Website

```bash
# Create .env with factory address
cp web/.env.example web/.env
# Edit VITE_FACTORY_ADDRESS

# Start dev server
pnpm dev
```

Open http://localhost:43215

### 5. Run the API (optional)

```bash
cp api/.env.example api/.env
# Edit FACTORY_ADDRESS

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

| Parameter | Default | Min | Max | Description |
|-----------|---------|-----|-----|-------------|
| `virtualUsdc` | 30 USDC | 10 USDC | 100 USDC | Initial virtual liquidity (affects starting price) |
| `graduationTarget` | 100 USDC | 50 USDC | 500 USDC | USDC threshold to graduate to DEX |
| `creatorFeeBps` | 30 (0.30%) | 0 | 100 (1%) | Creator's fee percentage |

### Using Custom Parameters (Solidity)

```solidity
import {CurveParams} from "./interfaces/ISpark.sol";

CurveParams memory params = CurveParams({
    virtualUsdc: 50e18,       // 50 USDC virtual liquidity
    graduationTarget: 200e18, // 200 USDC to graduate
    creatorFeeBps: 50         // 0.50% creator fee
});

(address token, address curve) = factory.createTokenWithParams(
    "My Token",
    "MTK",
    metadataURI,
    params
);
```

### Using Custom Parameters (SDK/Frontend)

Pass `params` to `createTokenWithParams` instead of `createToken`:

```typescript
const tx = await factory.write.createTokenWithParams([
  name,
  symbol,
  metadataURI,
  {
    virtualUsdc: parseUnits('50', 18),       // 50 USDC
    graduationTarget: parseUnits('200', 18), // 200 USDC
    creatorFeeBps: 50n,                       // 0.50%
  }
]);
```

## Bonding Curve Math

Spark uses a **constant-product** bonding curve (similar to Uniswap):

```
virtualUsdc × virtualTokens = k (constant)
```

**For buys:**
```
tokensOut = virtualTokens - k / (virtualUsdc + usdcIn)
```

**For sells:**
```
usdcOut = virtualUsdc - k / (virtualTokens + tokensIn)
```

### Tokenomics

| Parameter | Value |
|-----------|-------|
| Total supply | 1,000,000,000 tokens |
| Curve supply | 800,000,000 (80%) |
| LP reserve | 200,000,000 (20%) |
| Initial virtual USDC | 30 USDC |
| Graduation target | 100 USDC raised |
| Protocol fee | 1.00% → `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41` |
| Creator fee | 0.30% → Token creator (claimable) |

### Price Discovery

- Initial price: ~0.0000000375 USDC per token
- Price increases as tokens are bought
- At graduation (~100 USDC raised), unsold tokens + LP reserve seed the DEX pair

## SDK Usage

```typescript
import { FuseSDK } from '@fuse-launchpad/sdk'
import { parseUnits } from 'viem'

const spark = new FuseSDK({
  factoryAddress: '0x...',
})

// List all tokens
const tokens = await spark.listTokens()

// Get buy quote for 10 USDC
const quote = await spark.getBuyQuote(
  curveAddress,
  parseUnits('10', 18)
)
console.log(`You'll receive ${spark.formatTokens(quote.amount)} tokens`)

// Prepare buy transaction (use with wagmi/viem wallet)
const tx = await spark.prepareBuyTx({
  curveAddress,
  usdcAmount: parseUnits('10', 18),
  slippageBps: 500, // 5%
})
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

## Contract Addresses

After deployment, update these in your `.env` files:

```
FACTORY_ADDRESS=0x...  # LaunchpadFactory
```

Individual token and curve addresses are emitted in `TokenCreated` events.

## Development

### Contracts

```bash
cd contracts
forge build          # Compile
forge test -vvv      # Test with traces
forge fmt            # Format
```

### Web

```bash
cd web
pnpm dev             # Dev server on :43215
pnpm build           # Production build
```

### API

```bash
cd api
pnpm dev             # Dev server on :43216
```

### SDK

```bash
cd sdk
pnpm build           # Build to dist/
pnpm dev             # Watch mode
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

- [Arc Testnet Docs](https://docs.arc.io)
- [Circle Faucet](https://faucet.circle.com)
- [ArcScan Explorer](https://testnet.arcscan.app)
- [pump.fun](https://pump.fun) — Inspiration
