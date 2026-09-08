import { ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { getChainConfig } from '../config/chains'

export function FaucetBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { chainId } = useAccount()
  
  const chainConfig = getChainConfig(chainId || 5042002)
  
  if (dismissed || !chainConfig?.faucetUrl) return null

  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <div className="network-dot" />
          <span className="text-[var(--text-secondary)] font-medium">{chainConfig.chain.name}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <a
            href={chainConfig.faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors inline-flex items-center gap-1"
          >
            Get testnet {chainConfig.nativeSymbol}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
