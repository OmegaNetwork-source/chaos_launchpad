# Quote Tokens - Fuse Launchpad

Fuse supports multiple quote tokens for bonding curve trading. Tokens can be paired with the chain's native currency or with allowlisted ERC-20 tokens.

## Arc Testnet (Chain ID: 5042002)

| Symbol | Address | Category | Decimals |
|--------|---------|----------|----------|
| USDC | Native (`0x0...0`) | Native | 18 |
| FUSE | `0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7` | Platform | 18 |

### FUSE Platform Token

The FUSE token is the first ERC-20 quote token on Arc Testnet. It allows creators to launch memecoins paired with FUSE instead of native USDC.

**Contract:** `0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7`

## LitVM LiteForge (Chain ID: 4441)

| Symbol | Address | Category | Decimals |
|--------|---------|----------|----------|
| zkLTC | Native (`0x0...0`) | Native | 18 |

## Adding New Quote Tokens

### Step 1: Configure in Frontend

Add the token to `web/src/config/quoteTokens.ts`:

```typescript
export const arcQuoteTokens: QuoteToken[] = [
  // ... existing tokens
  {
    address: '0xYOUR_TOKEN_ADDRESS',
    symbol: 'TOKEN',
    name: 'Token Name',
    decimals: 18,
    category: 'custom', // native | platform | stablecoin | stock | currency | collectible | custom
    chainId: 5042002,
  },
]
```

### Step 2: Create Token with ERC-20 Quote

When creating a token via the factory:

```solidity
CurveParams memory params = CurveParams({
    virtualQuote: 30e18,        // Initial virtual reserve
    graduationTarget: 100e18,   // Target to graduate
    creatorFeeBps: 30,          // 0.30% creator fee
    quoteToken: 0xYOUR_TOKEN_ADDRESS // ERC-20 quote token
});

factory.createTokenWithParams(name, symbol, metadataURI, params);
```

### Step 3: Trading with ERC-20 Quote

For ERC-20 quote tokens, use `buyWithToken` instead of `buy`:

```solidity
// Approve quote token first
IERC20(quoteToken).approve(curveAddress, amount);

// Buy with ERC-20 quote
curve.buyWithToken(quoteAmount, minTokensOut);
```

Selling works the same way - the quote tokens are returned to the seller.

## Quote Token Categories

| Category | Description |
|----------|-------------|
| `native` | Chain's native currency (USDC on Arc, zkLTC on LitVM) |
| `platform` | Platform tokens (FUSE) |
| `stablecoin` | Stablecoins (USDT, DAI, etc.) |
| `stock` | Tokenized stocks |
| `currency` | Fiat-pegged tokens |
| `collectible` | Collectible tokens |
| `custom` | Other tokens |

## Contract Requirements

- Quote token must be ERC-20 compliant
- 18 decimals recommended (other decimals work but may affect UX)
- Token must have sufficient liquidity for creators/buyers
- Consider adding a faucet for testnet tokens
