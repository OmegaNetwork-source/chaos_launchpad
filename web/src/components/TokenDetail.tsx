import { useState, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi'
import { formatUnits, parseUnits, zeroAddress } from 'viem'
import {
  BONDING_CURVE_ABI,
  TOKEN_ABI,
  ERC20_ABI,
  SIMPLE_PAIR_ABI,
  PROTOCOL_FEE_BPS,
  CREATOR_FEE_BPS,
  PROTOCOL_POST_GRAD_FEE_BPS,
} from '../config/contracts'
import { getExplorerUrl, getNativeSymbol } from '../config/chains'
import { getQuoteToken, isNativeQuote } from '../config/quoteTokens'
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Wallet,
  Twitter,
  MessageCircle,
  Globe,
  Hash,
  Users,
  Activity,
  Loader2,
  ArrowDownUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatPrice } from '../utils/format'
import { PriceChart } from './PriceChart'
import { useTokenAnalytics } from '../hooks/useTokenAnalytics'

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
  quoteToken?: `0x${string}`
}

interface TokenSocials {
  twitter?: string
  telegram?: string
  website?: string
  discord?: string
}

interface TokenMetadata {
  description?: string
  image?: string
  socials?: TokenSocials
}

interface TokenDetailProps {
  tokenInfo: TokenInfo
  onBack: () => void
}

function formatRelative(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function TokenDetail({ tokenInfo, onBack }: TokenDetailProps) {
  const { address, isConnected, chainId } = useAccount()
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [slippage, setSlippage] = useState(5)
  const [pendingAction, setPendingAction] = useState<
    'approve' | 'trade' | 'claim' | 'swap-transfer' | 'swap' | null
  >(null)
  const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy') // buy = quote->token

  const isSeed = tokenInfo.isSeed === true
  const isCreator = address && address.toLowerCase() === tokenInfo.creator.toLowerCase()
  const explorerUrl = getExplorerUrl(chainId || 5042002)
  const nativeSymbol = getNativeSymbol(chainId || 5042002)

  const { data: quoteTokenAddr } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'quoteToken',
    query: { enabled: !isSeed },
  })

  const quoteToken = (quoteTokenAddr as `0x${string}` | undefined) || zeroAddress
  const isErc20Quote = !isSeed && quoteToken !== zeroAddress && !isNativeQuote(quoteToken)
  const quoteMeta = getQuoteToken(chainId || 5042002, quoteToken)
  const quoteSymbol = isErc20Quote ? quoteMeta?.symbol || 'CHAOS' : nativeSymbol
  const quoteDecimals = quoteMeta?.decimals ?? 18

  const { data: balance } = useBalance({ address })
  const { data: quoteErc20Balance } = useReadContract({
    address: quoteToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !isSeed && isErc20Quote && !!address },
  })

  const { data: quoteAllowance, refetch: refetchAllowance } = useReadContract({
    address: quoteToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, tokenInfo.curve] : undefined,
    query: { enabled: !isSeed && isErc20Quote && !!address },
  })

  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: tokenInfo.token,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !isSeed && !!address },
  })

  const { data: chainState, refetch: refetchState } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'state',
    query: { enabled: !isSeed },
  })

  const { data: chainPrice, refetch: refetchPrice } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getCurrentPrice',
    query: { enabled: !isSeed },
  })

  const { data: graduationTarget } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'graduationTarget',
    query: { enabled: !isSeed },
  })

  const { data: chainProgress } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getProgress',
    query: { enabled: !isSeed },
  })

  const { data: creatorFees, refetch: refetchCreatorFees } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getClaimableCreatorFees',
    query: { enabled: !isSeed && !!isCreator },
  })

  const { data: creatorPostGradFeeBpsOnChain } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'creatorPostGradFeeBps',
    query: { enabled: !isSeed },
  })

  const curveState = isSeed ? tokenInfo.state : (chainState as TokenState | undefined)
  const isGraduated = Boolean(tokenInfo.graduated || curveState?.graduated)
  const pairAddress = (curveState?.pair && curveState.pair !== '0x0000000000000000000000000000000000000000'
    ? curveState.pair
    : undefined) as `0x${string}` | undefined
  const creatorPostGradFeeBps = Number(creatorPostGradFeeBpsOnChain ?? 0n)
  const currentPrice =
    isSeed && tokenInfo.state
      ? tokenInfo.state.virtualTokens > 0n
        ? (tokenInfo.state.virtualQuote * BigInt(1e18)) / tokenInfo.state.virtualTokens
        : 0n
      : chainPrice

  const gradTarget =
    (graduationTarget as bigint | undefined) ||
    (isSeed ? BigInt(100e18) : BigInt(100e18))

  const progress =
    isSeed && tokenInfo.state
      ? (tokenInfo.state.realQuoteRaised * 10000n) / gradTarget
      : chainProgress

  const analytics = useTokenAnalytics(
    tokenInfo.token,
    tokenInfo.curve,
    !isSeed,
    curveState?.tokensSold
  )

  const amountInWei = amount
    ? parseUnits(
        amount,
        isGraduated
          ? swapDirection === 'buy'
            ? quoteDecimals
            : 18
          : activeTab === 'buy'
            ? quoteDecimals
            : 18
      )
    : 0n

  const { data: buyQuote } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getBuyQuote',
    args: [amountInWei],
    query: { enabled: !isSeed && !isGraduated && amountInWei > 0n && activeTab === 'buy' },
  })

  const { data: sellQuote } = useReadContract({
    address: tokenInfo.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getSellQuote',
    args: [amountInWei],
    query: { enabled: !isSeed && !isGraduated && amountInWei > 0n && activeTab === 'sell' },
  })

  const { data: swapAmountOut, refetch: refetchSwapQuote } = useReadContract({
    address: pairAddress,
    abi: SIMPLE_PAIR_ABI,
    functionName: 'getAmountOut',
    args: [amountInWei, swapDirection === 'sell'],
    query: { enabled: !isSeed && isGraduated && !!pairAddress && amountInWei > 0n },
  })


  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      if (pendingAction === 'approve') {
        toast.success('Approved')
        refetchAllowance()
        setPendingAction(null)
        reset()
        return
      }
      if (pendingAction === 'swap-transfer') {
        // Input landed on the pair — execute swap with quoted out
        toast.success('Transfer confirmed')
        reset()
        const out = (swapAmountOut as bigint | undefined) ?? 0n
        setPendingAction('swap')
        if (swapDirection === 'buy') {
          writeContract({
            address: pairAddress!,
            abi: SIMPLE_PAIR_ABI,
            functionName: 'swap',
            args: [out, 0n, address!],
          })
        } else {
          writeContract({
            address: pairAddress!,
            abi: SIMPLE_PAIR_ABI,
            functionName: 'swap',
            args: [0n, out, address!],
          })
        }
        return
      }
      toast.success(
        pendingAction === 'claim'
          ? 'Fees claimed'
          : pendingAction === 'swap' || isGraduated
            ? 'Swap complete'
            : activeTab === 'buy'
              ? 'Purchase complete'
              : 'Sale complete'
      )
      setAmount('')
      setPendingAction(null)
      reset()
      refetchState()
      refetchPrice()
      refetchTokenBalance()
      refetchCreatorFees()
      refetchSwapQuote()
      analytics.refetch()
    }
  }, [isSuccess])

  const needsApproval =
    !isGraduated &&
    isErc20Quote &&
    activeTab === 'buy' &&
    amountInWei > 0n &&
    ((quoteAllowance as bigint | undefined) ?? 0n) < amountInWei

  const handleApprove = () => {
    if (!isErc20Quote) return
    setPendingAction('approve')
    writeContract({
      address: quoteToken,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [tokenInfo.curve, amountInWei],
    })
  }

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    try {
      setPendingAction('trade')
      if (activeTab === 'buy') {
        const minTokens = buyQuote
          ? ((buyQuote as readonly [bigint, bigint, bigint])[0] * BigInt(100 - slippage)) / 100n
          : 0n
        if (isErc20Quote) {
          writeContract({
            address: tokenInfo.curve,
            abi: BONDING_CURVE_ABI,
            functionName: 'buyWithToken',
            args: [amountInWei, minTokens],
          })
        } else {
          writeContract({
            address: tokenInfo.curve,
            abi: BONDING_CURVE_ABI,
            functionName: 'buy',
            args: [minTokens],
            value: amountInWei,
          })
        }
      } else {
        const minOut = sellQuote
          ? ((sellQuote as readonly [bigint, bigint, bigint])[0] * BigInt(100 - slippage)) / 100n
          : 0n
        writeContract({
          address: tokenInfo.curve,
          abi: BONDING_CURVE_ABI,
          functionName: 'sell',
          args: [amountInWei, minOut],
        })
      }
    } catch (err) {
      console.error(err)
      toast.error('Transaction failed')
      setPendingAction(null)
    }
  }

  const handleSwap = () => {
    if (!amount || parseFloat(amount) <= 0 || !pairAddress || !address) {
      toast.error('Enter a valid amount')
      return
    }
    const out = (swapAmountOut as bigint | undefined) ?? 0n
    if (out === 0n) {
      toast.error('No liquidity quote')
      return
    }

    try {
      if (swapDirection === 'buy') {
        if (isErc20Quote) {
          // Transfer quote ERC20 to pair, then swap
          setPendingAction('swap-transfer')
          writeContract({
            address: quoteToken,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [pairAddress, amountInWei],
          })
        } else {
          setPendingAction('swap')
          writeContract({
            address: pairAddress,
            abi: SIMPLE_PAIR_ABI,
            functionName: 'swap',
            args: [out, 0n, address],
            value: amountInWei,
          })
        }
      } else {
        // Transfer meme token to pair, then swap
        setPendingAction('swap-transfer')
        writeContract({
          address: tokenInfo.token,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [pairAddress, amountInWei],
        })
      }
    } catch (err) {
      console.error(err)
      toast.error('Swap failed')
      setPendingAction(null)
    }
  }

  const handleClaimCreatorFees = () => {
    if (!creatorFees || creatorFees === 0n) {
      toast.error('No fees to claim')
      return
    }
    try {
      setPendingAction('claim')
      writeContract({
        address: tokenInfo.curve,
        abi: BONDING_CURVE_ABI,
        functionName: 'claimCreatorFees',
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to claim fees')
      setPendingAction(null)
    }
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(tokenInfo.token)
    setCopied(true)
    toast.success('Copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const progressPercent = progress ? Number(progress) / 100 : 0
  const raisedAmount = curveState ? Number(formatUnits(curveState.realQuoteRaised, 18)) : 0
  const gradTargetNum = Number(formatUnits(gradTarget, 18))
  const toGrad = Math.max(0, gradTargetNum - raisedAmount)
  const price = currentPrice ? Number(formatUnits(currentPrice as bigint, 18)) : 0
  const tokensSoldNum = curveState ? Number(formatUnits(curveState.tokensSold, 18)) : 0
  const mcap = price * tokensSoldNum
  const volumeNum = Number(formatUnits(analytics.totalVolume, 18))
  const userTokens = tokenBalance ? Number(formatUnits(tokenBalance as bigint, 18)) : 0
  const userQuoteBal = isErc20Quote
    ? quoteErc20Balance
      ? Number(formatUnits(quoteErc20Balance as bigint, quoteDecimals))
      : 0
    : balance
      ? Number(formatUnits(balance.value, 18))
      : 0
  const isNearGrad = progressPercent >= 80
  const accruedCreatorFees = creatorFees ? Number(formatUnits(creatorFees as bigint, 18)) : 0

  let metadata: TokenMetadata = {}
  try {
    metadata = JSON.parse(tokenInfo.metadataURI || '{}')
  } catch {}

  const socials = metadata.socials || {}
  const hasSocials = socials.twitter || socials.telegram || socials.website || socials.discord

  const getSocialUrl = (type: string, value: string): string => {
    if (value.startsWith('http')) return value
    switch (type) {
      case 'twitter':
        return `https://twitter.com/${value.replace('@', '')}`
      case 'telegram':
        return value.startsWith('t.me/') ? `https://${value}` : `https://t.me/${value.replace('@', '')}`
      case 'discord':
        return value.includes('discord') ? value : `https://discord.gg/${value}`
      default:
        return value
    }
  }

  const formatMcap = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`
    if (v >= 1) return `$${v.toFixed(2)}`
    return formatPrice(v)
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden text-[var(--text-secondary)]">
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
                  tokenInfo.symbol.slice(0, 2)
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-[var(--text-primary)]">{tokenInfo.name}</h1>
                  {tokenInfo.graduated && <span className="badge badge-graduated">graduated</span>}
                  {isNearGrad && !tokenInfo.graduated && <span className="badge badge-hot">hot</span>}
                  {!isSeed && analytics.holderCount > 0 && (
                    <span className="badge badge-graduated flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {analytics.holderCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-tertiary)]">${tokenInfo.symbol}</p>

                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-1 rounded font-mono">
                    {tokenInfo.token.slice(0, 8)}...{tokenInfo.token.slice(-6)}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[var(--green)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={`${explorerUrl}/address/${tokenInfo.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {metadata.description && (
              <p className="text-sm text-[var(--text-secondary)] mb-4">{metadata.description}</p>
            )}

            {hasSocials && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {socials.twitter && (
                  <a
                    href={getSocialUrl('twitter', socials.twitter)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <Twitter className="w-3.5 h-3.5" />
                    Twitter
                  </a>
                )}
                {socials.telegram && (
                  <a
                    href={getSocialUrl('telegram', socials.telegram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Telegram
                  </a>
                )}
                {socials.website && (
                  <a
                    href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Website
                  </a>
                )}
                {socials.discord && (
                  <a
                    href={getSocialUrl('discord', socials.discord)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    Discord
                  </a>
                )}
              </div>
            )}

            {/* Analytics strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 mb-4">
              <div className="min-w-0">
                <p className="stat-label">Price</p>
                <p className="stat-value font-mono text-sm break-all">{formatPrice(price)}</p>
              </div>
              <div className="min-w-0">
                <p className="stat-label">MCap</p>
                <p className="stat-value text-sm break-all">{formatMcap(mcap)}</p>
              </div>
              <div>
                <p className="stat-label">Volume</p>
                <p className="stat-value text-sm">
                  {analytics.isLoading && !analytics.hasData
                    ? '…'
                    : `${volumeNum.toFixed(2)} ${quoteSymbol}`}
                </p>
              </div>
              <div>
                <p className="stat-label">Buys</p>
                <p className="stat-value text-sm text-[var(--green)]">
                  {analytics.isLoading && !analytics.hasData ? '…' : analytics.buyCount}
                </p>
              </div>
              <div>
                <p className="stat-label">Sells</p>
                <p className="stat-value text-sm text-[var(--red)]">
                  {analytics.isLoading && !analytics.hasData ? '…' : analytics.sellCount}
                </p>
              </div>
              <div>
                <p className="stat-label">Holders</p>
                <p className="stat-value text-sm">
                  {analytics.isLoading && !analytics.hasData ? '…' : analytics.holderCount}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="stat-label">Raised</p>
                <p className="stat-value">
                  {raisedAmount.toFixed(1)} {quoteSymbol}
                </p>
              </div>
              <div>
                <p className="stat-label">Progress</p>
                <p className={`stat-value ${isNearGrad ? 'text-[#5eead4]' : ''}`}>
                  {progressPercent.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="stat-label">To grad</p>
                <p className="stat-value">
                  {toGrad.toFixed(1)} {quoteSymbol}
                </p>
              </div>
            </div>

            {!tokenInfo.graduated && (
              <div className="mt-4">
                <div className="progress-bar h-1.5">
                  <div
                    className={`progress-bar-fill ${isNearGrad ? 'near-grad' : ''}`}
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <PriceChart
            tokenAddress={tokenInfo.token}
            curveAddress={tokenInfo.curve}
            isSeed={isSeed}
            priceHistory={analytics.priceHistory}
            isLoading={analytics.isLoading && !analytics.hasData}
          />

        </div>

        {/* Trade Panel + side rails */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
            {isSeed ? (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--text-tertiary)] mb-2">Trading coming soon</p>
                <p className="text-xs text-[var(--text-muted)]">Create a real token to trade</p>
              </div>
            ) : isGraduated && pairAddress ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-graduated">Graduated · Chaos AMM</span>
                  </div>
                  <a
                    href={`${explorerUrl}/address/${pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  >
                    Pool
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5 mb-4">
                  <button
                    onClick={() => {
                      setSwapDirection('buy')
                      setAmount('')
                    }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      swapDirection === 'buy'
                        ? 'bg-[var(--green)] text-black'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => {
                      setSwapDirection('sell')
                      setAmount('')
                    }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      swapDirection === 'sell'
                        ? 'bg-[var(--red)] text-white'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-tertiary)]">You pay</span>
                      <span className="text-[var(--text-tertiary)]">
                        Bal:{' '}
                        {swapDirection === 'buy'
                          ? `${userQuoteBal.toFixed(2)} ${quoteSymbol}`
                          : `${userTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${tokenInfo.symbol}`}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-3 pr-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-lg font-medium placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                        {swapDirection === 'buy' ? quoteSymbol : tokenInfo.symbol}
                      </span>
                    </div>
                    {swapDirection === 'buy' && (
                      <div className="flex gap-1.5 mt-2">
                        {[1, 5, 10, 25].map((val) => (
                          <button
                            key={val}
                            onClick={() => setAmount(val.toString())}
                            className="flex-1 py-1.5 text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSwapDirection((d) => (d === 'buy' ? 'sell' : 'buy'))
                        setAmount('')
                      }}
                      className="p-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      title="Flip direction"
                    >
                      <ArrowDownUp className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {amount && parseFloat(amount) > 0 && (
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2 animate-fade-in">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-tertiary)]">You receive</span>
                        <span className="text-[var(--text-primary)] font-medium">
                          {swapAmountOut !== undefined
                            ? swapDirection === 'buy'
                              ? `${Number(formatUnits(swapAmountOut as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${tokenInfo.symbol}`
                              : `${Number(formatUnits(swapAmountOut as bigint, 18)).toFixed(4)} ${quoteSymbol}`
                            : '...'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)] space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Protocol</span>
                          <span className="text-[var(--text-tertiary)]">
                            {(PROTOCOL_POST_GRAD_FEE_BPS / 100).toFixed(2)}%
                          </span>
                        </div>
                        {creatorPostGradFeeBps > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-[var(--text-muted)]">Creator</span>
                            <span className="text-[var(--text-tertiary)]">
                              {(creatorPostGradFeeBps / 100).toFixed(2)}%
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-[var(--text-muted)] pt-1">
                          Fees skimmed from swap input
                          {creatorPostGradFeeBps > 0
                            ? ` · ${(PROTOCOL_POST_GRAD_FEE_BPS / 100).toFixed(2)}% protocol + ${(creatorPostGradFeeBps / 100).toFixed(2)}% creator`
                            : ` · ${(PROTOCOL_POST_GRAD_FEE_BPS / 100).toFixed(2)}% protocol`}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isConnected ? (
                    <div className="text-center py-3 text-sm text-[var(--text-tertiary)] flex items-center justify-center gap-1.5">
                      <Wallet className="w-4 h-4" />
                      Connect wallet to trade
                    </div>
                  ) : (
                    <button
                      onClick={handleSwap}
                      disabled={isPending || isConfirming || !amount || parseFloat(amount) <= 0}
                      className={`w-full py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                        swapDirection === 'buy' ? 'btn-buy' : 'btn-sell'
                      }`}
                    >
                      {isPending || isConfirming ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          {pendingAction === 'swap-transfer'
                            ? 'Sending…'
                            : isConfirming
                              ? 'Confirming...'
                              : 'Swapping...'}
                        </>
                      ) : (
                        `Swap`
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : isGraduated && !pairAddress ? (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--text-primary)] mb-2">Graduated</p>
                <p className="text-xs text-[var(--text-tertiary)]">Loading pool…</p>
              </div>
            ) : (
              <>
                <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5 mb-4">
                  <button
                    onClick={() => {
                      setActiveTab('buy')
                      setAmount('')
                    }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'buy'
                        ? 'bg-[var(--green)] text-black'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('sell')
                      setAmount('')
                    }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'sell'
                        ? 'bg-[var(--red)] text-white'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-tertiary)]">
                        {activeTab === 'buy' ? 'You pay' : 'You sell'}
                      </span>
                      <span className="text-[var(--text-tertiary)]">
                        Bal:{' '}
                        {activeTab === 'buy'
                          ? `${userQuoteBal.toFixed(2)} ${quoteSymbol}`
                          : `${userTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${tokenInfo.symbol}`}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-3 pr-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-lg font-medium placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                        {activeTab === 'buy' ? quoteSymbol : tokenInfo.symbol}
                      </span>
                    </div>

                    {activeTab === 'buy' && (
                      <div className="flex gap-1.5 mt-2">
                        {[1, 5, 10, 25].map((val) => (
                          <button
                            key={val}
                            onClick={() => setAmount(val.toString())}
                            className="flex-1 py-1.5 text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {amount && parseFloat(amount) > 0 && (
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2 animate-fade-in">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-tertiary)]">You receive</span>
                        <span className="text-[var(--text-primary)] font-medium">
                          {activeTab === 'buy'
                            ? buyQuote
                              ? `${Number(
                                  formatUnits((buyQuote as readonly [bigint, bigint, bigint])[0], 18)
                                ).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${tokenInfo.symbol}`
                              : '...'
                            : sellQuote
                              ? `${Number(
                                  formatUnits((sellQuote as readonly [bigint, bigint, bigint])[0], 18)
                                ).toFixed(4)} ${quoteSymbol}`
                              : '...'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[var(--border)] space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">
                            Protocol ({PROTOCOL_FEE_BPS / 100}%)
                          </span>
                          <span className="text-[var(--text-tertiary)]">
                            {activeTab === 'buy'
                              ? buyQuote
                                ? Number(
                                    formatUnits((buyQuote as readonly [bigint, bigint, bigint])[1], 18)
                                  ).toFixed(4)
                                : '...'
                              : sellQuote
                                ? Number(
                                    formatUnits((sellQuote as readonly [bigint, bigint, bigint])[1], 18)
                                  ).toFixed(4)
                                : '...'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">
                            Creator ({CREATOR_FEE_BPS / 100}%)
                          </span>
                          <span className="text-[var(--text-tertiary)]">
                            {activeTab === 'buy'
                              ? buyQuote
                                ? Number(
                                    formatUnits((buyQuote as readonly [bigint, bigint, bigint])[2], 18)
                                  ).toFixed(4)
                                : '...'
                              : sellQuote
                                ? Number(
                                    formatUnits((sellQuote as readonly [bigint, bigint, bigint])[2], 18)
                                  ).toFixed(4)
                                : '...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Slippage</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 5, 10].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSlippage(s)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            slippage === s
                              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-tertiary)]'
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isConnected ? (
                    <div className="text-center py-3 text-sm text-[var(--text-tertiary)] flex items-center justify-center gap-1.5">
                      <Wallet className="w-4 h-4" />
                      Connect wallet to trade
                    </div>
                  ) : needsApproval ? (
                    <button
                      onClick={handleApprove}
                      disabled={isPending || isConfirming || !amount || parseFloat(amount) <= 0}
                      className="w-full py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 btn-primary"
                    >
                      {isPending || isConfirming ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          {isConfirming ? 'Confirming...' : 'Approving...'}
                        </>
                      ) : (
                        `Approve ${quoteSymbol}`
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleTrade}
                      disabled={isPending || isConfirming || !amount || parseFloat(amount) <= 0}
                      className={`w-full py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                        activeTab === 'buy' ? 'btn-buy' : 'btn-sell'
                      }`}
                    >
                      {isPending || isConfirming ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          {isConfirming ? 'Confirming...' : 'Processing...'}
                        </>
                      ) : activeTab === 'buy' ? (
                        `Buy with ${quoteSymbol}`
                      ) : (
                        'Sell'
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Holders */}
          {!isSeed && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Holders {analytics.holderCount > 0 ? `(${analytics.holderCount})` : ''}
                </span>
              </div>
              {analytics.isLoading && !analytics.hasData ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
                </div>
              ) : analytics.holders.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">No holders yet</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                    <div className="col-span-1">#</div>
                    <div className="col-span-5">Wallet</div>
                    <div className="col-span-4 text-right">Balance</div>
                    <div className="col-span-2 text-right">%</div>
                  </div>
                  {analytics.holders.map((h, i) => (
                    <div key={h.address} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-center">
                      <div className="col-span-1 text-[var(--text-muted)]">{i + 1}</div>
                      <div className="col-span-5">
                        <a
                          href={`${explorerUrl}/address/${h.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1"
                        >
                          {shortAddr(h.address)}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                      </div>
                      <div className="col-span-4 text-right font-mono text-[var(--text-primary)]">
                        {Number(formatUnits(h.balance, 18)).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="col-span-2 text-right text-[var(--text-tertiary)]">
                        {h.percentage.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity */}
          {!isSeed && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">Recent activity</span>
              </div>
              {analytics.isLoading && !analytics.hasData ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
                </div>
              ) : analytics.trades.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">No trades yet</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {analytics.trades.slice(0, 25).map((t) => (
                    <div key={`${t.txHash}-${t.blockNumber}`} className="px-3 py-2.5 flex items-center gap-2 text-xs">
                      <span
                        className={`font-medium w-10 ${
                          t.type === 'buy' ? 'text-[var(--green)]' : 'text-[var(--red)]'
                        }`}
                      >
                        {t.type === 'buy' ? 'BUY' : 'SELL'}
                      </span>
                      <a
                        href={`${explorerUrl}/address/${t.trader}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        {shortAddr(t.trader)}
                      </a>
                      <span className="flex-1 text-right text-[var(--text-primary)]">
                        {Number(formatUnits(t.quoteAmount, 18)).toFixed(4)} {quoteSymbol}
                      </span>
                      <span className="text-[var(--text-muted)] w-8 text-right">
                        {formatRelative(t.timestamp)}
                      </span>
                      <a
                        href={`${explorerUrl}/tx/${t.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isCreator && !isSeed && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Creator fees earned</p>
                  <p className="stat-value">
                    {accruedCreatorFees.toFixed(4)} {quoteSymbol}
                  </p>
                </div>
                <button
                  onClick={handleClaimCreatorFees}
                  disabled={isPending || isConfirming || accruedCreatorFees === 0}
                  className="px-4 py-2 btn-primary rounded-lg text-sm disabled:opacity-40"
                >
                  {isPending || isConfirming ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
