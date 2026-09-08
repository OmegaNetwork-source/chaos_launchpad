import { useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { config } from './config/wagmi'
import { Header } from './components/Header'
import { FaucetBanner } from './components/FaucetBanner'
import { TokenList } from './components/TokenList'
import { TokenDetail } from './components/TokenDetail'
import { CreateToken } from './components/CreateToken'
import { ChaosLogoSimple } from './components/ChaosLogo'
import { DocsModal } from './components/DocsModal'
import { Profile } from './components/Profile'
import { Leaderboard } from './components/Leaderboard'
import { ExternalLink } from 'lucide-react'

const queryClient = new QueryClient()

type View = 'list' | 'detail'

interface TokenInfo {
  token: `0x${string}`
  curve: `0x${string}`
  name: string
  symbol: string
  metadataURI: string
  creator: `0x${string}`
  createdAt: bigint
  graduated: boolean
}

function AppContent() {
  const [view, setView] = useState<View>('list')
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <FaucetBanner />
      <Header
        onCreateClick={() => setShowCreate(true)}
        onProfileClick={() => setShowProfile(true)}
        onLeaderboardClick={() => setShowLeaderboard(true)}
      />
      
      <main className="flex-1 w-full px-4 py-6">
        {view === 'list' && (
          <TokenList
            onSelectToken={(token) => {
              setSelectedToken(token)
              setView('detail')
            }}
            onCreateToken={() => setShowCreate(true)}
          />
        )}
        {view === 'detail' && selectedToken && (
          <TokenDetail
            tokenInfo={selectedToken}
            onBack={() => {
              setSelectedToken(null)
              setView('list')
            }}
          />
        )}
      </main>

      <CreateToken
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false)
          setView('list')
        }}
      />

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChaosLogoSimple size={16} className="text-[var(--text-tertiary)]" />
            <span className="chaos-wordmark text-xs text-[var(--text-muted)]">Chaos</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setShowDocs(true)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Docs
            </button>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
            >
              Faucet <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
            >
              Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

      <DocsModal isOpen={showDocs} onClose={() => setShowDocs(false)} />

      <Profile
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        onSelectToken={(token) => {
          setSelectedToken(token)
          setView('detail')
          setShowProfile(false)
        }}
      />

      <Leaderboard
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
          },
          success: {
            iconTheme: {
              primary: 'var(--green)',
              secondary: '#000',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--red)',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
