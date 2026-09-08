# Fuse Launchpad - Deployed Contracts

## Arc Testnet (Chain ID: 5042002)

### LaunchpadFactory v4 (Post-grad Chaos AMM fees)

**Factory Address:** `0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A`

- **Fee Recipient:** `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41` (Olympus Treasury)
- **Curve Protocol Fee:** 1.00% (100 bps)
- **Curve Creator Fee:** 0-1.00% (configurable, default 0.30%)
- **Post-grad Protocol Fee:** 0.25% (25 bps) of swap input → feeRecipient
- **Post-grad Creator Fee:** 0-0.25% (0-25 bps, default 0 / opt-in)
- **Graduation Range:** $5 - $10,000
- **Virtual Quote Range:** 5 - 1,000
- **Quote Token Support:** Native USDC + ERC-20 tokens

**Explorer:** [View on ArcScan](https://testnet.arcscan.app/address/0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A)

### Legacy LaunchpadFactory v3

**Factory Address:** `0x16a50302f1A4AC623159714E8F7cAd4D35669D18` (superseded by v4; pairs from this factory lack post-grad fee skim)

### CHAOS Platform Token (ERC-20 Quote Token)

**CHAOS Address:** `0x40eF85CCc195Ae13f50E0bE9A2A6Be2a7493530a`

- **Symbol:** CHAOS
- **Decimals:** 18
- **Total Supply:** 1,000,000,000 CHAOS

**Explorer:** [View on ArcScan](https://testnet.arcscan.app/address/0x40eF85CCc195Ae13f50E0bE9A2A6Be2a7493530a)

### Legacy FUSE Platform Token (Deprecated)

**FUSE Address:** `0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7`

- **Symbol:** FUSE
- **Decimals:** 18
- **Total Supply:** 1,000,000,000 FUSE

**Explorer:** [View on ArcScan](https://testnet.arcscan.app/address/0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7)

### Test Memecoin (Paired with FUSE)

**Token:** `0x5525da662CC4efc8d12dEec7076b674bD2d6e0c3`
**Curve:** `0xcD861468EBF6EA0F824C1056A2d90B3b33753146`

- **Name:** Rocket Fuse
- **Symbol:** RKTFUSE
- **Quote Token:** FUSE (ERC-20 mode)
- **Graduation Target:** 50 FUSE
- **Progress:** ~35% (seeded with 18 FUSE of buys)
- **Socials:** Twitter, Telegram, Website, Discord

**Explorer:** [View Token](https://testnet.arcscan.app/address/0x5525da662CC4efc8d12dEec7076b674bD2d6e0c3) | [View Curve](https://testnet.arcscan.app/address/0xcD861468EBF6EA0F824C1056A2d90B3b33753146)

---

## LitVM LiteForge Testnet (Chain ID: 4441)

### LaunchpadFactory v3 (ERC-20 Quote Support)

**Factory Address:** `0x6cca297514fe2b68349e64bF6949B0f6A9CBC03A`

- **Fee Recipient:** `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41` (Olympus Treasury)
- **Native Gas:** zkLTC (18 decimals)
- **Graduation Range:** $5 - $10,000
- **Quote Token Support:** Native zkLTC + ERC-20 tokens

**Explorer:** [View on LiteForge](https://liteforge.explorer.caldera.xyz/address/0x6cca297514fe2b68349e64bF6949B0f6A9CBC03A)

### Sample Tokens on LitVM

| Name | Symbol | Token Address | Curve Address |
|------|--------|---------------|---------------|
| Lite Doge | LDOGE | `0x61F2B64c31Fd351c789A5cE674A134Ec4cB49eC5` | `0x105D75260C0CA9C76530afEe4583Dc51221B0a21` |

---

## Environment Variables

```bash
# Arc Testnet
VITE_FACTORY_ADDRESS_ARC=0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A

# LitVM
VITE_FACTORY_ADDRESS_LITVM=0x6cca297514fe2b68349e64bF6949B0f6A9CBC03A
```

---

## How to Buy with FUSE (ERC-20 Quote Mode)

1. Get FUSE tokens (request from deployer or use faucet)
2. Approve FUSE spending for the curve contract
3. Call `buyWithToken(quoteAmount, minTokensOut)` on the curve

```typescript
// Example using wagmi
import { parseUnits } from 'viem'

// 1. Approve FUSE for the curve
await writeContract({
  address: '0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7', // FUSE token
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [curveAddress, parseUnits('100', 18)]
})

// 2. Buy tokens with FUSE
await writeContract({
  address: curveAddress,
  abi: BONDING_CURVE_ABI,
  functionName: 'buyWithToken',
  args: [parseUnits('10', 18), 0n] // 10 FUSE, no slippage protection
})
```

---

## Contract Versions

| Version | Features | Factory |
|---------|----------|---------|
| v1 | Basic bonding curve | (deprecated) |
| v2 | Adjustable curve params | LitVM: `0x5A2F...` |
| v3 | ERC-20 quote tokens, $5-$10k range | Arc: `0x16a5...` (legacy) |
| v4 | Post-grad Chaos AMM fee skim (25 bps proto + 0-25 creator) | Arc: `0xEFAc...445A` |
