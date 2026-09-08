import { useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatUnits, zeroAddress } from 'viem'
import { X, User, Loader2, Wallet, Coins } from 'lucide-react'
import toast from 'react-hot-toast'
import { FACTORY_ABI, BONDING_CURVE_ABI } from '../config/contracts'
import { getFactoryAddress, getChainConfig, getNativeSymbol } from '../config/chains'
import { getQuoteToken, isNativeQuote } from '../config/quoteTokens'

const DEFAULT_CHAIN_ID = 5042002

export interface ProfileTokenInfo {
  token: `0x${string}`
  curve: `0x${string}`
  name: string
  symbol: string
  metadataURI: string
  creator: `0x${string}`
  createdAt: bigint
  graduated: boolean
  quoteToken?: `0x${string}`
}

interface ProfileProps {
  isOpen: boolean
  onClose: () => void
  onSelectToken: (token: ProfileTokenInfo) => void
  onConnectClick?: () => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function LaunchRow({
  token,
  fee,
  quoteSymbol,
  claiming,
  onOpen,
  onClaim,
}: {
  token: ProfileTokenInfo
  fee: bigint
  quoteSymbol: string
  claiming: boolean
  onOpen: () => void
  onClaim: () => void
}) {
  const feeNum = Number(formatUnits(fee, 18))
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
      >
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {token.name}{' '}
          <span className="text-[var(--text-tertiary)] font-normal">${token.symbol}</span>
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          Quote {quoteSymbol}
          {token.graduated ? ' · Graduated' : ''}
          {fee > 0n ? ` · ${feeNum.toFixed(4)} ${quoteSymbol} fees` : ''}
        </p>
      </button>
      {fee > 0n && (
        <button
          type="button"
          onClick={onClaim}
          disabled={claiming}
          className="shrink-0 px-2.5 py-1.5 text-xs font-medium btn-primary rounded-lg disabled:opacity-50"
        >
          {claiming ? 'Claiming…' : 'Claim'}
        </button>
      )}
    </div>
  )
}

export function Profile({ isOpen, onClose, onSelectToken, onConnectClick }: ProfileProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const effectiveChainId =
    walletChainId && getChainConfig(walletChainId) ? walletChainId : DEFAULT_CHAIN_ID
  const factoryAddress = getFactoryAddress(effectiveChainId)
  const nativeSymbol = getNativeSymbol(effectiveChainId)

  const [claimingCurve, setClaimingCurve] = useState<`0x${string}` | null>(null)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

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

  const { data: tokenAddresses, isLoading: loadingAddresses } = useReadContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'getAllTokens',
    query: { enabled: isOpen && isConnected && !!address },
  })

  const tokenContracts =
    tokenAddresses?.map((addr) => ({
      address: factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'getToken' as const,
      args: [addr] as const,
    })) || []

  const { data: tokenInfos, isLoading: loadingInfos, refetch: refetchTokens } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: isOpen && isConnected && tokenContracts.length > 0 },
  })

  const myLaunches: ProfileTokenInfo[] = useMemo(() => {
    if (!address || !tokenInfos) return []
    const mine = tokenInfos
      .filter((r) => r.status === 'success')
      .map((r) => r.result as ProfileTokenInfo)
      .filter((t) => t.creator?.toLowerCase() === address.toLowerCase())
      .sort((a, b) => Number(b.createdAt - a.createdAt))
    return mine
  }, [tokenInfos, address])

  const feeContracts = myLaunches.map((t) => ({
    address: t.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'getClaimableCreatorFees' as const,
  }))

  const quoteContracts = myLaunches.map((t) => ({
    address: t.curve,
    abi: BONDING_CURVE_ABI,
    functionName: 'quoteToken' as const,
  }))

  const { data: feeResults, refetch: refetchFees } = useReadContracts({
    contracts: feeContracts,
    query: { enabled: isOpen && myLaunches.length > 0 },
  })

  const { data: quoteResults } = useReadContracts({
    contracts: quoteContracts,
    query: { enabled: isOpen && myLaunches.length > 0 },
  })

  useEffect(() => {
    if (isSuccess) {
      toast.success('Fees claimed')
      setClaimingCurve(null)
      reset()
      refetchFees()
      refetchTokens()
    }
  }, [isSuccess, reset, refetchFees, refetchTokens])

  const feesByCurve = useMemo(() => {
    const map = new Map<string, bigint>()
    myLaunches.forEach((t, i) => {
      const r = feeResults?.[i]
      const fee = r?.status === 'success' ? (r.result as bigint) : 0n
      map.set(t.curve.toLowerCase(), fee)
    })
    return map
  }, [myLaunches, feeResults])

  const quoteByCurve = useMemo(() => {
    const map = new Map<string, `0x${string}`>()
    myLaunches.forEach((t, i) => {
      const fromInfo = t.quoteToken
      const r = quoteResults?.[i]
      const fromCurve =
        r?.status === 'success' ? (r.result as `0x${string}`) : undefined
      map.set(t.curve.toLowerCase(), fromCurve || fromInfo || zeroAddress)
    })
    return map
  }, [myLaunches, quoteResults])

  const totalFees = useMemo(() => {
    let sum = 0n
    for (const v of feesByCurve.values()) sum += v
    return sum
  }, [feesByCurve])

  const quoteLabelFor = (curve: `0x${string}`) => {
    const q = quoteByCurve.get(curve.toLowerCase()) || zeroAddress
    if (isNativeQuote(q) || q === zeroAddress) return nativeSymbol
    return getQuoteToken(effectiveChainId, q)?.symbol || 'TOKEN'
  }

  const handleClaim = (curve: `0x${string}`) => {
    const fee = feesByCurve.get(curve.toLowerCase()) || 0n
    if (fee === 0n) {
      toast.error('No fees to claim')
      return
    }
    try {
      setClaimingCurve(curve)
      writeContract({
        address: curve,
        abi: BONDING_CURVE_ABI,
        functionName: 'claimCreatorFees',
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to claim fees')
      setClaimingCurve(null)
    }
  }

  if (!isOpen) return null

  const isLoading = isConnected && (loadingAddresses || loadingInfos)
  const claiming = isPending || isConfirming

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {!isConnected || !address ? (
            <div className="text-center py-10 space-y-3">
              <Wallet className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <p className="text-sm text-[var(--text-secondary)]">Connect your wallet to view launches and fees.</p>
              {onConnectClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onConnectClick()
                  }}
                  className="px-4 py-2 btn-primary rounded-lg text-sm"
                >
                  Connect
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Address</p>
                <p className="text-sm font-mono text-[var(--text-primary)]">{shortAddr(address)}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    Creator fees
                  </h3>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {Number(formatUnits(totalFees, 18)).toFixed(4)} total
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                  My launches
                  {myLaunches.length > 0 && (
                    <span className="text-[var(--text-muted)] font-normal ml-1.5">
                      ({myLaunches.length})
                    </span>
                  )}
                </h3>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
                  </div>
                ) : myLaunches.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                    No launches yet. Create a token to see it here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myLaunches.map((token) => {
                      const fee = feesByCurve.get(token.curve.toLowerCase()) || 0n
                      return (
                        <LaunchRow
                          key={token.token}
                          token={token}
                          fee={fee}
                          quoteSymbol={quoteLabelFor(token.curve)}
                          claiming={claiming && claimingCurve === token.curve}
                          onOpen={() => {
                            onSelectToken(token)
                            onClose()
                          }}
                          onClaim={() => handleClaim(token.curve)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
