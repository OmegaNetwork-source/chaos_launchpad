import { http, createConfig, type CreateConnectorFn } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { supportedChains, arcTestnet, litvm, chainConfigs } from './chains'

export { arcTestnet, litvm } from './chains'

export const arcTestnetParams = chainConfigs[arcTestnet.id].addChainParams
export const litvmParams = chainConfigs[litvm.id].addChainParams

const getConnectors = (): CreateConnectorFn[] => {
  const connectorList: CreateConnectorFn[] = [
    injected({
      shimDisconnect: true,
    }),
  ]

  const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID as string | undefined
  if (wcProjectId) {
    connectorList.push(
      walletConnect({
        projectId: wcProjectId,
        metadata: {
          name: 'Chaos',
          description: 'The quickest way to launch memes',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://chaos.omeganetwork.co',
          icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.svg` : 'https://chaos.omeganetwork.co/favicon.svg'],
        },
        showQrModal: true,
      })
    )
  }

  return connectorList
}

export const config = createConfig({
  chains: supportedChains,
  connectors: getConnectors(),
  transports: {
    [arcTestnet.id]: http(),
    [litvm.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
