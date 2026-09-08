import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { 
  FACTORY_ABI, 
  PROTOCOL_FEE_BPS, 
  DEFAULT_VIRTUAL_QUOTE,
  MIN_VIRTUAL_QUOTE,
  MAX_VIRTUAL_QUOTE,
  DEFAULT_GRADUATION_TARGET,
  MIN_GRADUATION_TARGET,
  MAX_GRADUATION_TARGET,
  MAX_CREATOR_FEE_BPS,
  CREATOR_FEE_BPS,
  DEFAULT_CREATOR_POST_GRAD_FEE_BPS,
  MAX_CREATOR_POST_GRAD_FEE_BPS,
  PROTOCOL_POST_GRAD_FEE_BPS,
} from '../config/contracts'
import { getFactoryAddress, getNativeSymbol } from '../config/chains'
import { getQuoteTokens, isNativeQuote, NATIVE_QUOTE, type QuoteToken } from '../config/quoteTokens'
import { X, ChevronDown, ChevronUp, Settings, Twitter, MessageCircle, Globe, Hash, Coins } from 'lucide-react'
import toast from 'react-hot-toast'

interface CreateTokenProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateToken({ isOpen, onClose, onCreated }: CreateTokenProps) {
  const { isConnected, chainId } = useAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  
  // Social links
  const [twitter, setTwitter] = useState('')
  const [telegram, setTelegram] = useState('')
  const [website, setWebsite] = useState('')
  const [discord, setDiscord] = useState('')
  
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSocials, setShowSocials] = useState(false)
  const [graduationTarget, setGraduationTarget] = useState(DEFAULT_GRADUATION_TARGET)
  const [virtualReserve, setVirtualReserve] = useState(DEFAULT_VIRTUAL_QUOTE)
  const [creatorFeeBps, setCreatorFeeBps] = useState(CREATOR_FEE_BPS)
  const [creatorPostGradFeeBps, setCreatorPostGradFeeBps] = useState(DEFAULT_CREATOR_POST_GRAD_FEE_BPS)
  const [selectedQuoteToken, setSelectedQuoteToken] = useState<`0x${string}`>(NATIVE_QUOTE)

  const factoryAddress = getFactoryAddress(chainId || 5042002)
  const nativeSymbol = getNativeSymbol(chainId || 5042002)
  const quoteTokens = getQuoteTokens(chainId || 5042002)
  const selectedQuote = quoteTokens.find(t => t.address === selectedQuoteToken) || quoteTokens[0]

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const isCustomParams = 
    graduationTarget !== DEFAULT_GRADUATION_TARGET || 
    virtualReserve !== DEFAULT_VIRTUAL_QUOTE || 
    creatorFeeBps !== CREATOR_FEE_BPS ||
    creatorPostGradFeeBps !== DEFAULT_CREATOR_POST_GRAD_FEE_BPS ||
    !isNativeQuote(selectedQuoteToken)

  const hasSocials = twitter || telegram || website || discord

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !symbol.trim()) {
      toast.error('Name and ticker required')
      return
    }

    const metadataURI = JSON.stringify({
      name,
      symbol: symbol.toUpperCase(),
      description,
      image: imageUrl || '',
      socials: {
        twitter: twitter || undefined,
        telegram: telegram || undefined,
        website: website || undefined,
        discord: discord || undefined,
      },
    })

    try {
      if (isCustomParams) {
        writeContract({
          address: factoryAddress,
          abi: FACTORY_ABI,
          functionName: 'createTokenWithParams',
          args: [
            name, 
            symbol.toUpperCase(), 
            metadataURI,
            {
              virtualQuote: parseUnits(virtualReserve.toString(), 18),
              graduationTarget: parseUnits(graduationTarget.toString(), 18),
              creatorFeeBps: BigInt(creatorFeeBps),
              quoteToken: selectedQuoteToken,
              creatorPostGradFeeBps: BigInt(creatorPostGradFeeBps),
            }
          ],
        })
      } else {
        writeContract({
          address: factoryAddress,
          abi: FACTORY_ABI,
          functionName: 'createToken',
          args: [name, symbol.toUpperCase(), metadataURI],
        })
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to create token')
    }
  }

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Token created')
      setName('')
      setSymbol('')
      setImageUrl('')
      setDescription('')
      setTwitter('')
      setTelegram('')
      setWebsite('')
      setDiscord('')
      setGraduationTarget(DEFAULT_GRADUATION_TARGET)
      setVirtualReserve(DEFAULT_VIRTUAL_QUOTE)
      setCreatorFeeBps(CREATOR_FEE_BPS)
      setSelectedQuoteToken(NATIVE_QUOTE)
      setShowAdvanced(false)
      setShowSocials(false)
      reset()
      onCreated()
    }
  }, [isSuccess, hash])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop" 
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-md bg-[var(--bg-card)] border border-[var(--border)] sm:rounded-xl rounded-t-xl flex flex-col max-h-[90vh] animate-slide-up-sheet sm:animate-fade-in"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Create token</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1.5">
                Name <span className="text-[var(--red)]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Doge Moon"
                className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                maxLength={50}
              />
            </div>

            {/* Ticker */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1.5">
                Ticker <span className="text-[var(--red)]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="DMOON"
                  className="w-full pl-7 pr-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors uppercase font-medium"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1.5">
                Image URL <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1.5">
                Description <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your coin..."
                rows={2}
                className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors resize-none"
                maxLength={500}
              />
            </div>

            {/* Quote Token Selector */}
            {quoteTokens.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1.5">
                  Pair with
                </label>
                <div className="flex gap-2 flex-wrap">
                  {quoteTokens.map((token) => (
                    <button
                      key={token.address}
                      type="button"
                      onClick={() => setSelectedQuoteToken(token.address)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedQuoteToken === token.address
                          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                          : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      {token.symbol}
                    </button>
                  ))}
                </div>
                {!isNativeQuote(selectedQuoteToken) && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                    ERC-20 mode: buyers will need {selectedQuote?.symbol} tokens
                  </p>
                )}
              </div>
            )}

            {/* Social Links */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSocials(!showSocials)}
                className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Project socials</span>
                  {hasSocials && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-dim)] text-[var(--text-secondary)] rounded font-medium">
                      {[twitter, telegram, website, discord].filter(Boolean).length} links
                    </span>
                  )}
                </div>
                {showSocials ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                )}
              </button>

              {showSocials && (
                <div className="p-3 pt-0 space-y-3 border-t border-[var(--border)] animate-fade-in">
                  {/* Twitter/X */}
                  <div className="pt-3">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mb-1.5">
                      <Twitter className="w-3.5 h-3.5" />
                      Twitter / X
                    </label>
                    <input
                      type="text"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value.replace('@', ''))}
                      placeholder="@username or full URL"
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                    />
                  </div>

                  {/* Telegram */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mb-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      Telegram
                    </label>
                    <input
                      type="text"
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="t.me/group or @group"
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mb-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                    />
                  </div>

                  {/* Discord */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mb-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      Discord
                    </label>
                    <input
                      type="text"
                      value={discord}
                      onChange={(e) => setDiscord(e.target.value)}
                      placeholder="discord.gg/... or full URL"
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Curve settings</span>
                  {isCustomParams && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-dim)] text-[var(--text-secondary)] rounded font-medium">
                      custom
                    </span>
                  )}
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                )}
              </button>

              {showAdvanced && (
                <div className="p-3 pt-0 space-y-4 border-t border-[var(--border)] animate-fade-in">
                  {/* Graduation Target */}
                  <div className="pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-tertiary)]">Graduation target</label>
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        {graduationTarget >= 1000 ? `${(graduationTarget / 1000).toFixed(1)}k` : graduationTarget} {nativeSymbol}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_GRADUATION_TARGET}
                      max={MAX_GRADUATION_TARGET}
                      step={graduationTarget < 100 ? 5 : graduationTarget < 1000 ? 50 : 500}
                      value={graduationTarget}
                      onChange={(e) => setGraduationTarget(Number(e.target.value))}
                      className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer slider-thumb"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                      <span>${MIN_GRADUATION_TARGET}</span>
                      <span>${(MAX_GRADUATION_TARGET / 1000).toFixed(0)}k</span>
                    </div>
                  </div>

                  {/* Virtual Reserve */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-tertiary)]">Virtual liquidity</label>
                      <span className="text-xs font-medium text-[var(--text-primary)]">{virtualReserve} {nativeSymbol}</span>
                    </div>
                    <input
                      type="range"
                      min={MIN_VIRTUAL_QUOTE}
                      max={MAX_VIRTUAL_QUOTE}
                      step={virtualReserve < 100 ? 5 : 50}
                      value={virtualReserve}
                      onChange={(e) => setVirtualReserve(Number(e.target.value))}
                      className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer slider-thumb"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Higher = higher starting price</p>
                  </div>

                  {/* Creator Fee (curve) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-tertiary)]">Creator fee (curve)</label>
                      <span className="text-xs font-medium text-[var(--text-primary)]">{(creatorFeeBps / 100).toFixed(2)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_CREATOR_FEE_BPS}
                      step={5}
                      value={creatorFeeBps}
                      onChange={(e) => setCreatorFeeBps(Number(e.target.value))}
                      className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer slider-thumb"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Your share of each curve trade</p>
                  </div>

                  {/* Creator post-grad fee (opt-in) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[var(--text-tertiary)]">Creator fee (after graduation)</label>
                      <span className="text-xs font-medium text-[var(--text-primary)]">{(creatorPostGradFeeBps / 100).toFixed(2)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_CREATOR_POST_GRAD_FEE_BPS}
                      step={5}
                      value={creatorPostGradFeeBps}
                      onChange={(e) => setCreatorPostGradFeeBps(Number(e.target.value))}
                      className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer slider-thumb"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Opt-in only. Applies on Chaos AMM swaps after graduation (shown to traders). Protocol always takes {(PROTOCOL_POST_GRAD_FEE_BPS / 100).toFixed(2)}% post-grad.
                    </p>
                  </div>

                  {isCustomParams && (
                    <button
                      type="button"
                      onClick={() => {
                        setGraduationTarget(DEFAULT_GRADUATION_TARGET)
                        setVirtualReserve(DEFAULT_VIRTUAL_QUOTE)
                        setCreatorFeeBps(CREATOR_FEE_BPS)
                        setCreatorPostGradFeeBps(DEFAULT_CREATOR_POST_GRAD_FEE_BPS)
                        setSelectedQuoteToken(NATIVE_QUOTE)
                      }}
                      className="w-full py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors"
                    >
                      Reset to defaults
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-tertiary)] mb-2">
                Token will graduate at {graduationTarget >= 1000 ? `${(graduationTarget / 1000).toFixed(1)}k` : graduationTarget} {selectedQuote?.symbol || nativeSymbol} raised
              </p>
              {!isNativeQuote(selectedQuoteToken) && (
                <p className="text-[10px] text-[var(--yellow)] mb-1">
                  Paired with {selectedQuote?.symbol} (ERC-20)
                </p>
              )}
              <p className="text-[10px] text-[var(--text-muted)]">
                Curve: {PROTOCOL_FEE_BPS / 100}% protocol + {(creatorFeeBps / 100).toFixed(2)}% creator
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                After graduation: {(PROTOCOL_POST_GRAD_FEE_BPS / 100).toFixed(2)}% protocol
                {creatorPostGradFeeBps > 0 ? ` + ${(creatorPostGradFeeBps / 100).toFixed(2)}% creator` : ' (creator 0%, opt-in)'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div 
            className="p-4 border-t border-[var(--border)] shrink-0"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            {!isConnected ? (
              <p className="text-center text-sm text-[var(--text-tertiary)]">Connect wallet to create</p>
            ) : (
              <button
                type="submit"
                disabled={isPending || isConfirming || !name || !symbol}
                className="w-full py-3 btn-primary rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isPending || isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--bg-primary)]/30 border-t-[var(--bg-primary)] rounded-full animate-spin" />
                    {isConfirming ? 'Confirming...' : 'Creating...'}
                  </>
                ) : (
                  'Create token'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
