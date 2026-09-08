/**
 * Known swarm/bot/system wallet addresses for leaderboard badging.
 * These wallets are used for testing and board activity.
 * 
 * IMPORTANT: This file contains READ-ONLY addresses only.
 * NEVER commit private keys or sensitive wallet data.
 */

export interface SwarmWallet {
  address: `0x${string}`
  label: string
  type: 'deployer' | 'bot' | 'tester'
}

export const SWARM_WALLETS: SwarmWallet[] = [
  {
    address: '0xC46c1f8B4FEF6D45C6f3BCB433e928c4db4FbaE0',
    label: 'Deployer',
    type: 'deployer',
  },
  {
    address: '0x189d68bbe7935bb36699642c76FDA96a7E872424',
    label: 'Test User',
    type: 'tester',
  },
]

const swarmAddressSet = new Set(
  SWARM_WALLETS.map((w) => w.address.toLowerCase())
)

export function isSwarmWallet(address: string): boolean {
  return swarmAddressSet.has(address.toLowerCase())
}

export function getSwarmWalletInfo(address: string): SwarmWallet | undefined {
  const lower = address.toLowerCase()
  return SWARM_WALLETS.find((w) => w.address.toLowerCase() === lower)
}

export function getSwarmBadge(address: string): string | null {
  const info = getSwarmWalletInfo(address)
  if (!info) return null
  switch (info.type) {
    case 'deployer':
      return 'deployer'
    case 'bot':
      return 'bot'
    case 'tester':
      return 'tester'
    default:
      return 'swarm'
  }
}
