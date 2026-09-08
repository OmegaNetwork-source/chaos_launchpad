import { formatUnits } from 'viem'
import { useReadContract } from 'wagmi'
import { BONDING_CURVE_ABI } from '../config/contracts'
import { useMemo } from 'react'
import { formatCompactPrice } from '../utils/format'

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

interface TokenCardProps {
  tokenInfo: TokenInfo
  onClick: () => void
  nativeSymbol?: string
  isNew?: boolean
}

export function TokenCard({ tokenInfo, onClick, nativeSymbol = 'USDC', isNew = false }: TokenCardProps) {
  const isSeed = tokenInfo.isSeed === true
  
  const { data: chainState } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'state',
    query: { enabled: !isSeed },
  })

  const { data: chainPrice } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getCurrentPrice',
    query: { enabled: !isSeed },
  })

  const { data: chainProgress } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getProgress',
    query: { enabled: !isSeed },
  })

  const curveState = isSeed ? tokenInfo.state : chainState
  
  const seedPrice = useMemo(() => {
    if (!isSeed || !tokenInfo.state) return 0
    const virtualQuote = Number(formatUnits(tokenInfo.state.virtualQuote, 18))
    const virtualTokens = Number(formatUnits(tokenInfo.state.virtualTokens, 18))
    return virtualTokens > 0 ? virtualQuote / virtualTokens : 0
  }, [isSeed, tokenInfo.state])
  
  const seedProgress = useMemo(() => {
    if (!isSeed || !tokenInfo.state) return 0
    const raised = Number(formatUnits(tokenInfo.state.realQuoteRaised, 18))
    return (raised / 100) * 100
  }, [isSeed, tokenInfo.state])

  const progressPercent = isSeed ? seedProgress : (chainProgress ? Number(chainProgress) / 100 : 0)
  const raisedAmount = curveState ? Number(formatUnits(curveState.realQuoteRaised, 18)) : 0
  const price = isSeed ? seedPrice : (chainPrice ? Number(formatUnits(chainPrice, 18)) : 0)
  const isNearGrad = progressPercent >= 80

  const timeAgo = () => {
    const seconds = Math.floor(Date.now() / 1000 - Number(tokenInfo.createdAt))
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
  }

  let imageUrl = ''
  try {
    const meta = JSON.parse(tokenInfo.metadataURI || '{}')
    imageUrl = meta.image || ''
  } catch {}

  return (
    <div
      onClick={onClick}
      className={`card-hover bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 cursor-pointer${isNew ? ' token-card-new' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Token avatar */}
        <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden text-[var(--text-secondary)]">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          ) : (
            tokenInfo.symbol.slice(0, 2)
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name & badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{tokenInfo.name}</h3>
            {tokenInfo.graduated && <span className="badge badge-graduated">graduated</span>}
            {isNearGrad && !tokenInfo.graduated && <span className="badge badge-hot">hot</span>}
            {isNew && <span className="badge badge-new">new</span>}
          </div>
          
          {/* Ticker & time */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-[var(--text-tertiary)]">${tokenInfo.symbol}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-xs text-[var(--text-tertiary)]">{timeAgo()}</span>
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-[var(--text-primary)] font-mono">
            {formatCompactPrice(price)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {!tokenInfo.graduated && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--text-tertiary)]">
              {raisedAmount.toFixed(1)} {nativeSymbol}
            </span>
            <span className={isNearGrad ? 'text-[#5eead4]' : 'text-[var(--text-tertiary)]'}>
              {progressPercent.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar h-1">
            <div 
              className={`progress-bar-fill ${isNearGrad ? 'near-grad' : ''}`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
