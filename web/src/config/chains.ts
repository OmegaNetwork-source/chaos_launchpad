import { defineChain, type Chain } from 'viem'

export interface ChainConfig {
  chain: Chain
  factoryAddress: `0x${string}`
  nativeSymbol: string
  explorerUrl: string
  faucetUrl?: string
  addChainParams: {
    chainId: string
    chainName: string
    nativeCurrency: {
      name: string
      symbol: string
      decimals: number
    }
    rpcUrls: string[]
    blockExplorerUrls: string[]
  }
}

export const litvm = defineChain({
  id: 4441,
  name: 'LitVM LiteForge',
  nativeCurrency: {
    name: 'zkLTC',
    symbol: 'zkLTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://liteforge.rpc.caldera.xyz/http'],
      webSocket: ['wss://liteforge.rpc.caldera.xyz/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'LiteForge Explorer',
      url: 'https://liteforge.explorer.caldera.xyz',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 1,
    },
  },
  testnet: true,
})

export const chainConfigs: Record<number, ChainConfig> = {
  [litvm.id]: {
    chain: litvm,
    // Hardcoded: Vercel had stale VITE_FACTORY_ADDRESS_LITVM env override; bypass env to ensure correct factory
    factoryAddress: '0x1D7Ae764b0EafEFb3B186964d34DCAafb8d70BA7',
    nativeSymbol: 'zkLTC',
    explorerUrl: 'https://liteforge.explorer.caldera.xyz',
    faucetUrl: 'https://liteforge.hub.caldera.xyz',
    addChainParams: {
      chainId: '0x1159',
      chainName: 'LitVM LiteForge',
      nativeCurrency: {
        name: 'zkLTC',
        symbol: 'zkLTC',
        decimals: 18,
      },
      rpcUrls: ['https://liteforge.rpc.caldera.xyz/http'],
      blockExplorerUrls: ['https://liteforge.explorer.caldera.xyz'],
    },
  },
}

export const supportedChains = [litvm] as const
export const defaultChain = litvm

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return chainConfigs[chainId]
}

export function getFactoryAddress(chainId: number): `0x${string}` {
  return chainConfigs[chainId]?.factoryAddress || '0x0000000000000000000000000000000000000000'
}

export function getExplorerUrl(chainId: number): string {
  return chainConfigs[chainId]?.explorerUrl || ''
}

export function getNativeSymbol(chainId: number): string {
  return chainConfigs[chainId]?.nativeSymbol || 'zkLTC'
}
