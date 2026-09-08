import { useState, useEffect } from 'react'
import { X, Zap, Coins, Link2, Code, TrendingUp, Server, Rocket, ExternalLink } from 'lucide-react'

interface DocsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Section = 'how' | 'fees' | 'chains' | 'contracts' | 'quote' | 'api' | 'sdk' | 'links'

const sections: { id: Section; label: string; icon: typeof Zap }[] = [
  { id: 'how', label: 'How it works', icon: Zap },
  { id: 'fees', label: 'Fees', icon: Coins },
  { id: 'chains', label: 'Chains', icon: Link2 },
  { id: 'contracts', label: 'Contracts', icon: Code },
  { id: 'quote', label: 'Quote pairing', icon: TrendingUp },
  { id: 'api', label: 'API', icon: Server },
  { id: 'sdk', label: 'SDK', icon: Rocket },
  { id: 'links', label: 'Links', icon: ExternalLink },
]

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('how')

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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col sm:flex-row overflow-hidden animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="sm:w-48 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex sm:flex-col overflow-x-auto sm:overflow-x-visible p-2 sm:p-3 gap-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/50'
                }`}
              >
                <section.icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Documentation</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {activeSection === 'how' && <HowItWorks />}
            {activeSection === 'fees' && <Fees />}
            {activeSection === 'chains' && <Chains />}
            {activeSection === 'contracts' && <Contracts />}
            {activeSection === 'quote' && <QuotePairing />}
            {activeSection === 'api' && <API />}
            {activeSection === 'sdk' && <SDK />}
            {activeSection === 'links' && <Links />}
          </div>
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Chaos is the quickest way to launch memes on Arc Testnet.
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        Hateful, racist, or harmful token names and metadata are prohibited.
      </p>
      <div className="grid gap-3">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-full bg-[var(--progress-dim)] flex items-center justify-center">
              <span className="text-xs font-semibold text-[var(--progress)]">1</span>
            </div>
            <h3 className="font-medium text-[var(--text-primary)]">Create</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] ml-10">
            Launch a token with a name, symbol, and image. Pick native USDC or CHAOS as your quote pair.
          </p>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-full bg-[var(--progress-dim)] flex items-center justify-center">
              <span className="text-xs font-semibold text-[var(--progress)]">2</span>
            </div>
            <h3 className="font-medium text-[var(--text-primary)]">Trade</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] ml-10">
            Buy and sell on a bonding curve. Price rises with demand, falls with sales. Fully on-chain.
          </p>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-full bg-[var(--near-grad-dim)] flex items-center justify-center">
              <span className="text-xs font-semibold text-[var(--near-grad)]">3</span>
            </div>
            <h3 className="font-medium text-[var(--text-primary)]">Graduate</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] ml-10">
            When the curve reaches its target, liquidity moves to Chaos AMM. Swap there with a 0.25% protocol fee (creator may opt into up to 0.25% more).
          </p>
        </div>
      </div>
    </div>
  )
}

function Fees() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Bonding curve</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
            <span className="text-sm text-[var(--text-secondary)]">Protocol fee</span>
            <span className="text-sm text-[var(--text-primary)] font-medium">1.00%</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
            <span className="text-sm text-[var(--text-secondary)]">Creator fee (adjustable)</span>
            <span className="text-sm text-[var(--text-primary)] font-medium">0–1.00%</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[var(--text-secondary)]">Default total</span>
            <span className="text-sm text-[var(--text-primary)] font-medium">1.30%</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">After graduation (Chaos AMM)</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
            <span className="text-sm text-[var(--text-secondary)]">Protocol fee</span>
            <span className="text-sm text-[var(--text-primary)] font-medium">0.25%</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[var(--text-secondary)]">Creator fee (opt-in)</span>
            <span className="text-sm text-[var(--text-primary)] font-medium">0–0.25%</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Curve fees: protocol → Olympus treasury; creator fees claimable on the curve.
        Post-grad swaps skim 0.25% protocol (+ optional creator) from swap input; creator quote fees use the same claim path. Shown to traders on the Swap panel.
      </p>
    </div>
  )
}

function Chains() {
  return (
    <div className="space-y-3">
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-primary)] font-medium">Arc Testnet</span>
          <span className="text-xs text-[var(--text-muted)]">Chain ID: 5042002</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-2">Circle's L1 where USDC is native gas.</p>
        <a
          href="https://testnet.arcscan.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex items-center gap-1"
        >
          Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-primary)] font-medium">LitVM LiteForge</span>
          <span className="text-xs text-[var(--text-muted)]">Chain ID: 4441</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-2">Caldera rollup with zkLTC native gas.</p>
        <a
          href="https://liteforge.explorer.caldera.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex items-center gap-1"
        >
          Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

function Contracts() {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-tertiary)] text-xs uppercase tracking-wide">
              <th className="pb-2 font-medium">Contract</th>
              <th className="pb-2 font-medium">Address</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-secondary)]">
            <tr className="border-t border-[var(--border)]">
              <td className="py-2.5 text-[var(--text-primary)]">Factory (Arc)</td>
              <td className="py-2.5">
                <a
                  href="https://testnet.arcscan.app/address/0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs hover:text-[var(--text-primary)] flex items-center gap-1"
                >
                  0xEFAc...445A <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
            <tr className="border-t border-[var(--border)]">
              <td className="py-2.5 text-[var(--text-primary)]">CHAOS Token</td>
              <td className="py-2.5">
                <a
                  href="https://testnet.arcscan.app/address/0x40eF85CCc195Ae13f50E0bE9A2A6Be2a7493530a"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs hover:text-[var(--text-primary)] flex items-center gap-1"
                >
                  0x40eF...530a <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
            <tr className="border-t border-[var(--border)]">
              <td className="py-2.5 text-[var(--text-primary)]">Fee Recipient</td>
              <td className="py-2.5">
                <a
                  href="https://testnet.arcscan.app/address/0x4d467E27F0CF402E958CC7Bb47aE258F00ABCD41"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs hover:text-[var(--text-primary)] flex items-center gap-1"
                >
                  0x4d46...CD41 <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuotePairing() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Tokens can be paired with different quote assets for trading:
      </p>
      <div className="space-y-2">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">Native USDC</h4>
          <p className="text-xs text-[var(--text-secondary)]">
            Circle's native gas token on Arc. Uses <code className="text-[var(--near-grad)]">msg.value</code> for buys.
          </p>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">CHAOS (ERC-20)</h4>
          <p className="text-xs text-[var(--text-secondary)]">
            Platform token. Uses <code className="text-[var(--near-grad)]">buyWithToken()</code> after approval.
          </p>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        The LaunchpadFactory v3 accepts any ERC-20 as a quote token — no allowlist required.
      </p>
    </div>
  )
}

function API() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        The API server provides endpoints for token metadata and indexing:
      </p>
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 font-mono text-xs space-y-1">
        <div><span className="text-[var(--green)]">GET</span> /api/tokens</div>
        <div><span className="text-[var(--green)]">GET</span> /api/tokens/:address</div>
        <div><span className="text-[var(--green)]">GET</span> /api/health</div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        API source is in the <code>/api</code> directory. Run with <code>pnpm --filter api dev</code>.
      </p>
    </div>
  )
}

function SDK() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        TypeScript SDK for interacting with Chaos contracts:
      </p>
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 font-mono text-xs overflow-x-auto">
        <pre className="text-[var(--text-secondary)]">{`import { ChaosSDK } from '@chaos/sdk'

const sdk = new ChaosSDK({ chainId: 5042002 })

// Create a token
const tx = await sdk.createToken({
  name: 'My Meme',
  symbol: 'MEME',
  metadataURI: 'ipfs://...',
})

// Buy tokens
await sdk.buy(curveAddress, { value: parseEther('1') })`}</pre>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        SDK source is in the <code>/sdk</code> directory.
      </p>
    </div>
  )
}

function Links() {
  return (
    <div className="grid gap-2">
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-sm text-[var(--text-primary)]">Circle Faucet</span>
        <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
      </a>
      <a
        href="https://testnet.arcscan.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-sm text-[var(--text-primary)]">Arc Explorer</span>
        <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
      </a>
      <a
        href="https://liteforge.explorer.caldera.xyz"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-sm text-[var(--text-primary)]">LitVM Explorer</span>
        <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
      </a>
      <a
        href="https://docs.arc.io"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-sm text-[var(--text-primary)]">Arc Documentation</span>
        <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
      </a>
    </div>
  )
}
