# Chaos Launchpad Deployment Guide

## Security Patches (v5)

This version includes critical security patches:

### 1. Balance Delta Check (No-Op ERC20 Protection)
The `buyWithToken` function now uses balance delta accounting instead of trusting the declared `quoteAmount`. This prevents malicious ERC20 tokens that return `true` from `transferFrom` without actually transferring tokens (no-op ERC20 attack).

**Before (vulnerable):**
```solidity
IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), quoteAmount);
tokensOut = _executeBuy(quoteAmount, minTokensOut); // Uses declared amount
```

**After (secure):**
```solidity
uint256 balanceBefore = IERC20(quoteToken).balanceOf(address(this));
IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), quoteAmount);
uint256 received = IERC20(quoteToken).balanceOf(address(this)) - balanceBefore;
if (received < MIN_QUOTE_AMOUNT) revert InsufficientQuoteReceived();
tokensOut = _executeBuy(received, minTokensOut); // Uses actual received
```

### 2. Owner-Only Quote Token Allowlist
The factory now maintains an allowlist of approved quote tokens. Only the factory owner can add/remove tokens from this list. This prevents attackers from creating curves with malicious ERC20 tokens.

**Functions:**
- `setQuoteTokenAllowed(address token, bool allowed)` - Owner only
- `isQuoteTokenAllowed(address token)` - View function
- `allowedQuoteTokens(address token)` - Public mapping

**Default Allowlist:**
- `address(0)` (native currency) is allowlisted by default in the constructor

---

## LitVM Deployment

### Network Details

| Property | Value |
|----------|-------|
| Chain ID | 4441 |
| RPC URL | https://liteforge.rpc.caldera.xyz/http |
| Explorer | https://liteforge.explorer.caldera.xyz |
| Native Gas | zkLTC |

### Quote Tokens on LitVM

On LitVM, the allowed quote tokens are:
1. **Native zkLTC** (`address(0)`) - Allowlisted by default
2. **Omega Token** - Address TBD, must be allowlisted by owner after deployment

### Prerequisites

1. Install Foundry: https://book.getfoundry.sh/getting-started/installation
2. Fund your deployer wallet with zkLTC on LitVM

### Deployment Steps

#### 1. Set Environment Variables

```bash
# Required
export PRIVATE_KEY=0x<your-private-key>
export LITVM_RPC_URL=https://liteforge.rpc.caldera.xyz/http

# Optional: Set if Omega token address is known at deploy time
# export OMEGA_TOKEN=0x<omega-token-address>
```

**⚠️ NEVER commit private keys to git!**

#### 2. Run Simulation (Dry Run)

```bash
cd contracts

forge script script/DeployLitVM.s.sol:DeployLitVM \
  --rpc-url $LITVM_RPC_URL
```

#### 3. Deploy to LitVM (Broadcast)

```bash
forge script script/DeployLitVM.s.sol:DeployLitVM \
  --rpc-url $LITVM_RPC_URL \
  --broadcast
```

#### 4. Verify Deployment

After deployment, note the factory address from the console output:
```
LaunchpadFactory: 0x<new-factory-address>
```

Verify on explorer: https://liteforge.explorer.caldera.xyz/address/0x<new-factory-address>

### Post-Deployment: Allowlist Omega Token

When the Omega token address is finalized, the factory owner must allowlist it:

#### Option A: Using cast (recommended)

```bash
export FACTORY_ADDRESS=0x<factory-address>
export OMEGA_TOKEN=0x<omega-token-address>

cast send $FACTORY_ADDRESS "setQuoteTokenAllowed(address,bool)" $OMEGA_TOKEN true \
  --rpc-url $LITVM_RPC_URL \
  --private-key $PRIVATE_KEY
```

#### Option B: Using Foundry script

```bash
export FACTORY_ADDRESS=0x<factory-address>
export OMEGA_TOKEN=0x<omega-token-address>

forge script script/DeployLitVM.s.sol:AllowlistOmegaToken \
  --rpc-url $LITVM_RPC_URL \
  --broadcast
```

### Verify Allowlist Status

```bash
# Check if native is allowlisted
cast call $FACTORY_ADDRESS "isQuoteTokenAllowed(address)" 0x0000000000000000000000000000000000000000 \
  --rpc-url $LITVM_RPC_URL

# Check if Omega token is allowlisted
cast call $FACTORY_ADDRESS "isQuoteTokenAllowed(address)" $OMEGA_TOKEN \
  --rpc-url $LITVM_RPC_URL
```

---

## Arc Testnet Deployment

### Network Details

| Property | Value |
|----------|-------|
| Chain ID | 5042002 |
| RPC URL | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| Native Gas | USDC |

### Deployment

```bash
export PRIVATE_KEY=0x<your-private-key>
export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast
```

---

## Fee Structure (All Chains)

| Fee Type | Rate | Recipient |
|----------|------|-----------|
| Curve Protocol Fee | 1.00% (100 bps) | Olympus Treasury |
| Curve Creator Fee | 0-1.00% (0-100 bps, default 0.30%) | Token Creator |
| Post-grad Protocol Fee | 0.25% (25 bps) | Fee Recipient |
| Post-grad Creator Fee | 0-0.25% (0-25 bps, opt-in) | Token Creator |

**Olympus Treasury:** `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41`

---

## Troubleshooting

### "QuoteTokenNotAllowed" Error

The quote token you're trying to use hasn't been allowlisted. Only the factory owner can allowlist tokens:

```bash
# Factory owner must run:
cast send $FACTORY_ADDRESS "setQuoteTokenAllowed(address,bool)" $TOKEN_ADDRESS true \
  --rpc-url $RPC_URL --private-key $OWNER_PRIVATE_KEY
```

### "InsufficientQuoteReceived" Error

The balance delta check detected that fewer tokens were received than expected. This can happen with:
- Fee-on-transfer tokens (expected behavior - pricing uses actual received amount)
- Malicious no-op tokens (blocked - reverts to prevent free mints)

### "OwnableUnauthorizedAccount" Error

Only the factory owner can:
- Allowlist/remove quote tokens (`setQuoteTokenAllowed`)
- Update fee recipient (`setFeeRecipient`)
- Pause/unpause the factory

---

## Security Considerations

1. **Never share or commit private keys**
2. **Verify contract source on block explorer after deployment**
3. **Only allowlist trusted ERC20 tokens as quote tokens**
4. **Test on testnet before mainnet deployment**
5. **Factory owner is a privileged role - consider using a multisig**
