import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi'
import { Wallet, LogOut, X, ChevronDown, ExternalLink, Download, User, BarChart3 } from 'lucide-react'
import { formatUnits } from 'viem'
import { ChaosLogo } from './ChaosLogo'

const WALLET_ICONS: Record<string, string> = {
  metamask: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2035%2033%22%3E%3Cpath%20fill%3D%22%23E17726%22%20d%3D%22M32.96%201l-13.14%209.72%202.45-5.73L32.96%201z%22/%3E%3Cpath%20fill%3D%22%23E27625%22%20d%3D%22M2.66%201l13.02%209.8-2.33-5.81L2.66%201zm25.57%2022.53l-3.5%205.34%207.49%202.06%202.14-7.28-6.13-.12zm-26.96.12l2.13%207.28%207.47-2.06-3.48-5.34-6.12.12z%22/%3E%3Cpath%20fill%3D%22%23E27625%22%20d%3D%22M10.47%2014.51l-2.08%203.14%207.4.34-.26-7.97-5.06%204.49zm14.68%200l-5.16-4.58-.17%208.06%207.4-.34-2.07-3.14z%22/%3E%3C/svg%3E',
  okx: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%23000%22/%3E%3Crect x=%228%22 y=%228%22 width=%226%22 height=%226%22 rx=%221%22 fill=%22%23fff%22/%3E%3Crect x=%2218%22 y=%228%22 width=%226%22 height=%226%22 rx=%221%22 fill=%22%23fff%22/%3E%3Crect x=%228%22 y=%2218%22 width=%226%22 height=%226%22 rx=%221%22 fill=%22%23fff%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%226%22 height=%226%22 rx=%221%22 fill=%22%23fff%22/%3E%3Crect x=%2213%22 y=%2213%22 width=%226%22 height=%226%22 rx=%221%22 fill=%22%23fff%22/%3E%3C/svg%3E',
  backpack: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%23e33e3f%22/%3E%3Cpath d=%22M16 6a6 6 0 016 6v2h-2v-2a4 4 0 00-8 0v2h-2v-2a6 6 0 016-6zm-6 10h12a2 2 0 012 2v8a2 2 0 01-2 2H10a2 2 0 01-2-2v-8a2 2 0 012-2zm6 4a2 2 0 100 4 2 2 0 000-4z%22 fill=%22%23fff%22/%3E%3C/svg%3E',
  coinbase: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%230052FF%22/%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2210%22 fill=%22%23fff%22/%3E%3Crect x=%2212%22 y=%2212%22 width=%228%22 height=%228%22 rx=%222%22 fill=%22%230052FF%22/%3E%3C/svg%3E',
  walletconnect: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%233B99FC%22/%3E%3Cpath d=%22M10 14c3.3-3.2 8.7-3.2 12 0l.4.4a.5.5 0 010 .7l-1.4 1.3a.3.3 0 01-.4 0l-.6-.6c-2.3-2.2-6-2.2-8.3 0l-.6.6a.3.3 0 01-.4 0L9.3 15.1a.5.5 0 010-.7L10 14z%22 fill=%22%23fff%22/%3E%3C/svg%3E',
}

function GenericWalletIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="13" r="1.5" fill="currentColor" />
    </svg>
  )
}

function getConnectorIcon(connector: { id: string; name: string; icon?: string }): string | null {
  const id = connector.id.toLowerCase()
  const name = connector.name.toLowerCase()
  if (id.includes('metamask') || name.includes('metamask')) return WALLET_ICONS.metamask
  if (id.includes('okx') || name.includes('okx')) return WALLET_ICONS.okx
  if (id.includes('backpack') || name.includes('backpack')) return WALLET_ICONS.backpack
  if (id.includes('coinbase') || name.includes('coinbase')) return WALLET_ICONS.coinbase
  if (id === 'walletconnect' || name.includes('walletconnect')) return WALLET_ICONS.walletconnect
  if (connector.icon && !connector.icon.includes('metamask') && connector.icon.length > 0) {
    // Prefer connector-provided icons except when everything wrongly shares one fox blob
    return connector.icon
  }
  return null
}

import { supportedChains, getChainConfig, getNativeSymbol } from '../config/chains'

interface HeaderProps {
  onCreateClick: () => void
  onProfileClick?: () => void
  onLeaderboardClick?: () => void
}

const isMobile = () => {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

const hasInjectedProvider = () => {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { ethereum?: unknown }).ethereum
}

export function Header({ onProfileClick, onLeaderboardClick }: HeaderProps) {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: balance } = useBalance({ address })
  
  const [showConnectorModal, setShowConnectorModal] = useState(false)
  const [showNetworkMenu, setShowNetworkMenu] = useState(false)
  const [friendlyError, setFriendlyError] = useState<string | null>(null)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [hasProvider, setHasProvider] = useState(true)

  const currentChainConfig = chainId ? getChainConfig(chainId) : undefined
  const isUnsupportedNetwork = isConnected && !currentChainConfig

  useEffect(() => {
    setIsMobileDevice(isMobile())
    setHasProvider(hasInjectedProvider())
  }, [])

  useEffect(() => {
    if (connectError) {
      const msg = connectError.message?.toLowerCase() || ''
      if (msg.includes('provider not found') || msg.includes('no provider')) {
        if (isMobileDevice) {
          setFriendlyError('Open this site in your wallet app browser')
        } else {
          setFriendlyError('Install MetaMask or another wallet')
        }
      } else if (msg.includes('user rejected')) {
        setFriendlyError('Connection cancelled')
      } else {
        setFriendlyError('Connection failed')
      }
    } else {
      setFriendlyError(null)
    }
  }, [connectError, isMobileDevice])

  const ensureArcChain = () => {
    const config = getChainConfig(supportedChains[0].id)
    if (!config) return
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
    if (!eth?.request) return
    eth.request({
      method: 'wallet_addEthereumChain',
      params: [config.addChainParams],
    }).catch(() => {})
    try {
      switchChain({ chainId: supportedChains[0].id as 5042002 | 4441 })
    } catch {
      /* user may reject */
    }
  }

  const handleConnect = async (selectedConnector: typeof connectors[0]) => {
    setFriendlyError(null)
    try {
      connect({ connector: selectedConnector })
      setShowConnectorModal(false)
      // Prompt MetaMask / injected wallets to add Arc Testnet
      setTimeout(() => ensureArcChain(), 400)
    } catch (err) {
      console.error('Connect error:', err)
    }
  }

  const handleSwitchNetwork = (targetChainId: number) => {
    const config = getChainConfig(targetChainId)
    if (!config) return
    
    try {
      if ((window as unknown as { ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum) {
        (window as unknown as { ethereum: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [config.addChainParams],
        }).catch(() => {})
      }
      switchChain({ chainId: targetChainId as 5042002 | 4441 })
      setShowNetworkMenu(false)
    } catch (err) {
      console.error('Switch chain error:', err)
    }
  }

  const openInMetaMask = () => {
    window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`
  }

  const getConnectorName = (c: typeof connectors[0]) => {
    if (c.id === 'injected') return c.name === 'Injected' ? 'Browser Wallet' : c.name
    return c.name
  }

  const availableConnectors = connectors.filter(c => {
    if (c.id === 'injected' && !hasProvider && isMobileDevice) return false
    return true
  })

  return (
    <>
      <header 
        className="sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <ChaosLogo size={28} />
            <span className="chaos-wordmark text-[17px] text-[var(--text-primary)]">Chaos</span>
          </a>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Combined network + wallet */}
            {isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                  className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border transition-colors ${
                    isUnsupportedNetwork
                      ? 'bg-[var(--red-dim)] border-[var(--red)]/20 text-[var(--red)]'
                      : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUnsupportedNetwork ? 'bg-[var(--red)]' : 'bg-[var(--green)]'}`} />
                  <span className="hidden sm:inline text-xs font-medium text-[var(--text-secondary)] max-w-[5.5rem] truncate">
                    {isUnsupportedNetwork ? 'Wrong network' : (currentChainConfig?.chain.name || 'Network')}
                  </span>
                  <span className="hidden md:inline text-xs text-[var(--text-tertiary)]">
                    {balance ? `${parseFloat(formatUnits(balance.value, 18)).toFixed(2)} ${getNativeSymbol(chainId || 0)}` : ''}
                  </span>
                  <span className="text-sm font-mono text-[var(--text-primary)]">
                    {address?.slice(0, 4)}...{address?.slice(-4)}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </button>

                {showNetworkMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNetworkMenu(false)} />
                    <div className="absolute right-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl z-50 animate-fade-in overflow-hidden">
                      <div className="px-3 py-2 border-b border-[var(--border)]">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Network</p>
                      </div>
                      {supportedChains.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() => handleSwitchNetwork(chain.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors ${
                            chainId === chain.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${chainId === chain.id ? 'bg-[var(--green)]' : 'bg-[var(--border)]'}`} />
                          {chain.name}
                        </button>
                      ))}
                      <div className="border-t border-[var(--border)]">
                        {onProfileClick && (
                          <button
                            onClick={() => {
                              setShowNetworkMenu(false)
                              onProfileClick()
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <User className="w-3.5 h-3.5" />
                            Profile
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowNetworkMenu(false)
                            disconnect()
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowConnectorModal(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-lg text-sm disabled:opacity-50"
              >
                <Wallet className="w-3.5 h-3.5" />
                {isPending ? 'Connecting...' : 'Connect'}
              </button>
            )}

            {/* Leaderboard button */}
            {onLeaderboardClick && (
              <button
                onClick={onLeaderboardClick}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
                title="Leaderboard"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span className="hidden sm:inline text-xs font-medium text-[var(--text-secondary)]">Leaderboard</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Connector Modal */}
      {showConnectorModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center modal-backdrop"
          onClick={() => setShowConnectorModal(false)}
        >
          <div 
            className="w-full sm:max-w-sm bg-[var(--bg-card)] border border-[var(--border)] sm:rounded-xl rounded-t-xl animate-slide-up-sheet sm:animate-fade-in"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Connect wallet</h3>
              <button
                onClick={() => setShowConnectorModal(false)}
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-3 space-y-1">
              {availableConnectors.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => handleConnect(c)}
                  disabled={isPending}
                  className="w-full flex items-center gap-3 p-3 connector-option rounded-lg disabled:opacity-50"
                >
                  {(() => {
                    const iconUrl = getConnectorIcon(c as { id: string; name: string; icon?: string })
                    return (
                      <>
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
                          {iconUrl ? (
                            <img src={iconUrl} alt="" className="w-7 h-7 object-contain" />
                          ) : (
                            <div className="text-[var(--text-tertiary)]">
                              <GenericWalletIcon />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{getConnectorName(c)}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {c.id === 'walletConnect' ? 'Scan QR code' : 'Browser extension'}
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </button>
              ))}

              {isMobileDevice && !hasProvider && (
                <button
                  onClick={openInMetaMask}
                  className="w-full flex items-center gap-3 p-3 connector-option rounded-lg"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
                    <img src={WALLET_ICONS.metamask} alt="" className="w-7 h-7 object-contain" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-[var(--text-primary)]">Open in MetaMask</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Continue in MetaMask app</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              )}

              {!isMobileDevice && availableConnectors.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-sm text-[var(--text-secondary)] mb-2">No wallet detected</p>
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[var(--text-primary)] hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Install MetaMask
                  </a>
                </div>
              )}
              
              {friendlyError && (
                <div className="p-3 bg-[var(--red-dim)] rounded-lg border border-[var(--red)]/20">
                  <p className="text-xs text-[var(--red)]">{friendlyError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
