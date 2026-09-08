import { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { formatUnits, parseAbiItem } from 'viem'

const TOKENS_PURCHASED_EVENT = parseAbiItem(
  'event TokensPurchased(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 newPrice)'
)
const TOKENS_SOLD_EVENT = parseAbiItem(
  'event TokensSold(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 newPrice)'
)

const ZERO = '0x0000000000000000000000000000000000000000'
const CACHE_TTL_MS = 30_000
const CHUNK_SIZE = 5000n
/** Live refresh only looks this far past createBlock (or back from tip if unknown). */
const LIVE_LOOKBACK_BLOCKS = 20_000n

export interface TradeEvent {
  type: 'buy' | 'sell'
  trader: `0x${string}`
  quoteAmount: bigint
  tokenAmount: bigint
  newPrice: bigint
  timestamp: number
  txHash: `0x${string}`
  blockNumber: bigint
}

export interface HolderInfo {
  address: `0x${string}`
  balance: bigint
  percentage: number
}

export interface TokenAnalytics {
  holderCount: number
  holders: HolderInfo[]
  totalVolume: bigint
  buyCount: number
  sellCount: number
  trades: TradeEvent[]
  priceHistory: { time: number; price: number }[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  /** True once static (or live) data has populated non-empty analytics. */
  hasData: boolean
}

interface CacheEntry {
  ts: number
  holderCount: number
  holders: HolderInfo[]
  totalVolume: bigint
  buyCount: number
  sellCount: number
  trades: TradeEvent[]
  priceHistory: { time: number; price: number }[]
  createBlock?: bigint
}

interface StaticAnalyticsJson {
  token: string
  curve: string
  createBlock?: string
  holderCount: number
  buyCount: number
  sellCount: number
  totalVolume: string
  holders: { address: string; balance: string; percentage: number }[]
  trades: {
    type: 'buy' | 'sell'
    trader: string
    quoteAmount: string
    tokenAmount: string
    newPrice: string
    timestamp: number
    txHash: string
    blockNumber: string
  }[]
  priceHistory: { time: number; price: number }[]
}

const memoryCache = new Map<string, CacheEntry>()

function parseStatic(data: StaticAnalyticsJson): CacheEntry {
  return {
    ts: Date.now(),
    holderCount: data.holderCount ?? 0,
    holders: (data.holders || []).map((h) => ({
      address: h.address as `0x${string}`,
      balance: BigInt(h.balance || '0'),
      percentage: h.percentage ?? 0,
    })),
    totalVolume: BigInt(data.totalVolume || '0'),
    buyCount: data.buyCount ?? 0,
    sellCount: data.sellCount ?? 0,
    trades: (data.trades || []).map((t) => ({
      type: t.type,
      trader: t.trader as `0x${string}`,
      quoteAmount: BigInt(t.quoteAmount || '0'),
      tokenAmount: BigInt(t.tokenAmount || '0'),
      newPrice: BigInt(t.newPrice || '0'),
      timestamp: t.timestamp || 0,
      txHash: t.txHash as `0x${string}`,
      blockNumber: BigInt(t.blockNumber || '0'),
    })),
    priceHistory: data.priceHistory || [],
    createBlock: data.createBlock ? BigInt(data.createBlock) : undefined,
  }
}

function applyEntry(
  entry: CacheEntry,
  setters: {
    setHolderCount: (n: number) => void
    setHolders: (h: HolderInfo[]) => void
    setTotalVolume: (v: bigint) => void
    setBuyCount: (n: number) => void
    setSellCount: (n: number) => void
    setTrades: (t: TradeEvent[]) => void
    setPriceHistory: (p: { time: number; price: number }[]) => void
  }
) {
  setters.setHolderCount(entry.holderCount)
  setters.setHolders(entry.holders)
  setters.setTotalVolume(entry.totalVolume)
  setters.setBuyCount(entry.buyCount)
  setters.setSellCount(entry.sellCount)
  setters.setTrades(entry.trades)
  setters.setPriceHistory(entry.priceHistory)
}

async function fetchStaticAnalytics(
  tokenAddress: string
): Promise<CacheEntry | null> {
  try {
    const res = await fetch(`/analytics/${tokenAddress.toLowerCase()}.json`, {
      cache: 'no-cache',
    })
    if (!res.ok) return null
    const data = (await res.json()) as StaticAnalyticsJson
    if (!data || typeof data.buyCount !== 'number') return null
    return parseStatic(data)
  } catch {
    return null
  }
}

async function fetchLogsChunked(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  params: {
    address: `0x${string}`
    event: typeof TOKENS_PURCHASED_EVENT | typeof TOKENS_SOLD_EVENT
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
        if (attempt === maxRetries - 1) {
          console.warn('getLogs chunk failed after retries', {
            from: currentFrom.toString(),
            to: currentTo.toString(),
            err,
          })
        } else {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
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

function buildFromLogs(
  buyLogs: any[],
  sellLogs: any[],
  curveAddress: `0x${string}`,
  tokensSold: bigint | undefined,
  blockTimestamps: Map<bigint, number>
): CacheEntry {
  const balances = new Map<string, bigint>()
  for (const log of buyLogs) {
    const buyer = (log.args.buyer as string).toLowerCase()
    balances.set(buyer, (balances.get(buyer) || 0n) + (log.args.tokensOut as bigint))
  }
  for (const log of sellLogs) {
    const seller = (log.args.seller as string).toLowerCase()
    balances.set(seller, (balances.get(seller) || 0n) - (log.args.tokensIn as bigint))
  }
  balances.delete(curveAddress.toLowerCase())
  balances.delete(ZERO)

  const positive = Array.from(balances.entries())
    .filter(([, bal]) => bal > 0n)
    .sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0))

  const sold =
    tokensSold && tokensSold > 0n
      ? tokensSold
      : positive.reduce((acc, [, b]) => acc + b, 0n)

  const holderInfos: HolderInfo[] = positive.slice(0, 20).map(([addr, balance]) => ({
    address: addr as `0x${string}`,
    balance,
    percentage: sold > 0n ? Number((balance * 10000n) / sold) / 100 : 0,
  }))

  let volume = 0n
  for (const log of buyLogs) volume += log.args.quoteIn as bigint
  for (const log of sellLogs) volume += log.args.quoteOut as bigint

  const buyTradeEvents: TradeEvent[] = buyLogs.map((log) => ({
    type: 'buy' as const,
    trader: log.args.buyer as `0x${string}`,
    quoteAmount: log.args.quoteIn as bigint,
    tokenAmount: log.args.tokensOut as bigint,
    newPrice: log.args.newPrice as bigint,
    timestamp: blockTimestamps.get(log.blockNumber!) || Math.floor(Date.now() / 1000),
    txHash: log.transactionHash!,
    blockNumber: log.blockNumber!,
  }))

  const sellTradeEvents: TradeEvent[] = sellLogs.map((log) => ({
    type: 'sell' as const,
    trader: log.args.seller as `0x${string}`,
    quoteAmount: log.args.quoteOut as bigint,
    tokenAmount: log.args.tokensIn as bigint,
    newPrice: log.args.newPrice as bigint,
    timestamp: blockTimestamps.get(log.blockNumber!) || Math.floor(Date.now() / 1000),
    txHash: log.transactionHash!,
    blockNumber: log.blockNumber!,
  }))

  const tradeEvents = [...buyTradeEvents, ...sellTradeEvents]
    .sort((a, b) => b.timestamp - a.timestamp || Number(b.blockNumber - a.blockNumber))
    .slice(0, 50)

  const chronological = [...buyLogs, ...sellLogs].sort(
    (a, b) => Number(a.blockNumber) - Number(b.blockNumber)
  )
  const prices = chronological.map((log) => ({
    time: blockTimestamps.get(log.blockNumber!) || Math.floor(Date.now() / 1000),
    price: Number(formatUnits(log.args.newPrice as bigint, 18)),
  }))
  const deduped = Array.from(
    prices
      .reduce<Map<number, { time: number; price: number }>>((acc, p) => {
        acc.set(p.time, p)
        return acc
      }, new Map())
      .values()
  ).sort((a, b) => a.time - b.time)

  return {
    ts: Date.now(),
    holderCount: positive.length,
    holders: holderInfos,
    totalVolume: volume,
    buyCount: buyLogs.length,
    sellCount: sellLogs.length,
    trades: tradeEvents,
    priceHistory: deduped,
  }
}

export function useTokenAnalytics(
  tokenAddress: `0x${string}`,
  curveAddress: `0x${string}`,
  enabled: boolean = true,
  tokensSold?: bigint
): TokenAnalytics {
  const publicClient = usePublicClient()
  const [holderCount, setHolderCount] = useState(0)
  const [holders, setHolders] = useState<HolderInfo[]>([])
  const [totalVolume, setTotalVolume] = useState(0n)
  const [buyCount, setBuyCount] = useState(0)
  const [sellCount, setSellCount] = useState(0)
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const [priceHistory, setPriceHistory] = useState<{ time: number; price: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)
  const [fetchTrigger, setFetchTrigger] = useState(0)
  const inFlight = useRef(false)
  const staticLoaded = useRef(false)
  const createBlockRef = useRef<bigint | undefined>(undefined)

  const setters = {
    setHolderCount,
    setHolders,
    setTotalVolume,
    setBuyCount,
    setSellCount,
    setTrades,
    setPriceHistory,
  }

  const refetch = useCallback(() => {
    memoryCache.delete(curveAddress?.toLowerCase?.() || '')
    setFetchTrigger((t) => t + 1)
  }, [curveAddress])

  useEffect(() => {
    if (!enabled || !tokenAddress || !curveAddress) {
      setIsLoading(false)
      return
    }

    const cacheKey = curveAddress.toLowerCase()
    const cached = memoryCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS && fetchTrigger === 0) {
      applyEntry(cached, setters)
      setHasData(cached.buyCount > 0 || cached.holderCount > 0 || cached.trades.length > 0)
      setIsLoading(false)
      return
    }

    if (inFlight.current) return
    inFlight.current = true
    let cancelled = false

    const run = async () => {
      try {
        setError(null)
        // Keep showing prior good numbers while refreshing; only spin on first load
        if (!staticLoaded.current && !hasData) {
          setIsLoading(true)
        }

        // 1) Prefer static snapshot shipped with the app
        const staticEntry = await fetchStaticAnalytics(tokenAddress)
        if (cancelled) return

        if (staticEntry) {
          staticLoaded.current = true
          if (staticEntry.createBlock) createBlockRef.current = staticEntry.createBlock
          memoryCache.set(cacheKey, staticEntry)
          applyEntry(staticEntry, setters)
          setHasData(
            staticEntry.buyCount > 0 ||
              staticEntry.holderCount > 0 ||
              staticEntry.trades.length > 0
          )
          setIsLoading(false)
        }

        // 2) Optional live refresh — never wipe good static data on failure
        if (!publicClient) {
          if (!staticEntry) setIsLoading(false)
          return
        }

        try {
          const currentBlock = await publicClient.getBlockNumber()
          let fromBlock: bigint
          if (createBlockRef.current != null) {
            fromBlock = createBlockRef.current
            // Cap live range if create is very old — static already covers history
            const minFrom =
              currentBlock > LIVE_LOOKBACK_BLOCKS
                ? currentBlock - LIVE_LOOKBACK_BLOCKS
                : 0n
            // Prefer createBlock when within lookback; otherwise use lookback tip
            // but keep createBlock if static was empty so we still try full range in small chunks
            if (staticEntry && staticEntry.buyCount > 0 && fromBlock < minFrom) {
              fromBlock = minFrom
            }
          } else {
            fromBlock =
              currentBlock > LIVE_LOOKBACK_BLOCKS
                ? currentBlock - LIVE_LOOKBACK_BLOCKS
                : 0n
          }

          const [buyLogs, sellLogs] = await Promise.all([
            fetchLogsChunked(publicClient, {
              address: curveAddress,
              event: TOKENS_PURCHASED_EVENT,
              fromBlock,
              toBlock: currentBlock,
            }),
            fetchLogsChunked(publicClient, {
              address: curveAddress,
              event: TOKENS_SOLD_EVENT,
              fromBlock,
              toBlock: currentBlock,
            }),
          ])

          if (cancelled) return

          // If live returned nothing and we already have static, keep static
          if (
            buyLogs.length === 0 &&
            sellLogs.length === 0 &&
            staticEntry &&
            (staticEntry.buyCount > 0 || staticEntry.holderCount > 0)
          ) {
            setIsLoading(false)
            return
          }

          // If live is sparse vs static (partial lookback), merge carefully:
          // only replace when live found at least as many buys, or static was empty
          if (
            staticEntry &&
            staticEntry.buyCount > buyLogs.length &&
            staticEntry.buyCount > 0
          ) {
            setIsLoading(false)
            return
          }

          const allTradeLogs = [...buyLogs, ...sellLogs]
          const uniqueBlocks = [
            ...new Set(allTradeLogs.map((log) => log.blockNumber as bigint)),
          ]
          const blockTimestamps = new Map<bigint, number>()
          await Promise.all(
            uniqueBlocks.slice(0, 150).map(async (blockNum) => {
              try {
                const block = await publicClient.getBlock({ blockNumber: blockNum })
                blockTimestamps.set(blockNum, Number(block.timestamp))
              } catch {
                blockTimestamps.set(blockNum, Math.floor(Date.now() / 1000))
              }
            })
          )

          const live = buildFromLogs(
            buyLogs,
            sellLogs,
            curveAddress,
            tokensSold,
            blockTimestamps
          )
          if (createBlockRef.current) live.createBlock = createBlockRef.current
          memoryCache.set(cacheKey, live)
          applyEntry(live, setters)
          setHasData(live.buyCount > 0 || live.holderCount > 0 || live.trades.length > 0)
          setIsLoading(false)
        } catch (liveErr) {
          console.warn('Live analytics refresh failed; keeping static if any', liveErr)
          if (!staticEntry) {
            setError('Failed to load analytics')
          }
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
        setError('Failed to load analytics')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress, curveAddress, enabled, publicClient, fetchTrigger, tokensSold])

  return {
    holderCount,
    holders,
    totalVolume,
    buyCount,
    sellCount,
    trades,
    priceHistory,
    isLoading,
    error,
    refetch,
    hasData,
  }
}
