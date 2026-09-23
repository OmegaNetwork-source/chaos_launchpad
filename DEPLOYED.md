# Chaos Launchpad - Deployed Contracts

## LitVM LiteForge Testnet (Chain ID: 4441) — Live product chain

### LaunchpadFactory

**Factory Address:** `0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7`

- **Fee Recipient:** `0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41` (Olympus Treasury)
- **Native Gas:** zkLTC (18 decimals)
- **RPC:** `https://liteforge.rpc.caldera.xyz/http`
- **Explorer:** https://liteforge.explorer.caldera.xyz
- **Faucet:** https://liteforge.hub.caldera.xyz
- **Graduation Range:** $5 - $10,000
- **Quote Token Support:** Native zkLTC + ERC-20 tokens

**Explorer:** [View on LiteForge](https://liteforge.explorer.caldera.xyz/address/0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7)

### Sample Tokens on LitVM

| Name | Symbol | Token Address | Curve Address |
|------|--------|---------------|---------------|
| Lite Doge | LDOGE | `0x61F2B64c31Fd351c789A5cE674A134Ec4cB49eC5` | `0x105D75260C0CA9C76530afEe4583Dc51221B0a21` |

---

## Environment Variables

```bash
# LitVM (web app) — hardcoded in chains.ts as well
VITE_FACTORY_ADDRESS_LITVM=0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7
```

---

## Contract Versions

| Version | Features | Factory |
|---------|----------|---------|
| v1 | Basic bonding curve | (deprecated) |
| v2 | Adjustable curve params | LitVM: `0x5A2F...` (legacy) |
| v3 | ERC-20 quote tokens, $5-$10k range | LitVM: `0x1D7A...0BA7` (live, security-patched) |
