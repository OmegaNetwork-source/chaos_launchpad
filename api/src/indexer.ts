import { createPublicClient, http, formatUnits } from 'viem'
import { config, FACTORY_ABI, BONDING_CURVE_ABI } from './config.js'
import { upsertToken, upsertCurveState, getTokens } from './db.js'

const client = createPublicClient({
  chain: {
    id: config.chainId,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  },
  transport: http(config.rpcUrl),
})

export async function syncTokens(): Promise<void> {
  if (config.factoryAddress === '0x0000000000000000000000000000000000000000') {
    console.log('Factory address not configured, skipping sync')
    return
  }

  try {
    const tokenAddresses = await client.readContract({
      address: config.factoryAddress,
      abi: FACTORY_ABI,
      functionName: 'getAllTokens',
    }) as `0x${string}`[]

    console.log(`Found ${tokenAddresses.length} tokens`)

    for (const tokenAddr of tokenAddresses) {
      try {
        const tokenInfo = await client.readContract({
          address: config.factoryAddress,
          abi: FACTORY_ABI,
          functionName: 'getToken',
          args: [tokenAddr],
        }) as {
          token: `0x${string}`
          curve: `0x${string}`
          name: string
          symbol: string
          metadataURI: string
          creator: `0x${string}`
          createdAt: bigint
          graduated: boolean
        }

        upsertToken({
          address: tokenInfo.token.toLowerCase(),
          curve: tokenInfo.curve.toLowerCase(),
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          metadataURI: tokenInfo.metadataURI,
          creator: tokenInfo.creator.toLowerCase(),
          createdAt: Number(tokenInfo.createdAt),
          graduated: tokenInfo.graduated,
          lastSynced: Math.floor(Date.now() / 1000),
        })

        await syncCurveState(tokenInfo.curve)
      } catch (err) {
        console.error(`Error syncing token ${tokenAddr}:`, err)
      }
    }
  } catch (err) {
    console.error('Error syncing tokens:', err)
  }
}

export async function syncCurveState(curveAddress: `0x${string}`): Promise<void> {
  try {
    const [state, currentPrice, progress] = await Promise.all([
      client.readContract({
        address: curveAddress,
        abi: BONDING_CURVE_ABI,
        functionName: 'state',
      }) as Promise<{
        virtualUsdc: bigint
        virtualTokens: bigint
        realUsdcRaised: bigint
        tokensSold: bigint
        graduated: boolean
        pair: `0x${string}`
      }>,
      client.readContract({
        address: curveAddress,
        abi: BONDING_CURVE_ABI,
        functionName: 'getCurrentPrice',
      }) as Promise<bigint>,
      client.readContract({
        address: curveAddress,
        abi: BONDING_CURVE_ABI,
        functionName: 'getProgress',
      }) as Promise<bigint>,
    ])

    upsertCurveState({
      address: curveAddress.toLowerCase(),
      virtualUsdc: state.virtualUsdc.toString(),
      virtualTokens: state.virtualTokens.toString(),
      realUsdcRaised: state.realUsdcRaised.toString(),
      tokensSold: state.tokensSold.toString(),
      graduated: state.graduated,
      pair: state.pair === '0x0000000000000000000000000000000000000000' ? null : state.pair.toLowerCase(),
      currentPrice: currentPrice.toString(),
      progress: Number(progress),
      lastSynced: Math.floor(Date.now() / 1000),
    })
  } catch (err) {
    console.error(`Error syncing curve ${curveAddress}:`, err)
  }
}

export async function getBuyQuote(curveAddress: `0x${string}`, usdcIn: bigint) {
  try {
    const [tokensOut, fee] = await client.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'getBuyQuote',
      args: [usdcIn],
    }) as [bigint, bigint]

    return {
      tokensOut: tokensOut.toString(),
      fee: fee.toString(),
      tokensOutFormatted: formatUnits(tokensOut, 18),
      feeFormatted: formatUnits(fee, 18),
    }
  } catch (err) {
    throw new Error(`Failed to get buy quote: ${err}`)
  }
}

export async function getSellQuote(curveAddress: `0x${string}`, tokensIn: bigint) {
  try {
    const [usdcOut, fee] = await client.readContract({
      address: curveAddress,
      abi: BONDING_CURVE_ABI,
      functionName: 'getSellQuote',
      args: [tokensIn],
    }) as [bigint, bigint]

    return {
      usdcOut: usdcOut.toString(),
      fee: fee.toString(),
      usdcOutFormatted: formatUnits(usdcOut, 18),
      feeFormatted: formatUnits(fee, 18),
    }
  } catch (err) {
    throw new Error(`Failed to get sell quote: ${err}`)
  }
}

let syncInterval: NodeJS.Timeout | null = null

export function startSyncLoop(intervalMs = 30000): void {
  if (syncInterval) return

  syncTokens()
  syncInterval = setInterval(() => syncTokens(), intervalMs)
  console.log(`Started sync loop (every ${intervalMs / 1000}s)`)
}

export function stopSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}
