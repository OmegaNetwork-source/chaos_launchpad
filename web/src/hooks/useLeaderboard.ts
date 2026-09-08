import { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import { getFactoryAddress } from '../config/chains'

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, address quoteToken)'
)
const TOKENS_PURCHASED_EVENT = parseAbiItem(
  'event TokensPurchased(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 newPrice)'
)
const TOKENS_SOLD_EVENT = parseAbiItem(
  'event TokensSold(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 newPrice)'
)
const CREATOR_FEES_CLAIMED_EVENT = parseAbiItem(
  'event CreatorFeesClaimed(address indexed creator, uint256 amount)'
)

const CHUNK_SIZE = 5000n
const MAX_CURVES_PER_BATCH = 3
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
  dataSource: 'static' | 'live' | 'none'
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
  dataSource: 'static' | 'live'
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

async function fetchStaticLeaderboard(): Promise<LeaderboardEntry[] | null> {
  try {
    const res = await fetch('/leaderboard/leaderboard.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = (await res.json()) as StaticLeaderboardJson
    if (!data || !Array.isArray(data.entries)) return null
    return parseStaticData(data)
  } catch {
    return null
  }
}

async function fetchLogsChunked(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  params: {
    address?: `0x${string}` | `0x${string}`[]
    event: typeof TOKEN_CREATED_EVENT | typeof TOKENS_PURCHASED_EVENT | typeof TOKENS_SOLD_EVENT | typeof CREATOR_FEES_CLAIMED_EVENT
    fromBlock: bigint
    toBlock: bigint
  },
  maxRetries = 3
): Promise<any[]> {
  const allLogs: any[] = []
  let currentFrom = params.fromBlock
  const targetTo = params.toBlock

  while (currentFrom <= targetTo) {
    const currentTo =
      currentFrom + CHUNK_SIZE - 1n > targetTo ? targetTo : currentFrom + CHUNK_SIZE - 1n

    let succeeded = false
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const logs = await publicClient.getLogs({
          address: params.address,
          event: params.event,
          fromBlock: currentFrom,
          toBlock: currentTo,
        })
        allLogs.push(...logs)
        succeeded = true
        break
      } catch (err) {
        const msg = `${(err as Error)?.message || ''}`.toLowerCase()
        const isRateLimit = msg.includes('rate limit') || msg.includes('429')
        if (attempt === maxRetries - 1) {
          console.warn('getLogs chunk failed after retries', {
            from: currentFrom.toString(),
            to: currentTo.toString(),
            err,
          })
        } else {
          await new Promise((r) => setTimeout(r, isRateLimit ? 3000 * (attempt + 1) : 1000 * 2 ** attempt))
        }
      }
    }
    if (!succeeded) {
      // skip failed chunk; do not abort
    }
    currentFrom = currentTo + 1n
  }
  return allLogs
}

export function useLeaderboard(chainId: number = 5042002): LeaderboardData {
  const publicClient = usePublicClient()
  const factoryAddress = getFactoryAddress(chainId)

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)
  const [dataSource, setDataSource] = useState<'static' | 'live' | 'none'>('none')
  const [fetchTrigger, setFetchTrigger] = useState(0)
  const inFlight = useRef(false)

  const refetch = useCallback(() => {
    memoryCache = null
    setFetchTrigger((t) => t + 1)
  }, [])

  useEffect(() => {
    if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL_MS && fetchTrigger === 0) {
      setEntries(memoryCache.entries)
      setDataSource(memoryCache.dataSource)
      setHasData(memoryCache.entries.length > 0)
      setIsLoading(false)
      return
    }

    if (inFlight.current) return
    inFlight.current = true
    let cancelled = false

    const run = async () => {
      try {
        setError(null)
        if (!hasData) setIsLoading(true)

        const staticData = await fetchStaticLeaderboard()
        if (cancelled) return

        if (staticData && staticData.length > 0) {
          memoryCache = { ts: Date.now(), entries: staticData, dataSource: 'static' }
          setEntries(staticData)
          setDataSource('static')
          setHasData(true)
          setIsLoading(false)
          inFlight.current = false
          return
        }

        if (!publicClient) {
          setIsLoading(false)
          inFlight.current = false
          return
        }

        const currentBlock = await publicClient.getBlockNumber()
        const startBlock = currentBlock > 100000n ? currentBlock - 100000n : 0n

        const tokenCreatedLogs = await fetchLogsChunked(publicClient, {
          address: factoryAddress,
          event: TOKEN_CREATED_EVENT,
          fromBlock: startBlock,
          toBlock: currentBlock,
        })

        if (cancelled) return

        const creatorLaunches = new Map<string, number>()
        const curveAddresses: `0x${string}`[] = []
        const curveToCreator = new Map<string, string>()

        for (const log of tokenCreatedLogs) {
          const creator = (log.args.creator as string).toLowerCase()
          const curve = (log.args.curve as string).toLowerCase() as `0x${string}`
          creatorLaunches.set(creator, (creatorLaunches.get(creator) || 0) + 1)
          curveAddresses.push(curve)
          curveToCreator.set(curve, creator)
        }

        const walletVolumes = new Map<string, bigint>()
        const walletTrades = new Map<string, number>()
        const creatorFees = new Map<string, bigint>()

        for (let i = 0; i < curveAddresses.length; i += MAX_CURVES_PER_BATCH) {
          if (cancelled) return
          const batch = curveAddresses.slice(i, i + MAX_CURVES_PER_BATCH)

          const [buyLogs, sellLogs, feeLogs] = await Promise.all([
            fetchLogsChunked(publicClient, {
              address: batch.length === 1 ? batch[0] : batch,
              event: TOKENS_PURCHASED_EVENT,
              fromBlock: startBlock,
              toBlock: currentBlock,
            }),
            fetchLogsChunked(publicClient, {
              address: batch.length === 1 ? batch[0] : batch,
              event: TOKENS_SOLD_EVENT,
              fromBlock: startBlock,
              toBlock: currentBlock,
            }),
            fetchLogsChunked(publicClient, {
              address: batch.length === 1 ? batch[0] : batch,
              event: CREATOR_FEES_CLAIMED_EVENT,
              fromBlock: startBlock,
              toBlock: currentBlock,
            }),
          ])

          for (const log of buyLogs) {
            const buyer = (log.args.buyer as string).toLowerCase()
            const quoteIn = log.args.quoteIn as bigint
            walletVolumes.set(buyer, (walletVolumes.get(buyer) || 0n) + quoteIn)
            walletTrades.set(buyer, (walletTrades.get(buyer) || 0) + 1)
          }

          for (const log of sellLogs) {
            const seller = (log.args.seller as string).toLowerCase()
            const quoteOut = log.args.quoteOut as bigint
            walletVolumes.set(seller, (walletVolumes.get(seller) || 0n) + quoteOut)
            walletTrades.set(seller, (walletTrades.get(seller) || 0) + 1)
          }

          for (const log of feeLogs) {
            const creator = (log.args.creator as string).toLowerCase()
            const amount = log.args.amount as bigint
            creatorFees.set(creator, (creatorFees.get(creator) || 0n) + amount)
          }

          await new Promise((r) => setTimeout(r, 500))
        }

        if (cancelled) return

        const allWallets = new Set([
          ...creatorLaunches.keys(),
          ...walletVolumes.keys(),
          ...creatorFees.keys(),
        ])

        const leaderboardEntries: LeaderboardEntry[] = Array.from(allWallets).map((wallet) => ({
          wallet: wallet as `0x${string}`,
          tokensLaunched: creatorLaunches.get(wallet) || 0,
          feesClaimed: creatorFees.get(wallet) || 0n,
          chaosVolume: walletVolumes.get(wallet) || 0n,
          tradeCount: walletTrades.get(wallet) || 0,
        }))

        leaderboardEntries.sort((a, b) => 
          a.chaosVolume > b.chaosVolume ? -1 : a.chaosVolume < b.chaosVolume ? 1 : 0
        )

        memoryCache = { ts: Date.now(), entries: leaderboardEntries, dataSource: 'live' }
        setEntries(leaderboardEntries)
        setDataSource('live')
        setHasData(leaderboardEntries.length > 0)
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err)
        setError('Failed to load leaderboard data')
        setIsLoading(false)
      } finally {
        inFlight.current = false
      }
    }

    run()
    return () => {
      cancelled = true
      inFlight.current = false
    }
  }, [publicClient, factoryAddress, fetchTrigger, hasData])

  return {
    entries,
    isLoading,
    error,
    refetch,
    hasData,
    dataSource,
  }
}
