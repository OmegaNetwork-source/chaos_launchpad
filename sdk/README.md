# @fuse-launchpad/sdk

TypeScript SDK for interacting with the Spark memecoin launchpad on Arc Testnet.

## Installation

```bash
npm install @fuse-launchpad/sdk viem
# or
pnpm add @fuse-launchpad/sdk viem
```

## Quick Start

```typescript
import { FuseSDK, ARC_TESTNET } from '@fuse-launchpad/sdk'
import { createWalletClient, http } from 'viem'

// Initialize SDK
const spark = new FuseSDK({
  factoryAddress: '0x...',
})

// List all tokens
const tokens = await spark.listTokens()
console.log(`Found ${tokens.length} tokens`)

// Get buy quote
const quote = await spark.getBuyQuote(
  curveAddress,
  spark.parseUsdc('10') // 10 USDC
)
console.log(`You'll receive ${spark.formatTokens(quote.amount)} tokens`)
console.log(`Fee: ${spark.formatUsdc(quote.fee)} USDC`)
```

## API Reference

### Constructor

```typescript
const spark = new FuseSDK({
  factoryAddress: '0x...', // Required: LaunchpadFactory address
  rpcUrl: 'https://...',   // Optional: Custom RPC URL
})
```

### Read Methods

#### `listTokens(): Promise<TokenInfo[]>`

Get all tokens with their info, newest first.

#### `getToken(address): Promise<TokenInfo>`

Get info for a specific token.

#### `getCurveState(curveAddress): Promise<CurveState>`

Get the current state of a bonding curve.

#### `getCurrentPrice(curveAddress): Promise<bigint>`

Get the current price (USDC per token, 18 decimals).

#### `getProgress(curveAddress): Promise<bigint>`

Get progress towards graduation (0-10000 basis points).

#### `getBuyQuote(curveAddress, usdcAmount): Promise<Quote>`

Get expected tokens out for a given USDC input.

#### `getSellQuote(curveAddress, tokenAmount): Promise<Quote>`

Get expected USDC out for a given token input.

#### `getTokenBalance(tokenAddress, account): Promise<bigint>`

Get token balance for an address.

### Transaction Helpers

#### `prepareCreateTokenTx(params): { to, data }`

Prepare transaction data for creating a new token.

```typescript
const tx = spark.prepareCreateTokenTx({
  name: 'My Meme',
  symbol: 'MEME',
  metadataURI: 'ipfs://...',
})

// Use with wagmi
await walletClient.sendTransaction(tx)
```

#### `prepareBuyTx(params): Promise<{ to, data, value }>`

Prepare transaction data for buying tokens.

```typescript
const tx = await spark.prepareBuyTx({
  curveAddress: '0x...',
  usdcAmount: spark.parseUsdc('10'),
  slippageBps: 500, // 5% (optional, default 500)
})

await walletClient.sendTransaction(tx)
```

#### `prepareSellTx(params): Promise<{ to, data }>`

Prepare transaction data for selling tokens.

```typescript
const tx = await spark.prepareSellTx({
  curveAddress: '0x...',
  tokensAmount: spark.parseTokens('1000000'),
  slippageBps: 500,
})

await walletClient.sendTransaction(tx)
```

### Utility Methods

```typescript
// USDC formatting (18 decimals on Arc)
spark.parseUsdc('10')     // string -> bigint
spark.formatUsdc(amount)  // bigint -> string

// Token formatting (18 decimals)
spark.parseTokens('1000000')
spark.formatTokens(amount)
```

## Types

```typescript
interface TokenInfo {
  token: `0x${string}`
  curve: `0x${string}`
  name: string
  symbol: string
  metadataURI: string
  creator: `0x${string}`
  createdAt: bigint
  graduated: boolean
}

interface CurveState {
  virtualUsdc: bigint
  virtualTokens: bigint
  realUsdcRaised: bigint
  tokensSold: bigint
  graduated: boolean
  pair: `0x${string}`
}

interface Quote {
  amount: bigint
  fee: bigint
}
```

## Exports

```typescript
import {
  FuseSDK,
  ARC_TESTNET,        // viem Chain definition
  FACTORY_ABI,
  BONDING_CURVE_ABI,
  TOKEN_ABI,
} from '@fuse-launchpad/sdk'
```

## With wagmi/React

```typescript
import { useWriteContract } from 'wagmi'
import { FuseSDK } from '@fuse-launchpad/sdk'

function BuyButton({ curveAddress, amount }) {
  const { writeContract } = useWriteContract()
  const spark = new FuseSDK({ factoryAddress: FACTORY_ADDRESS })

  const handleBuy = async () => {
    const tx = await spark.prepareBuyTx({
      curveAddress,
      usdcAmount: spark.parseUsdc(amount),
    })

    writeContract({
      address: tx.to,
      abi: BONDING_CURVE_ABI,
      functionName: 'buy',
      args: [minTokensOut],
      value: tx.value,
    })
  }

  return <button onClick={handleBuy}>Buy</button>
}
```

## Arc Testnet

The SDK exports the Arc Testnet chain configuration:

```typescript
import { ARC_TESTNET } from '@fuse-launchpad/sdk'

// Chain ID: 5042002
// RPC: https://rpc.testnet.arc.network
// Native currency: USDC (18 decimals for gas)
```

## License

MIT
