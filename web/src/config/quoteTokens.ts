// Quote token configuration for bonding curve pairs
// Tokens can be paired with native or allowlisted ERC-20 quote tokens

export interface QuoteToken {
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
  category: 'native' | 'platform' | 'stablecoin' | 'stock' | 'currency' | 'collectible' | 'custom'
  chainId: number
  logoUrl?: string
}

// Native quote tokens (address(0) means native value)
export const NATIVE_QUOTE = '0x0000000000000000000000000000000000000000' as const

// Arc Testnet quote tokens
export const arcQuoteTokens: QuoteToken[] = [
  {
    address: NATIVE_QUOTE,
    symbol: 'USDC',
    name: 'Native USDC',
    decimals: 18,
    category: 'native',
    chainId: 5042002,
  },
  {
    address: '0x40eF85CCc195Ae13f50E0bE9A2A6Be2a7493530a',
    symbol: 'CHAOS',
    name: 'Chaos Platform Token',
    decimals: 18,
    category: 'platform',
    chainId: 5042002,
  },
  // Legacy FUSE (deprecated)
  // address: '0x21f81368d55Bcf08984C6a2A8d9327Deef2b92B7',
]

// LitVM quote tokens
export const litvmQuoteTokens: QuoteToken[] = [
  {
    address: NATIVE_QUOTE,
    symbol: 'zkLTC',
    name: 'Native zkLTC',
    decimals: 18,
    category: 'native',
    chainId: 4441,
  },
]

// Combined quote tokens by chain
export const quoteTokensByChain: Record<number, QuoteToken[]> = {
  5042002: arcQuoteTokens,
  4441: litvmQuoteTokens,
}

// Get quote tokens for a chain
export function getQuoteTokens(chainId: number): QuoteToken[] {
  return quoteTokensByChain[chainId] || []
}

// Get default quote token for a chain (native)
export function getDefaultQuoteToken(chainId: number): QuoteToken | undefined {
  return getQuoteTokens(chainId).find(t => t.category === 'native')
}

// Get quote token by address
export function getQuoteToken(chainId: number, address: `0x${string}`): QuoteToken | undefined {
  return getQuoteTokens(chainId).find(t => t.address.toLowerCase() === address.toLowerCase())
}

// Check if address is native (address(0))
export function isNativeQuote(address: `0x${string}`): boolean {
  return address === NATIVE_QUOTE
}

// Category labels for filtering
export const categoryLabels: Record<QuoteToken['category'], string> = {
  native: 'Native',
  platform: 'Platform',
  stablecoin: 'Stablecoins',
  stock: 'Stocks',
  currency: 'Currencies',
  collectible: 'Collectibles',
  custom: 'Custom',
}

// Get all unique categories for a chain
export function getCategories(chainId: number): QuoteToken['category'][] {
  const tokens = getQuoteTokens(chainId)
  const categories = new Set(tokens.map(t => t.category))
  return Array.from(categories)
}
