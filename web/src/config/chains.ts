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

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
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
  [arcTestnet.id]: {
    chain: arcTestnet,
    factoryAddress: (import.meta.env.VITE_FACTORY_ADDRESS_ARC as `0x${string}`) || '0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A',
    nativeSymbol: 'USDC',
    explorerUrl: 'https://testnet.arcscan.app',
    faucetUrl: 'https://faucet.circle.com',
    addChainParams: {
      chainId: '0x4CEF52',
      chainName: 'Arc Testnet',
      nativeCurrency: {
        name: 'USDC',
        symbol: 'USDC',
        decimals: 18,
      },
      rpcUrls: ['https://rpc.testnet.arc.network'],
      blockExplorerUrls: ['https://testnet.arcscan.app'],
    },
  },
  [litvm.id]: {
    chain: litvm,
    factoryAddress: (import.meta.env.VITE_FACTORY_ADDRESS_LITVM as `0x${string}`) || '0x6cca297514fe2b68349e64bF6949B0f6A9CBC03A',
    nativeSymbol: 'zkLTC',
    explorerUrl: 'https://liteforge.explorer.caldera.xyz',
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

export const supportedChains = [arcTestnet, litvm] as const
export const defaultChain = arcTestnet

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
  return chainConfigs[chainId]?.nativeSymbol || 'ETH'
}
