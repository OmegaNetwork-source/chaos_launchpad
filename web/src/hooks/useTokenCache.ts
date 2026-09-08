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
  tokenCount: number // Store the count to detect stale data
}

const CACHE_VERSION = 'v2' // Bumped version for new format
const CACHE_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days - keep cache for a long time

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
    
    // Check if cache is completely expired (7 days)
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
      tokenCount: tokens.length,
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage might be full or disabled - fail silently
  }
}

// In-memory cache for immediate access (survives component remounts within session)
const memoryCache = new Map<string, { tokens: TokenInfo[]; timestamp: number }>()

export function useTokenCache(chainId: number, factoryAddress: string) {
  const cacheKey = getCacheKey(chainId, factoryAddress)
  
  // Initialize from memory cache first, then localStorage
  const [cachedTokens, setCachedTokens] = useState<TokenInfo[]>(() => {
    // Try memory cache first (fastest, already deserialized)
    const memCached = memoryCache.get(cacheKey)
    if (memCached && memCached.tokens.length > 0) {
      return memCached.tokens
    }
    
    // Fall back to localStorage
    const lsCached = loadFromLocalStorage(chainId, factoryAddress)
    if (lsCached && lsCached.tokens.length > 0) {
      const tokens = lsCached.tokens.map(deserializeToken)
      // Populate memory cache immediately
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
  
  // Re-hydrate from localStorage on mount (in case memory cache was cleared)
  useEffect(() => {
    if (cachedTokens.length === 0) {
      const lsCached = loadFromLocalStorage(chainId, factoryAddress)
      if (lsCached && lsCached.tokens.length > 0) {
        const tokens = lsCached.tokens.map(deserializeToken)
        setCachedTokens(tokens)
        setCacheTimestamp(lsCached.timestamp)
        memoryCache.set(cacheKey, { tokens, timestamp: lsCached.timestamp })
      }
    }
  }, [chainId, factoryAddress, cacheKey, cachedTokens.length])
  
  // Update cache with new tokens
  // CRITICAL: Only updates if new tokens array is non-empty
  // NEVER clears the cache - that's the whole point of stale-while-revalidate
  const updateCache = useCallback((tokens: TokenInfo[]) => {
    // NEVER update cache with empty array - this is the critical fix
    if (!tokens || tokens.length === 0) {
      return
    }
    
    const now = Date.now()
    // Debounce rapid updates (e.g., multiple RPC responses in quick succession)
    if (now - lastUpdateRef.current < 500) return
    lastUpdateRef.current = now
    
    setCachedTokens(tokens)
    setCacheTimestamp(now)
    
    // Update memory cache
    memoryCache.set(cacheKey, { tokens, timestamp: now })
    
    // Persist to localStorage
    saveToLocalStorage(chainId, factoryAddress, tokens)
  }, [chainId, factoryAddress, cacheKey])
  
  // Check if we have any cached data to show
  const hasCache = cachedTokens.length > 0
  
  // Check if cache is stale (older than 5 minutes)
  const isStale = Date.now() - cacheTimestamp > 5 * 60 * 1000
  
  return {
    cachedTokens,
    updateCache,
    hasCache,
    isStale,
    cacheTimestamp,
  }
}
