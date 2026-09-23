# Quote Tokens - Chaos Launchpad

Chaos supports quote tokens for bonding curve trading. On the live LitVM product path, tokens are paired with native zkLTC (and optionally ERC-20 quote tokens via the factory).

## LitVM LiteForge (Chain ID: 4441) — Live

| Symbol | Address | Category | Decimals |
|--------|---------|----------|----------|
| zkLTC | Native (`0x0...0`) | Native | 18 |
| pOmega | `0xCdE5530b1AD4a4F38870b3B3eF28E7455Cb88125` | Platform | 18 |

### pOmega Platform Token

pOmega is the platform token for LitVM. It allows creators to launch memecoins paired with pOmega instead of native zkLTC.

**Contract:** `0xCdE5530b1AD4a4F38870b3B3eF28E7455Cb88125`

## Adding New Quote Tokens

### Step 1: Configure in Frontend

Add the token to `web/src/config/quoteTokens.ts`:

```typescript
export const litvmQuoteTokens: QuoteToken[] = [
  // ... existing tokens
  {
    address: '0xYOUR_TOKEN_ADDRESS',
    symbol: 'TOKEN',
    name: 'Token Name',
    decimals: 18,
    category: 'custom', // native | platform | stablecoin | stock | currency | collectible | custom
    chainId: 4441,
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
| `native` | Chain's native currency (zkLTC on LitVM) |
| `platform` | Platform tokens |
| `stablecoin` | Stablecoins (USDT, DAI, etc.) |
| `stock` | Tokenized stocks |
| `currency` | FX / currency tokens |
| `collectible` | Collectible / meme quotes |
| `custom` | Other ERC-20 quotes |
