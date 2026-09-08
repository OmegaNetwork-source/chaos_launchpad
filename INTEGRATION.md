# Phase 2 Integration: Olympus & Hermes

This document outlines how Spark will integrate with the Olympus and Hermes platforms in Phase 2.

## Overview

Spark Phase 1 delivers a standalone memecoin launchpad. Phase 2 will integrate with:

- **Olympus** — The AI agent orchestration platform
- **Hermes** — The messaging/chat infrastructure

These integrations will enable AI-powered memecoin launches, chat-based trading, and social features.

## Olympus Integration

### Easy Money Agent Actions

Olympus agents will be able to:

1. **Create tokens** via SDK
```typescript
import { FuseSDK } from '@fuse-launchpad/sdk'

// In an Olympus agent action
async function createMemeToken(params: {
  name: string
  symbol: string
  description: string
}) {
  const spark = new FuseSDK({ factoryAddress: FACTORY_ADDRESS })
  const tx = spark.prepareCreateTokenTx({
    name: params.name,
    symbol: params.symbol,
    metadataURI: JSON.stringify({ description: params.description }),
  })
  
  // Execute via agent's wallet
  return await agentWallet.sendTransaction(tx)
}
```

2. **Execute trades** on behalf of users
```typescript
async function buyTokens(curveAddress: string, usdcAmount: string) {
  const spark = new FuseSDK({ factoryAddress: FACTORY_ADDRESS })
  const tx = await spark.prepareBuyTx({
    curveAddress,
    usdcAmount: spark.parseUsdc(usdcAmount),
    slippageBps: 500,
  })
  
  return await agentWallet.sendTransaction(tx)
}
```

3. **Monitor graduation events** for notifications
```typescript
// Watch for graduation events
const unwatch = spark.publicClient.watchContractEvent({
  address: factoryAddress,
  abi: FACTORY_ABI,
  eventName: 'TokenGraduated',
  onLogs: (logs) => {
    for (const log of logs) {
      notifyUsers(log.args.token, log.args.pair)
    }
  },
})
```

### Agent Portfolio Management

For agents managing user portfolios:

```typescript
// Get user's token holdings
const balance = await spark.getTokenBalance(tokenAddress, userAddress)

// Get current value
const state = await spark.getCurveState(curveAddress)
const price = await spark.getCurrentPrice(curveAddress)
const value = (balance * price) / BigInt(1e18)
```

## Hermes Integration

### Chat Cards

Hermes chat cards will display:

1. **Token cards** with live data
```json
{
  "type": "spark_token",
  "tokenAddress": "0x...",
  "curveAddress": "0x...",
  "name": "Example Meme",
  "symbol": "EMEME",
  "price": "0.00000123",
  "progress": 45.2,
  "graduated": false
}
```

2. **Trade confirmation cards**
```json
{
  "type": "spark_trade",
  "action": "buy",
  "tokenSymbol": "EMEME",
  "amount": "1000000",
  "usdcAmount": "10.5",
  "txHash": "0x..."
}
```

3. **Graduation celebration cards**
```json
{
  "type": "spark_graduated",
  "tokenAddress": "0x...",
  "pairAddress": "0x...",
  "totalRaised": "100.5",
  "tokenName": "Example Meme"
}
```

### Chat Commands

Hermes will support commands like:

```
/spark create "Doge Moon" DMOON "To the moon!"
/spark buy 0x... 10 USDC
/spark sell 0x... 50%
/spark price 0x...
/spark trending
```

### Intent-Based Launches

Natural language token creation:

```
User: "Launch a memecoin called CatCoin with ticker CAT"

Agent: I'll create CatCoin ($CAT) on Spark. This will:
- Deploy a new ERC-20 token
- Set up a bonding curve with 1B supply
- You can start trading immediately

[Create Token] [Cancel]
```

## API Endpoints for Integration

The Spark API provides endpoints optimized for Olympus/Hermes:

### Token Discovery
```
GET /tokens?limit=10&graduated=false
```
Returns newest active tokens for "trending" feeds.

### Real-time State
```
GET /tokens/:address/state
```
Forces a fresh read from the blockchain (not cached).

### Quote Endpoints
```
GET /quote/buy?curve=0x...&amount=10
GET /quote/sell?curve=0x...&amount=1000000
```
For displaying expected outputs before trade confirmation.

## WebSocket Events (Future)

For real-time updates in chat:

```typescript
// Connect to Spark WebSocket
const ws = new WebSocket('wss://api.spark.dev/ws')

ws.on('message', (data) => {
  const event = JSON.parse(data)
  
  switch (event.type) {
    case 'token_created':
      // New token launched
      break
    case 'trade':
      // Buy/sell occurred
      break
    case 'graduated':
      // Token graduated to DEX
      break
  }
})

// Subscribe to specific token
ws.send(JSON.stringify({
  action: 'subscribe',
  tokenAddress: '0x...',
}))
```

## Authentication

For authenticated agent actions:

1. **Agent Wallet** — Olympus agents use their configured wallet
2. **User Delegation** — Users can delegate trading authority to agents
3. **Spending Limits** — Configurable per-user trading limits

## Environment Variables

For Olympus/Hermes integration:

```bash
# Fuse Configuration
SPARK_FACTORY_ADDRESS=0x...
SPARK_API_URL=https://api.spark.dev
SPARK_CHAIN_ID=5042002

# Arc RPC (for direct contract calls)
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
```

## Testing Integration

1. **Local Development**
   - Run Spark web on `:43215`
   - Run Spark API on `:43216`
   - Point Olympus/Hermes to local endpoints

2. **Staging**
   - Deploy Spark to Arc Testnet
   - Configure staging Olympus/Hermes to use deployed contracts

3. **Integration Tests**
   - Create token via Olympus agent
   - Verify chat card renders in Hermes
   - Execute trade via chat command
   - Verify graduation notification

## Next Steps

1. [ ] Define Olympus agent action schemas
2. [ ] Design Hermes chat card components
3. [ ] Implement WebSocket event streaming
4. [ ] Add authentication/delegation layer
5. [ ] Build integration test suite
6. [ ] Deploy to shared staging environment
