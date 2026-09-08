export interface FuseConfig {
  factoryAddress: `0x${string}`
  rpcUrl?: string
  chainId?: number
}

export interface TokenInfo {
  token: `0x${string}`
  curve: `0x${string}`
  name: string
  symbol: string
  metadataURI: string
  creator: `0x${string}`
  createdAt: bigint
  graduated: boolean
}

export interface CurveState {
  virtualUsdc: bigint
  virtualTokens: bigint
  realUsdcRaised: bigint
  tokensSold: bigint
  graduated: boolean
  pair: `0x${string}`
}

export interface Quote {
  amount: bigint
  fee: bigint
}

export interface CreateTokenParams {
  name: string
  symbol: string
  metadataURI?: string
}

export interface BuyParams {
  curveAddress: `0x${string}`
  usdcAmount: bigint
  minTokensOut?: bigint
  slippageBps?: number
}

export interface SellParams {
  curveAddress: `0x${string}`
  tokensAmount: bigint
  minUsdcOut?: bigint
  slippageBps?: number
}
