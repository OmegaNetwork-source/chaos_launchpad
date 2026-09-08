import { useState, useMemo, useEffect, useRef } from 'react'
import { useReadContract, useReadContracts, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { BONDING_CURVE_ABI } from '../config/contracts'
import { getFactoryAddress, getNativeSymbol, getExplorerUrl } from '../config/chains'
import { FACTORY_ABI } from '../config/contracts'
import { TokenCard } from './TokenCard'
import { seedTokens, isSeedEnabled } from '../seed/seedTokens'
import { useTokenCache } from '../hooks/useTokenCache'
import { useChaos } from '../context/ChaosContext'
import { YeetModal } from './YeetModal'
import { Clock, TrendingUp, Rocket, Loader2, ExternalLink, ChevronLeft, ChevronRight, RefreshCw, Zap, Sparkles } from 'lucide-react'

interface TokenState {
  virtualQuote: bigint
  virtualTokens: bigint
  realQuoteRaised: bigint
  tokensSold: bigint
  graduated: boolean
  pair: `0x${string}`
}

interface TokenInfo {
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

interface TokenListProps {
  onSelectToken: (tokenInfo: TokenInfo) => void
  onCreateToken: () => void
}

type SortTab = 'new' | 'graduating' | 'graduated'

const PAGE_SIZE = 21
const NEW_FLASH_MS = 1800

// Wagmi query options for stable caching - VERY conservative to avoid RPC thrashing
const QUERY_OPTIONS = {
  staleTime: 60_000, // 60 seconds before data is considered stale
  gcTime: 10 * 60_000, // 10 minutes garbage collection time
  refetchOnWindowFocus: false, // CRITICAL: Disable refetch on window focus
  refetchOnReconnect: false, // Don't refetch on reconnect
  refetchOnMount: false, // Don't refetch on component mount if data exists
  refetchInterval: false as const, // No automatic interval refetch
  retry: 1, // Only retry once to avoid hammering rate-limited RPC
  retryDelay: 3000, // 3 second delay between retries
}

export function TokenList({ onSelectToken, onCreateToken }: TokenListProps) {
  const [activeTab, setActiveTab] = useState<SortTab>('new')
  const [page, setPage] = useState(0)
  const [flashing, setFlashing] = useState<Set<string>>(new Set())
  const [showYeet, setShowYeet] = useState(false)
  const seenAddressesRef = useRef<Set<string> | null>(null)
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const seedEnabled = isSeedEnabled()
  const { chainId } = useAccount()
  const { isChaosMode, enableChaosMode, disableChaosMode } = useChaos()

  const factoryAddress = getFactoryAddress(chainId || 5042002)
  const nativeSymbol = getNativeSymbol(chainId || 5042002)
  const explorerUrl = getExplorerUrl(chainId || 5042002)

  // Initialize token cache
  const { cachedTokens, updateCache, hasCache } = useTokenCache(chainId || 5042002, factoryAddress)

  // First, get the token count to verify if factory really has tokens
  // This is a cheap call that helps us distinguish "RPC failed" from "truly empty"
  const { data: tokenCount, isLoading: loadingCount } = useReadContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getTokenCount',
    query: QUERY_OPTIONS,
  })

  const { data: tokenAddresses, isLoading: loadingAddresses, isFetching: fetchingAddresses, isError: addressesError } = useReadContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getAllTokens',
    query: QUERY_OPTIONS,
  })

  const tokenContracts = tokenAddresses?.map((addr) => ({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getToken' as const,
    args: [addr] as const,
  })) || []

  const { data: tokenInfos, isLoading: loadingInfos, isFetching: fetchingInfos, isError: infosError } = useReadContracts({
    contracts: tokenContracts,
    query: {
      ...QUERY_OPTIONS,
      enabled: tokenContracts.length > 0,
    },
  })

  const curveContracts = (tokenAddresses?.map((_, i) => {
    const info = tokenInfos?.[i]
    if (info?.status !== 'success') return null
    return {
      address: (info.result as TokenInfo).curve,
      abi: BONDING_CURVE_ABI,
      functionName: 'state' as const,
    }
  }).filter((c): c is NonNullable<typeof c> => c !== null) || []) as {
    address: `0x${string}`
    abi: typeof BONDING_CURVE_ABI
    functionName: 'state'
  }[]

  const { data: curveStates, isFetching: fetchingStates } = useReadContracts({
    contracts: curveContracts,
    query: {
      ...QUERY_OPTIONS,
      enabled: curveContracts.length > 0,
    },
  })

  // Build real tokens from RPC data
  const realTokens: TokenInfo[] = useMemo(() => {
    return tokenInfos
      ?.filter((r) => r.status === 'success')
      .map((r) => r.result as TokenInfo) || []
  }, [tokenInfos])

  // Merge real tokens with curve states
  const realTokensWithState: TokenInfo[] = useMemo(() => {
    return realTokens.map((token, index) => {
      const stateResult = curveStates?.[index]
      if (stateResult?.status === 'success') {
        return { ...token, state: stateResult.result as TokenState }
      }
      // Fall back to cached state if RPC state failed
      const cached = cachedTokens.find(t => t.token.toLowerCase() === token.token.toLowerCase())
      if (cached?.state) {
        return { ...token, state: cached.state }
      }
      return token
    })
  }, [realTokens, curveStates, cachedTokens])

  // CRITICAL: Only update cache if we got REAL data
  // Never cache empty arrays unless we've verified tokenCount === 0
  useEffect(() => {
    // We have fresh tokens - update cache
    if (realTokensWithState.length > 0) {
      updateCache(realTokensWithState)
      return
    }
    
    // Don't clear cache on empty results - the RPC might have failed silently
    // Only scenario where we'd clear: tokenCount is explicitly 0 AND no errors
    // But even then, keep the cache - it doesn't hurt and protects against edge cases
  }, [realTokensWithState, updateCache])

  // Determine if the empty result is legitimate or a failed fetch
  // A fetch is considered failed if:
  // 1. tokenAddresses is empty/undefined but tokenCount > 0
  // 2. There was an explicit error
  // 3. We have cache but RPC returned empty (cache takes priority)
  const isRpcFailure = useMemo(() => {
    // If we have a tokenCount and it's > 0 but no addresses, RPC failed
    if (tokenCount !== undefined && Number(tokenCount) > 0 && (!tokenAddresses || tokenAddresses.length === 0)) {
      return true
    }
    // Explicit errors
    if (addressesError || infosError) {
      return true
    }
    // Have cache but RPC returned empty - trust the cache
    if (hasCache && (!tokenAddresses || tokenAddresses.length === 0) && !loadingAddresses) {
      return true
    }
    return false
  }, [tokenCount, tokenAddresses, addressesError, infosError, hasCache, loadingAddresses])

  // Determine what tokens to display:
  // PRIORITY ORDER:
  // 1. Fresh RPC data if available AND not empty
  // 2. Cached data (always, if RPC empty/failed)
  // 3. Empty only if no cache AND verified empty (tokenCount === 0)
  const displayTokens: TokenInfo[] = useMemo(() => {
    // If we have fresh RPC data with actual tokens, use it
    if (realTokensWithState.length > 0) {
      return realTokensWithState
    }
    
    // If RPC returned empty but we have cache, ALWAYS use cache
    // This is the stale-while-revalidate pattern
    if (cachedTokens.length > 0) {
      return cachedTokens
    }
    
    // Only return empty if we're sure there are no tokens
    // (no cache, and tokenCount is explicitly 0 or undefined with no loading)
    return []
  }, [realTokensWithState, cachedTokens])

  // Combine display tokens with seed tokens if enabled
  const allTokens: TokenInfo[] = useMemo(() => {
    if (displayTokens.length > 0) {
      if (seedEnabled) {
        return [...displayTokens, ...(seedTokens as TokenInfo[])]
      }
      return displayTokens
    }
    return seedEnabled ? (seedTokens as TokenInfo[]) : []
  }, [displayTokens, seedEnabled])

  const sortedTokens = useMemo(() => {
    const tokensWithState = allTokens.map((token) => {
      if (token.isSeed && token.state) {
        const raised = Number(formatUnits(token.state.realQuoteRaised, 18))
        const progress = (raised / 100) * 100
        return { ...token, raised, progress }
      }
      
      const state = token.state
      const raised = state ? Number(state.realQuoteRaised) / 1e18 : 0
      const progress = (raised / 100) * 100
      return { ...token, raised, progress }
    })

    const sortByRealFirst = (a: typeof tokensWithState[0], b: typeof tokensWithState[0]) => {
      if (a.isSeed && !b.isSeed) return 1
      if (!a.isSeed && b.isSeed) return -1
      return 0
    }

    switch (activeTab) {
      case 'new':
        return [...tokensWithState]
          .filter(t => !t.graduated)
          .sort((a, b) => sortByRealFirst(a, b) || Number(b.createdAt - a.createdAt))
      case 'graduating':
        return [...tokensWithState]
          .filter(t => !t.graduated && t.progress >= 50)
          .sort((a, b) => sortByRealFirst(a, b) || b.progress - a.progress)
      case 'graduated':
        return [...tokensWithState]
          .filter(t => t.graduated)
          .sort((a, b) => sortByRealFirst(a, b) || Number(b.createdAt - a.createdAt))
      default:
        return tokensWithState
    }
  }, [allTokens, activeTab])

  // Reset page when tab or filtered list shrinks
  useEffect(() => {
    setPage(0)
  }, [activeTab])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedTokens.length / PAGE_SIZE) - 1)
    if (page > maxPage) setPage(maxPage)
  }, [sortedTokens.length, page])

  // Flash newly seen token addresses when the sorted list updates
  useEffect(() => {
    const addresses = sortedTokens.map((t) => t.token.toLowerCase())
    if (seenAddressesRef.current === null) {
      // First paint: seed the set without flashing existing tokens
      seenAddressesRef.current = new Set(addresses)
      return
    }
    const prev = seenAddressesRef.current
    const newcomers = addresses.filter((a) => !prev.has(a))
    if (newcomers.length === 0) {
      // Still refresh the full set (covers removals / tab switches)
      for (const a of addresses) prev.add(a)
      return
    }
    for (const a of newcomers) prev.add(a)
    setFlashing((cur) => {
      const next = new Set(cur)
      for (const a of newcomers) next.add(a)
      return next
    })
    for (const a of newcomers) {
      const existing = flashTimersRef.current.get(a)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        setFlashing((cur) => {
          const next = new Set(cur)
          next.delete(a)
          return next
        })
        flashTimersRef.current.delete(a)
      }, NEW_FLASH_MS)
      flashTimersRef.current.set(a, timer)
    }
  }, [sortedTokens])

  useEffect(() => {
    return () => {
      for (const t of flashTimersRef.current.values()) clearTimeout(t)
      flashTimersRef.current.clear()
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(sortedTokens.length / PAGE_SIZE))
  const pageTokens = useMemo(() => {
    const start = page * PAGE_SIZE
    return sortedTokens.slice(start, start + PAGE_SIZE)
  }, [sortedTokens, page])

  // Determine loading states:
  // - isInitialLoading: First load with no cache AND no seed (show full spinner)
  // - isRefreshing: Have cache/data but fetching fresh data (show subtle indicator)
  // CRITICAL: Never show initial loading if we have cache - that's the whole point!
  const isInitialLoading = (loadingCount || loadingAddresses || loadingInfos) && !hasCache && !seedEnabled && sortedTokens.length === 0
  const isRefreshing = (fetchingAddresses || fetchingInfos || fetchingStates) && (hasCache || sortedTokens.length > 0)

  if (factoryAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No factory deployed</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Deploy contracts to get started
        </p>
        <code className="text-xs text-[var(--text-tertiary)] block bg-[var(--bg-card)] p-3 rounded-lg font-mono">
          forge script script/Deploy.s.sol --broadcast
        </code>
      </div>
    )
  }

  const tabs: { id: SortTab; label: string; icon: typeof Clock }[] = [
    { id: 'new', label: 'New', icon: Clock },
    { id: 'graduating', label: 'About to graduate', icon: TrendingUp },
    { id: 'graduated', label: 'Graduated', icon: Rocket },
  ]

  const tokenCounts = {
    new: allTokens.filter(t => !t.graduated).length,
    graduating: allTokens.filter(t => !t.graduated).length,
    graduated: allTokens.filter(t => t.graduated).length,
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero - minimal */}
      <div className="text-center py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mb-2">
          {isChaosMode ? '⚡ CHAOS UNLEASHED ⚡' : 'The quickest way to launch memes'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {isChaosMode 
            ? 'Embrace the chaos. YEET into random memecoins. No regrets.'
            : 'Create a memecoin in seconds. Trade on a bonding curve. Graduate to DEX.'
          }
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onCreateToken}
            className="px-5 py-2.5 btn-primary rounded-lg text-sm font-medium"
          >
            Create token
          </button>
          {isChaosMode ? (
            <>
              <button
                onClick={() => setShowYeet(true)}
                className="px-5 py-2.5 btn-yeet rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                YEET
              </button>
              <button
                onClick={disableChaosMode}
                className="px-4 py-2.5 btn-normal rounded-lg text-sm font-medium"
              >
                ← Normal
              </button>
            </>
          ) : (
            <button
              onClick={enableChaosMode}
              className="px-5 py-2.5 btn-chaos rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Chaos
            </button>
          )}
        </div>
      </div>

      {/* Tabs with refresh indicator */}
      <div className="flex items-center justify-between border-b border-[var(--border)] mb-4">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tokenCounts[tab.id] > 0 && (
                <span className="text-xs text-[var(--text-muted)] ml-1">
                  {tokenCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Subtle refresh indicator - also show if RPC failed but we're using cache */}
        {(isRefreshing || isRpcFailure) && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] pr-2">
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRpcFailure && !isRefreshing ? 'Using cached data' : 'Updating...'}</span>
          </div>
        )}
      </div>

      {/* Token grid — desktop exactly 3 cols × 7 rows (21/page) */}
      {isInitialLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
        </div>
      ) : sortedTokens.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-[var(--text-tertiary)] mb-4">
            {activeTab === 'graduated' 
              ? 'No graduated tokens yet' 
              : activeTab === 'graduating'
                ? 'No tokens close to graduation'
                : 'No tokens yet'}
          </p>
          {activeTab === 'new' && (
            <button
              onClick={onCreateToken}
              className="px-4 py-2 btn-secondary rounded-lg text-sm"
            >
              Create first token
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pageTokens.map((token) => (
              <TokenCard
                key={token.token}
                tokenInfo={token}
                onClick={() => onSelectToken(token)}
                nativeSymbol={nativeSymbol}
                isNew={flashing.has(token.token.toLowerCase())}
              />
            ))}
          </div>

          {sortedTokens.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm text-[var(--text-tertiary)] font-mono tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Explorer link */}
      {explorerUrl && (
        <div className="mt-8 text-center">
          <a
            href={`${explorerUrl}/address/${factoryAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            View factory on explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Yeet Modal */}
      <YeetModal
        isOpen={showYeet}
        onClose={() => setShowYeet(false)}
        tokens={allTokens}
        onSelectToken={onSelectToken}
      />
    </div>
  )
}
