import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { X, Loader2, ExternalLink, ArrowUpDown, RefreshCw, Bot, Zap, User } from 'lucide-react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import type { SortField } from '../hooks/useLeaderboard'
import { getSwarmBadge } from '../config/swarmWallets'
import { getExplorerUrl, getNativeSymbol } from '../config/chains'

interface LeaderboardProps {
  isOpen: boolean
  onClose: () => void
  chainId?: number
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatVolume(vol: bigint): string {
  const num = Number(formatUnits(vol, 18))
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toFixed(2)
}

function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return ''
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return diffMins <= 1 ? 'just now' : `${diffMins}m ago`
      }
      return `${diffHours}h ago`
    }
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function SwarmBadge({ type }: { type: string }) {
  const config: Record<string, { icon: typeof Bot; label: string; className: string }> = {
    deployer: {
      icon: Zap,
      label: 'deployer',
      className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    bot: {
      icon: Bot,
      label: 'bot',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    tester: {
      icon: User,
      label: 'tester',
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    swarm: {
      icon: Bot,
      label: 'swarm',
      className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    },
  }

  const { icon: Icon, label, className } = config[type] || config.swarm

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${className}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

function SortButton({
  field,
  current,
  onClick,
  children,
}: {
  field: SortField
  current: SortField
  onClick: (field: SortField) => void
  children: React.ReactNode
}) {
  const isActive = field === current
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 transition-colors ${
        isActive
          ? 'text-[var(--text-primary)] font-medium'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${isActive ? 'opacity-100' : 'opacity-50'}`} />
    </button>
  )
}

export function Leaderboard({ isOpen, onClose, chainId = 5042002 }: LeaderboardProps) {
  const { entries, isLoading, error, refetch, hasData, generatedAt } = useLeaderboard(chainId)
  const [sortBy, setSortBy] = useState<SortField>('chaosVolume')

  const explorerUrl = getExplorerUrl(chainId)
  const nativeSymbol = getNativeSymbol(chainId)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      switch (sortBy) {
        case 'tokensLaunched':
          return b.tokensLaunched - a.tokensLaunched
        case 'feesClaimed':
          return a.feesClaimed > b.feesClaimed ? -1 : a.feesClaimed < b.feesClaimed ? 1 : 0
        case 'chaosVolume':
        default:
          return a.chaosVolume > b.chaosVolume ? -1 : a.chaosVolume < b.chaosVolume ? 1 : 0
      }
    })
  }, [entries, sortBy])

  if (!isOpen) return null

  const relativeDate = formatRelativeDate(generatedAt)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Leaderboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refetch}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              title="Refresh snapshot"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sort tabs */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-4">
          <span className="text-xs text-[var(--text-muted)]">Sort by:</span>
          <div className="flex items-center gap-3 text-xs">
            <SortButton field="chaosVolume" current={sortBy} onClick={setSortBy}>
              Chaos Volume
            </SortButton>
            <SortButton field="tokensLaunched" current={sortBy} onClick={setSortBy}>
              Launched
            </SortButton>
            <SortButton field="feesClaimed" current={sortBy} onClick={setSortBy}>
              Fees Claimed
            </SortButton>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && !hasData ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 text-[var(--text-tertiary)] animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">Loading leaderboard…</p>
            </div>
          ) : error && !hasData ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
              <button
                onClick={refetch}
                className="px-4 py-2 text-sm btn-primary rounded-lg"
              >
                Try again
              </button>
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-[var(--text-secondary)]">No activity yet</p>
              <p className="text-xs text-[var(--text-muted)]">Be the first to trade on Chaos!</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wide sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)]">
                <div className="col-span-1">#</div>
                <div className="col-span-4 sm:col-span-3">Wallet</div>
                <div className="col-span-2 text-right hidden sm:block">Launched</div>
                <div className="col-span-3 text-right">Fees ({nativeSymbol})</div>
                <div className="col-span-4 sm:col-span-3 text-right">Volume ({nativeSymbol})</div>
              </div>

              {/* Table rows */}
              {sortedEntries.map((entry, index) => {
                const badge = getSwarmBadge(entry.wallet)
                const rank = index + 1
                const isTop3 = rank <= 3

                return (
                  <div
                    key={entry.wallet}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm hover:bg-[var(--bg-hover)] transition-colors ${
                      isTop3 ? 'bg-[var(--bg-secondary)]/50' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      {isTop3 ? (
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            rank === 1
                              ? 'bg-amber-500/20 text-amber-400'
                              : rank === 2
                                ? 'bg-gray-400/20 text-gray-300'
                                : 'bg-amber-700/20 text-amber-600'
                          }`}
                        >
                          {rank}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">{rank}</span>
                      )}
                    </div>

                    {/* Wallet */}
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-2 min-w-0">
                      <a
                        href={`${explorerUrl}/address/${entry.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs inline-flex items-center gap-1 truncate"
                      >
                        {shortAddr(entry.wallet)}
                        <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                      </a>
                      {badge && <SwarmBadge type={badge} />}
                    </div>

                    {/* Tokens Launched */}
                    <div className="col-span-2 text-right hidden sm:block">
                      {entry.tokensLaunched > 0 ? (
                        <span className="text-[var(--text-primary)] font-medium">{entry.tokensLaunched}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </div>

                    {/* Fees Claimed */}
                    <div className="col-span-3 text-right">
                      {entry.feesClaimed > 0n ? (
                        <span className="text-[var(--green)] font-mono text-xs">
                          {formatVolume(entry.feesClaimed)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </div>

                    {/* Chaos Volume */}
                    <div className="col-span-4 sm:col-span-3 text-right">
                      {entry.chaosVolume > 0n ? (
                        <span className="text-[var(--text-primary)] font-mono text-xs font-medium">
                          {formatVolume(entry.chaosVolume)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center justify-center">
          <span>
            Snapshot · refreshes every 24 hours
            {relativeDate && <span className="ml-1">· Updated {relativeDate}</span>}
          </span>
        </div>
      </div>
    </div>
  )
}
