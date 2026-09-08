import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { BONDING_CURVE_ABI } from '../config/contracts'
import { getNativeSymbol, getExplorerUrl } from '../config/chains'
import { X, Zap, ExternalLink, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { resolveTokenImage } from '../utils/tokenImage'

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

interface YeetModalProps {
  isOpen: boolean
  onClose: () => void
  tokens: TokenInfo[]
  onSelectToken: (token: TokenInfo) => void
}

const YEET_AMOUNT = 1

export function YeetModal({ isOpen, onClose, tokens, onSelectToken }: YeetModalProps) {
  const { address, isConnected, chainId } = useAccount()
  const { data: balance } = useBalance({ address })
  const nativeSymbol = getNativeSymbol(chainId || 5042002)
  const explorerUrl = getExplorerUrl(chainId || 5042002)

  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)

  const eligibleTokens = useMemo(() => {
    return tokens.filter(t => {
      if (t.graduated || t.isSeed) return false
      if (!t.state) return false
      const raised = Number(formatUnits(t.state.realQuoteRaised, 18))
      return raised > 0.01
    })
  }, [tokens])

  const pickRandomToken = () => {
    if (eligibleTokens.length === 0) {
      toast.error('No eligible tokens to yeet!')
      return
    }
    
    setIsSpinning(true)
    
    let spinCount = 0
    const maxSpins = 15
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * eligibleTokens.length)
      setSelectedToken(eligibleTokens[randomIndex])
      spinCount++
      
      if (spinCount >= maxSpins) {
        clearInterval(interval)
        setIsSpinning(false)
        const finalIndex = Math.floor(Math.random() * eligibleTokens.length)
        setSelectedToken(eligibleTokens[finalIndex])
      }
    }, 80 + spinCount * 10)
  }

  useEffect(() => {
    if (isOpen && eligibleTokens.length > 0 && !selectedToken) {
      pickRandomToken()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setSelectedToken(null)
    }
  }, [isOpen])

  const amountInWei = parseUnits(YEET_AMOUNT.toString(), 18)

  const { data: buyQuote } = useReadContract({
    address: selectedToken?.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getBuyQuote',
    args: [amountInWei],
    query: { enabled: !!selectedToken && !selectedToken.isSeed && !selectedToken.graduated },
  })

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      toast.success(`YEETED into $${selectedToken?.symbol}! 🚀`)
      reset()
      onClose()
      if (selectedToken) {
        onSelectToken(selectedToken)
      }
    }
  }, [isSuccess])

  const handleYeet = () => {
    if (!selectedToken || !isConnected) {
      toast.error('Connect wallet to yeet!')
      return
    }

    const minTokens = buyQuote
      ? ((buyQuote as readonly [bigint, bigint, bigint])[0] * 95n) / 100n
      : 0n

    writeContract({
      address: selectedToken.curve,
      abi: BONDING_CURVE_ABI,
      functionName: 'buy',
      args: [minTokens],
      value: amountInWei,
    })
  }

  let metadata: { image?: string; description?: string } = {}
  try {
    metadata = JSON.parse(selectedToken?.metadataURI || '{}')
    if (metadata?.image) {
      metadata.image = resolveTokenImage(metadata.image)
    }
  } catch {}

  const tokensReceived = buyQuote
    ? Number(formatUnits((buyQuote as readonly [bigint, bigint, bigint])[0], 18))
    : 0

  const userBalance = balance ? Number(formatUnits(balance.value, 18)) : 0
  const hasEnoughBalance = userBalance >= YEET_AMOUNT

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm yeet-modal rounded-xl p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#ff1493]" />
            <h2 className="text-lg font-bold bg-gradient-to-r from-[#ff1493] via-[#ffff00] to-[#39ff14] bg-clip-text text-transparent">
              YEET MODE
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {eligibleTokens.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-secondary)] mb-2">No eligible tokens</p>
            <p className="text-xs text-[var(--text-muted)]">
              Need live, non-graduated tokens with some activity
            </p>
          </div>
        ) : (
          <>
            <div className={`bg-black/30 rounded-lg p-4 mb-4 border border-[rgba(0,255,255,0.2)] ${isSpinning ? 'animate-pulse' : ''}`}>
              {selectedToken ? (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-xl font-bold overflow-hidden shrink-0">
                    {metadata.image ? (
                      <img
                        src={metadata.image}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="text-[var(--text-secondary)]">
                        {selectedToken.symbol.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] truncate">
                      {selectedToken.name}
                    </p>
                    <p className="text-sm text-[var(--chaos-neon-cyan)]">
                      ${selectedToken.symbol}
                    </p>
                    {selectedToken.state && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {Number(formatUnits(selectedToken.state.realQuoteRaised, 18)).toFixed(2)} {nativeSymbol} raised
                      </p>
                    )}
                  </div>
                  <a
                    href={`${explorerUrl}/address/${selectedToken.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center h-14">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--chaos-neon-cyan)]" />
                </div>
              )}
            </div>

            <button
              onClick={pickRandomToken}
              disabled={isSpinning || isPending || isConfirming}
              className="w-full py-2 mb-3 rounded-lg text-sm font-medium btn-normal disabled:opacity-50"
            >
              {isSpinning ? '🎰 Spinning...' : '🎲 Pick another'}
            </button>

            <div className="bg-black/20 rounded-lg p-3 mb-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">You pay</span>
                <span className="font-medium text-[var(--text-primary)]">{YEET_AMOUNT} {nativeSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">You get ~</span>
                <span className="font-medium text-[var(--chaos-neon-green)]">
                  {tokensReceived > 0 
                    ? tokensReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : '...'
                  } {selectedToken?.symbol || '???'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Your balance</span>
                <span className={`${hasEnoughBalance ? 'text-[var(--text-tertiary)]' : 'text-[var(--red)]'}`}>
                  {userBalance.toFixed(4)} {nativeSymbol}
                </span>
              </div>
            </div>

            {!isConnected ? (
              <p className="text-center text-sm text-[var(--text-tertiary)]">
                Connect wallet to YEET
              </p>
            ) : !hasEnoughBalance ? (
              <p className="text-center text-sm text-[var(--red)]">
                Need at least {YEET_AMOUNT} {nativeSymbol}
              </p>
            ) : (
              <button
                onClick={handleYeet}
                disabled={isPending || isConfirming || isSpinning || !selectedToken}
                className="w-full py-3 rounded-lg text-sm font-bold btn-yeet disabled:opacity-50 disabled:animation-none"
              >
                {isPending || isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isConfirming ? 'Confirming...' : 'Yeeting...'}
                  </span>
                ) : (
                  `🚀 YEET ${YEET_AMOUNT} ${nativeSymbol}`
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
