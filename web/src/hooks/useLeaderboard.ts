import { useState, useEffect, useCallback, useRef } from 'react'

const CACHE_TTL_MS = 60_000

export interface LeaderboardEntry {
  wallet: `0x${string}`
  tokensLaunched: number
  feesClaimed: bigint
  chaosVolume: bigint
  tradeCount: number
}

export type SortField = 'tokensLaunched' | 'feesClaimed' | 'chaosVolume'

export interface LeaderboardData {
  entries: LeaderboardEntry[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  hasData: boolean
  generatedAt: string | null
}

interface StaticLeaderboardJson {
  generatedAt: string
  entries: {
    wallet: string
    tokensLaunched: number
    feesClaimed: string
    chaosVolume: string
    tradeCount: number
  }[]
}

interface CacheEntry {
  ts: number
  entries: LeaderboardEntry[]
  generatedAt: string | null
}

let memoryCache: CacheEntry | null = null

function parseStaticData(data: StaticLeaderboardJson): LeaderboardEntry[] {
  return data.entries.map((e) => ({
    wallet: e.wallet as `0x${string}`,
    tokensLaunched: e.tokensLaunched,
    feesClaimed: BigInt(e.feesClaimed || '0'),
    chaosVolume: BigInt(e.chaosVolume || '0'),
    tradeCount: e.tradeCount || 0,
  }))
}

async function fetchStaticLeaderboard(cacheBust: boolean): Promise<{ entries: LeaderboardEntry[]; generatedAt: string | null } | null> {
  try {
    const url = cacheBust
      ? `/leaderboard/leaderboard.json?_=${Date.now()}`
      : '/leaderboard/leaderboard.json'
    const res = await fetch(url, { cache: cacheBust ? 'no-cache' : 'default' })
    if (!res.ok) return null
    const data = (await res.json()) as StaticLeaderboardJson
    if (!data || !Array.isArray(data.entries)) return null
    return {
      entries: parseStaticData(data),
      generatedAt: data.generatedAt || null,
    }
  } catch {
    return null
  }
}

export function useLeaderboard(_chainId: number = 5042002): LeaderboardData {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [fetchTrigger, setFetchTrigger] = useState(0)
  const inFlight = useRef(false)

  const refetch = useCallback(() => {
    memoryCache = null
    setFetchTrigger((t) => t + 1)
  }, [])

  useEffect(() => {
    if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL_MS && fetchTrigger === 0) {
      setEntries(memoryCache.entries)
      setGeneratedAt(memoryCache.generatedAt)
      setHasData(memoryCache.entries.length > 0)
      setIsLoading(false)
      return
    }

    if (inFlight.current) return
    inFlight.current = true

    const run = async () => {
      try {
        setError(null)
        if (!hasData) setIsLoading(true)

        const cacheBust = fetchTrigger > 0
        const result = await fetchStaticLeaderboard(cacheBust)

        if (result && result.entries.length > 0) {
          memoryCache = { ts: Date.now(), entries: result.entries, generatedAt: result.generatedAt }
          setEntries(result.entries)
          setGeneratedAt(result.generatedAt)
          setHasData(true)
          setError(null)
        } else if (result) {
          setEntries([])
          setGeneratedAt(result.generatedAt)
          setHasData(false)
          setError(null)
        } else {
          setEntries([])
          setGeneratedAt(null)
          setHasData(false)
          setError('Leaderboard data not available')
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err)
        setError('Failed to load leaderboard')
      } finally {
        setIsLoading(false)
        inFlight.current = false
      }
    }

    run()
  }, [fetchTrigger, hasData])

  return {
    entries,
    isLoading,
    error,
    refetch,
    hasData,
    generatedAt,
  }
}
