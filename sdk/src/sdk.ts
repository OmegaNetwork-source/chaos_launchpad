import {
  createPublicClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  encodeFunctionData,
  parseUnits,
  formatUnits,
} from 'viem'
import { FACTORY_ABI, BONDING_CURVE_ABI, TOKEN_ABI } from './abis.js'
import { ARC_TESTNET } from './chains.js'
import type {
  FuseConfig,
  TokenInfo,
  CurveState,
  Quote,
  CreateTokenParams,
  BuyParams,
  SellParams,
} from './types.js'

/**
 * Fuse SDK for interacting with the memecoin launchpad on Arc Testnet
 *
 * @example
 * ```typescript
 * import { FuseSDK } from '@fuse-launchpad/sdk'
 *
 * const spark = new FuseSDK({
 *   factoryAddress: '0x...',
 * })
 *
 * // List all tokens
 * const tokens = await spark.listTokens()
 *
 * // Get buy quote
 * const quote = await spark.getBuyQuote(curveAddress, parseUnits('10', 18))
 *
 * // Prepare buy transaction (for use with wagmi/viem wallet)
 * const tx = spark.prepareBuyTx({
 *   curveAddress,
 *   usdcAmount: parseUnits('10', 18),
 *   slippageBps: 500, // 5%
 * })
 * ```
 */
export class FuseSDK {
  public readonly factoryAddress: `0x${string}`
  public readonly chain: Chain
  public readonly publicClient: PublicClient

  constructor(config: FuseConfig) {
    this.factoryAddress = config.factoryAddress
    this.chain = ARC_TESTNET

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl || this.chain.rpcUrls.default.http[0]),
    })
  }

  /**
   * Get all token addresses
   */
  async getAllTokenAddresses(): Promise<`0x${string}`[]> {
    return this.publicClient.readContract({
      address: this.factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'getAllTokens',
    }) as Promise<`0x${string}`[]>
  }

  /**
   * Get token count
   */
  async getTokenCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'getTokenCount',
    }) as Promise<bigint>
  }

  /**
   * Get token info by address
   */
  async getToken(tokenAddress: `0x${string}`): Promise<TokenInfo> {
    return this.publicClient.readContract({
      address: this.factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'getToken',
      args: [tokenAddress],
    }) as Promise<TokenInfo>
  }

  /**
   * List all tokens with their info
   */
  async listTokens(): Promise<TokenInfo[]> {
    const addresses = await this.getAllTokenAddresses()
    const tokens = await Promise.all(
      addresses.map((addr) => this.getToken(addr))
    )
    return tokens.reverse()
  }

  /**
   * Get curve state for a token
   */
  async getCurveState(curveAddress: `0x${string}`): Promise<CurveState> {
    return this.publicClient.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'state',
    }) as Promise<CurveState>
  }

  /**
   * Get current price for a curve (USDC per token, 18 decimals)
   */
  async getCurrentPrice(curveAddress: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'getCurrentPrice',
    }) as Promise<bigint>
  }

  /**
   * Get progress towards graduation (0-10000 basis points)
   */
  async getProgress(curveAddress: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'getProgress',
    }) as Promise<bigint>
  }

  /**
   * Get buy quote for a given USDC amount
   */
  async getBuyQuote(curveAddress: `0x${string}`, usdcAmount: bigint): Promise<Quote> {
    const [tokensOut, fee] = await this.publicClient.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'getBuyQuote',
      args: [usdcAmount],
    }) as [bigint, bigint]

    return { amount: tokensOut, fee }
  }

  /**
   * Get sell quote for a given token amount
   */
  async getSellQuote(curveAddress: `0x${string}`, tokenAmount: bigint): Promise<Quote> {
    const [usdcOut, fee] = await this.publicClient.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'getSellQuote',
      args: [tokenAmount],
    }) as [bigint, bigint]

    return { amount: usdcOut, fee }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenAddress: `0x${string}`, account: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: tokenAddress,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [account],
    }) as Promise<bigint>
  }

  /**
   * Prepare createToken transaction data
   */
  prepareCreateTokenTx(params: CreateTokenParams): {
    to: `0x${string}`
    data: `0x${string}`
  } {
    const data = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'createToken',
      args: [params.name, params.symbol, params.metadataURI || ''],
    })

    return {
      to: this.factoryAddress,
      data,
    }
  }

  /**
   * Prepare buy transaction data
   */
  async prepareBuyTx(params: BuyParams): Promise<{
    to: `0x${string}`
    data: `0x${string}`
    value: bigint
  }> {
    const slippageBps = params.slippageBps ?? 500 // Default 5%

    let minTokensOut = params.minTokensOut
    if (!minTokensOut) {
      const quote = await this.getBuyQuote(params.curveAddress, params.usdcAmount)
      minTokensOut = (quote.amount * BigInt(10000 - slippageBps)) / 10000n
    }

    const data = encodeFunctionData({
      abi: BONDING_CURVE_ABI,
      functionName: 'buy',
      args: [minTokensOut],
    })

    return {
      to: params.curveAddress,
      data,
      value: params.usdcAmount,
    }
  }

  /**
   * Prepare sell transaction data
   */
  async prepareSellTx(params: SellParams): Promise<{
    to: `0x${string}`
    data: `0x${string}`
  }> {
    const slippageBps = params.slippageBps ?? 500 // Default 5%

    let minUsdcOut = params.minUsdcOut
    if (!minUsdcOut) {
      const quote = await this.getSellQuote(params.curveAddress, params.tokensAmount)
      minUsdcOut = (quote.amount * BigInt(10000 - slippageBps)) / 10000n
    }

    const data = encodeFunctionData({
      abi: BONDING_CURVE_ABI,
      functionName: 'sell',
      args: [params.tokensAmount, minUsdcOut],
    })

    return {
      to: params.curveAddress,
      data,
    }
  }

  /**
   * Format USDC amount (18 decimals) to human-readable string
   */
  formatUsdc(amount: bigint): string {
    return formatUnits(amount, 18)
  }

  /**
   * Parse human-readable USDC amount to bigint (18 decimals)
   */
  parseUsdc(amount: string): bigint {
    return parseUnits(amount, 18)
  }

  /**
   * Format token amount (18 decimals) to human-readable string
   */
  formatTokens(amount: bigint): string {
    return formatUnits(amount, 18)
  }

  /**
   * Parse human-readable token amount to bigint (18 decimals)
   */
  parseTokens(amount: string): bigint {
    return parseUnits(amount, 18)
  }
}
