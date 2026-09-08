import { useState, useMemo, useEffect, useRef } from 'react'
import { useReadContract, useReadContracts, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { BONDING_CURVE_ABI } from '../config/contracts'
import { getFactoryAddress, getNativeSymbol, getExplorerUrl } from '../config/chains'
import { FACTORY_ABI } from '../config/contracts'
import { TokenCard } from './TokenCard'
import { seedTokens, isSeedEnabled } from '../seed/seedTokens'
import { Clock, TrendingUp, Rocket, Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

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

export function TokenList({ onSelectToken, onCreateToken }: TokenListProps) {
  const [activeTab, setActiveTab] = useState<SortTab>('new')
  const [page, setPage] = useState(0)
  const [flashing, setFlashing] = useState<Set<string>>(new Set())
  const seenAddressesRef = useRef<Set<string> | null>(null)
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const seedEnabled = isSeedEnabled()
  const { chainId } = useAccount()

  const factoryAddress = getFactoryAddress(chainId || 5042002)
  const nativeSymbol = getNativeSymbol(chainId || 5042002)
  const explorerUrl = getExplorerUrl(chainId || 5042002)

  const { data: tokenAddresses, isLoading: loadingAddresses } = useReadContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getAllTokens',
  })

  const tokenContracts = tokenAddresses?.map((addr) => ({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getToken' as const,
    args: [addr] as const,
  })) || []

  const { data: tokenInfos, isLoading: loadingInfos } = useReadContracts({
    contracts: tokenContracts,
  })

  const curveContracts = tokenAddresses?.map((_, i) => {
    const info = tokenInfos?.[i]
    if (info?.status !== 'success') return null
    return {
      address: (info.result as TokenInfo).curve,
      abi: BONDING_CURVE_ABI,
      functionName: 'state' as const,
    }
  }).filter(Boolean) || []

  const { data: curveStates } = useReadContracts({
    contracts: curveContracts as any[],
  })

  const realTokens: TokenInfo[] = useMemo(() => {
    return tokenInfos
      ?.filter((r) => r.status === 'success')
      .map((r) => r.result as TokenInfo) || []
  }, [tokenInfos])

  const allTokens: TokenInfo[] = useMemo(() => {
    if (realTokens.length > 0) {
      if (seedEnabled) {
        return [...realTokens, ...(seedTokens as TokenInfo[])]
      }
      return realTokens
    }
    return seedEnabled ? (seedTokens as TokenInfo[]) : []
  }, [realTokens, seedEnabled])

  const sortedTokens = useMemo(() => {
    const tokensWithState = allTokens.map((token) => {
      if (token.isSeed && token.state) {
        const raised = Number(formatUnits(token.state.realQuoteRaised, 18))
        const progress = (raised / 100) * 100
        return { ...token, raised, progress }
      }
      
      const realIndex = realTokens.findIndex(t => t.token === token.token)
      const stateResult = realIndex >= 0 ? curveStates?.[realIndex] : null
      const state = stateResult?.status === 'success' ? stateResult.result as TokenState : null
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
  }, [allTokens, realTokens, curveStates, activeTab])

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

  const isLoading = loadingAddresses || loadingInfos

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
          The quickest way to launch memes
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Create a memecoin in seconds. Trade on a bonding curve. Graduate to DEX.
        </p>
        <button
          onClick={onCreateToken}
          className="px-5 py-2.5 btn-primary rounded-lg text-sm font-medium"
        >
          Create token
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] mb-4">
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

      {/* Token grid — desktop exactly 3 cols × 7 rows (21/page) */}
      {isLoading && !seedEnabled ? (
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
    </div>
  )
}
