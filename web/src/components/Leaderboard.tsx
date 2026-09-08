import { useEffect, useState } from 'react'
import { X, Trophy, Users, TrendingUp, Coins, Clock, Loader2 } from 'lucide-react'

interface LeaderboardCreator {
  rank: number
  address: string
  tokensCreated: number
  totalRaised: string
  graduatedCount: number
}

interface LeaderboardTrader {
  rank: number
  address: string
  totalVolume: string
  tradesCount: number
  profitLoss: string
}

interface LeaderboardStats {
  totalTokens: number
  graduatedTokens: number
  totalVolume: string
  uniqueTraders: number
}

interface LeaderboardData {
  generatedAt: string
  chainId: number
  factory: string
  topCreators: LeaderboardCreator[]
  topTraders: LeaderboardTrader[]
  stats: LeaderboardStats
}

interface LeaderboardProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'creators' | 'traders'

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#FFD700]/20 text-[#FFD700] text-xs font-bold">1</span>
  }
  if (rank === 2) {
    return <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#C0C0C0]/20 text-[#C0C0C0] text-xs font-bold">2</span>
  }
  if (rank === 3) {
    return <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#CD7F32]/20 text-[#CD7F32] text-xs font-bold">3</span>
  }
  return <span className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] text-xs font-medium">{rank}</span>
}

export function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('creators')

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

  useEffect(() => {
    if (!isOpen) return
    
    setLoading(true)
    setError(null)
    
    fetch('/board/leaderboard.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load leaderboard')
        return res.json()
      })
      .then((json: LeaderboardData) => {
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        console.error('Leaderboard load error:', err)
        setError('Failed to load leaderboard data')
        setLoading(false)
      })
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-[#FFD700] shrink-0" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Leaderboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* Snapshot notice */}
              <div className="px-4 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Clock className="w-3 h-3" />
                  <span>Snapshot · refreshes every 24 hours</span>
                  {data.generatedAt && (
                    <span className="text-[var(--text-tertiary)]">· {formatTimeAgo(data.generatedAt)}</span>
                  )}
                </div>
              </div>

              {/* Stats summary */}
              <div className="grid grid-cols-2 gap-3 p-4">
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Total Tokens</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{data.stats.totalTokens}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Graduated</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{data.stats.graduatedTokens}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Total Volume</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{data.stats.totalVolume} USDC</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Unique Traders</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{data.stats.uniqueTraders.toLocaleString()}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 border-b border-[var(--border)]">
                <button
                  onClick={() => setActiveTab('creators')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'creators'
                      ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Top Creators
                </button>
                <button
                  onClick={() => setActiveTab('traders')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === 'traders'
                      ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Top Traders
                </button>
              </div>

              {/* Leaderboard list */}
              <div className="p-4 space-y-2">
                {activeTab === 'creators' ? (
                  data.topCreators.map((creator) => (
                    <div
                      key={creator.address}
                      className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg"
                    >
                      <RankBadge rank={creator.rank} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-[var(--text-primary)] truncate">
                          {shortAddr(creator.address)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {creator.tokensCreated} tokens
                          </span>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {creator.graduatedCount} graduated
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {creator.totalRaised}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">USDC raised</p>
                      </div>
                    </div>
                  ))
                ) : (
                  data.topTraders.map((trader) => (
                    <div
                      key={trader.address}
                      className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg"
                    >
                      <RankBadge rank={trader.rank} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-[var(--text-primary)] truncate">
                          {shortAddr(trader.address)}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                          {trader.tradesCount} trades
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {trader.totalVolume} USDC
                        </p>
                        <p className={`text-xs ${
                          trader.profitLoss.startsWith('+') 
                            ? 'text-[var(--green)]' 
                            : trader.profitLoss.startsWith('-')
                              ? 'text-[var(--red)]'
                              : 'text-[var(--text-muted)]'
                        }`}>
                          {trader.profitLoss} P/L
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
