import { useState, useEffect, useCallback, useRef } from 'react'

interface TokenState {
  virtualQuote: bigint
  virtualTokens: bigint
  realQuoteRaised: bigint
  tokensSold: bigint
  graduated: boolean
  pair: `0x${string}`
}

interface CachedTokenInfo {
  token: `0x${string}`
  curve: `0x${string}`
  name: string
  symbol: string
  metadataURI: string
  creator: `0x${string}`
  createdAt: string
  graduated: boolean
  state?: {
    virtualQuote: string
    virtualTokens: string
    realQuoteRaised: string
    tokensSold: string
    graduated: boolean
    pair: `0x${string}`
  }
}

export interface TokenInfo {
  token: `0x${string}`
  curve: `0x${string}`
  name: string
  symbol: string
  metadataURI: string
  creator: `0x${string}`
  createdAt: bigint
  graduated: boolean
  isSeed?: boolean
  state?: TokenState
}

interface CacheData {
  tokens: CachedTokenInfo[]
  timestamp: number
}

const CACHE_VERSION = 'v1'
const CACHE_STALE_MS = 5 * 60 * 1000 // 5 minutes until stale (still usable but refetch)
const CACHE_EXPIRE_MS = 24 * 60 * 60 * 1000 // 24 hours until cache fully expires

function getCacheKey(chainId: number, factoryAddress: string): string {
  return `chaos_tokens_${CACHE_VERSION}_${chainId}_${factoryAddress.toLowerCase()}`
}

function serializeToken(token: TokenInfo): CachedTokenInfo {
  return {
    token: token.token,
    curve: token.curve,
    name: token.name,
    symbol: token.symbol,
    metadataURI: token.metadataURI,
    creator: token.creator,
    createdAt: token.createdAt.toString(),
    graduated: token.graduated,
    state: token.state ? {
      virtualQuote: token.state.virtualQuote.toString(),
      virtualTokens: token.state.virtualTokens.toString(),
      realQuoteRaised: token.state.realQuoteRaised.toString(),
      tokensSold: token.state.tokensSold.toString(),
      graduated: token.state.graduated,
      pair: token.state.pair,
    } : undefined,
  }
}

function deserializeToken(cached: CachedTokenInfo): TokenInfo {
  return {
    token: cached.token,
    curve: cached.curve,
    name: cached.name,
    symbol: cached.symbol,
    metadataURI: cached.metadataURI,
    creator: cached.creator,
    createdAt: BigInt(cached.createdAt),
    graduated: cached.graduated,
    state: cached.state ? {
      virtualQuote: BigInt(cached.state.virtualQuote),
      virtualTokens: BigInt(cached.state.virtualTokens),
      realQuoteRaised: BigInt(cached.state.realQuoteRaised),
      tokensSold: BigInt(cached.state.tokensSold),
      graduated: cached.state.graduated,
      pair: cached.state.pair,
    } : undefined,
  }
}

function loadFromLocalStorage(chainId: number, factoryAddress: string): CacheData | null {
  try {
    const key = getCacheKey(chainId, factoryAddress)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    
    const data: CacheData = JSON.parse(raw)
    
    // Check if cache is completely expired
    if (Date.now() - data.timestamp > CACHE_EXPIRE_MS) {
      localStorage.removeItem(key)
      return null
    }
    
    return data
  } catch {
    return null
  }
}

function saveToLocalStorage(chainId: number, factoryAddress: string, tokens: TokenInfo[]): void {
  try {
    const key = getCacheKey(chainId, factoryAddress)
    const data: CacheData = {
      tokens: tokens.map(serializeToken),
      timestamp: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage might be full or disabled
  }
}

// In-memory cache for immediate access (survives component remounts)
const memoryCache = new Map<string, { tokens: TokenInfo[]; timestamp: number }>()

export function useTokenCache(chainId: number, factoryAddress: string) {
  const cacheKey = getCacheKey(chainId, factoryAddress)
  
  // Initialize from memory cache first, then localStorage
  const [cachedTokens, setCachedTokens] = useState<TokenInfo[]>(() => {
    // Try memory cache first (fastest)
    const memCached = memoryCache.get(cacheKey)
    if (memCached && Date.now() - memCached.timestamp < CACHE_EXPIRE_MS) {
      return memCached.tokens
    }
    
    // Fall back to localStorage
    const lsCached = loadFromLocalStorage(chainId, factoryAddress)
    if (lsCached) {
      const tokens = lsCached.tokens.map(deserializeToken)
      // Populate memory cache
      memoryCache.set(cacheKey, { tokens, timestamp: lsCached.timestamp })
      return tokens
    }
    
    return []
  })
  
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(() => {
    const memCached = memoryCache.get(cacheKey)
    if (memCached) return memCached.timestamp
    
    const lsCached = loadFromLocalStorage(chainId, factoryAddress)
    if (lsCached) return lsCached.timestamp
    
    return 0
  })
  
  const lastUpdateRef = useRef<number>(0)
  
  // Update cache with new tokens
  const updateCache = useCallback((tokens: TokenInfo[]) => {
    if (!tokens.length) return
    
    const now = Date.now()
    // Debounce rapid updates
    if (now - lastUpdateRef.current < 1000) return
    lastUpdateRef.current = now
    
    setCachedTokens(tokens)
    setCacheTimestamp(now)
    
    // Update memory cache
    memoryCache.set(cacheKey, { tokens, timestamp: now })
    
    // Persist to localStorage
    saveToLocalStorage(chainId, factoryAddress, tokens)
  }, [chainId, factoryAddress, cacheKey])
  
  // Check if cache is stale (should refetch but can still show cached data)
  const isStale = Date.now() - cacheTimestamp > CACHE_STALE_MS
  
  // Check if we have any cached data to show
  const hasCache = cachedTokens.length > 0
  
  return {
    cachedTokens,
    updateCache,
    hasCache,
    isStale,
    cacheTimestamp,
  }
}

// Hook to merge fresh RPC data with cached data
export function useMergedTokenData(
  freshTokens: TokenInfo[] | undefined,
  freshCurveStates: { status: string; result: unknown }[] | undefined,
  cachedTokens: TokenInfo[],
  isLoading: boolean,
): { tokens: TokenInfo[]; isRefreshing: boolean } {
  // If we have fresh data, use it
  if (freshTokens && freshTokens.length > 0) {
    const tokensWithState = freshTokens.map((token, index) => {
      const stateResult = freshCurveStates?.[index]
      if (stateResult?.status === 'success') {
        return { ...token, state: stateResult.result as TokenState }
      }
      // Fall back to cached state for this token if fresh state failed
      const cached = cachedTokens.find(t => t.token.toLowerCase() === token.token.toLowerCase())
      if (cached?.state) {
        return { ...token, state: cached.state }
      }
      return token
    })
    return { tokens: tokensWithState, isRefreshing: false }
  }
  
  // If loading but have cache, show cache with refreshing indicator
  if (isLoading && cachedTokens.length > 0) {
    return { tokens: cachedTokens, isRefreshing: true }
  }
  
  // If not loading and have cache (RPC failed), show cache
  if (!isLoading && cachedTokens.length > 0) {
    return { tokens: cachedTokens, isRefreshing: false }
  }
  
  // No data available
  return { tokens: [], isRefreshing: isLoading }
}
