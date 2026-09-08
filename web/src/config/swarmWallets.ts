/**
 * Known swarm/bot/system wallet addresses for leaderboard badging.
 * These wallets are used for testing and board activity.
 * 
 * IMPORTANT: This file contains READ-ONLY addresses only.
 * NEVER commit private keys or sensitive wallet data.
 * 
 * Wallets can be loaded from:
 * 1. Hardcoded defaults below
 * 2. web/public/leaderboard/swarm-wallets.json (if present, merged with defaults)
 */

export interface SwarmWallet {
  address: `0x${string}`
  label: string
  type: 'deployer' | 'bot' | 'tester'
}

const DEFAULT_SWARM_WALLETS: SwarmWallet[] = [
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

let loadedWallets: SwarmWallet[] = [...DEFAULT_SWARM_WALLETS]
let walletMap = new Map<string, SwarmWallet>(
  loadedWallets.map((w) => [w.address.toLowerCase(), w])
)
let loadAttempted = false

async function loadSwarmWalletsFromJson(): Promise<void> {
  if (loadAttempted) return
  loadAttempted = true
  
  try {
    const res = await fetch('/leaderboard/swarm-wallets.json', { cache: 'no-cache' })
    if (!res.ok) return
    
    const data = await res.json()
    if (!Array.isArray(data.wallets)) return
    
    for (const w of data.wallets) {
      if (w.address && w.type) {
        const wallet: SwarmWallet = {
          address: w.address as `0x${string}`,
          label: w.label || w.type,
          type: w.type,
        }
        const key = wallet.address.toLowerCase()
        if (!walletMap.has(key)) {
          loadedWallets.push(wallet)
          walletMap.set(key, wallet)
        }
      }
    }
  } catch {
    // JSON file not present or invalid - use defaults only
  }
}

// Start loading immediately (non-blocking)
loadSwarmWalletsFromJson()

export function getSwarmWallets(): SwarmWallet[] {
  return loadedWallets
}

export function isSwarmWallet(address: string): boolean {
  return walletMap.has(address.toLowerCase())
}

export function getSwarmWalletInfo(address: string): SwarmWallet | undefined {
  return walletMap.get(address.toLowerCase())
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

// Re-export for backwards compatibility
export const SWARM_WALLETS = DEFAULT_SWARM_WALLETS
