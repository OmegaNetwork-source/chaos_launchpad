#!/usr/bin/env node
/**
 * Offline leaderboard generator: aggregate TokenCreated, trade events, and fees
 * across all tokens to produce a static leaderboard snapshot.
 *
 * Usage: node scripts/generate-leaderboard.mjs
 *
 * Environment variables:
 *   ARC_RPC          - RPC URL (default: https://rpc.testnet.arc.network)
 *   FACTORY_ADDRESS  - Factory contract address (default: 0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A)
 *   CALL_GAP_MS      - Delay between RPC calls (default: 600)
 *   RATE_LIMIT_SLEEP_MS - Backoff on rate limit (default: 8000)
 */
import { createPublicClient, http, parseAbiItem, formatUnits } from '../web/node_modules/viem/_esm/index.js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RPC = process.env.ARC_RPC || 'https://rpc.testnet.arc.network'
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || '0xEFAc4bcB8b10947B5E30B5F3F9b4f5b6306a445A'
const CHUNK = 5000n
const CALL_GAP_MS = Number(process.env.CALL_GAP_MS || 600)
const RATE_LIMIT_SLEEP_MS = Number(process.env.RATE_LIMIT_SLEEP_MS || 8000)

const TOKEN_CREATED = parseAbiItem(
  'event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, address quoteToken)'
)
const TOKENS_PURCHASED = parseAbiItem(
  'event TokensPurchased(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 newPrice)'
)
const TOKENS_SOLD = parseAbiItem(
  'event TokensSold(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 newPrice)'
)
const CREATOR_FEES_CLAIMED = parseAbiItem(
  'event CreatorFeesClaimed(address indexed creator, uint256 amount)'
)

const chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
}

const client = createPublicClient({
  chain,
  transport: http(RPC, { timeout: 60_000, retryCount: 0 }),
})

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function isRateLimit(err) {
  const msg = `${err?.shortMessage || ''} ${err?.message || ''} ${err?.details || ''}`.toLowerCase()
  return msg.includes('rate limit') || msg.includes('exceeds defined limit') || msg.includes('429')
}

let lastCall = 0
async function throttle() {
  const now = Date.now()
  const wait = CALL_GAP_MS - (now - lastCall)
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()
}

async function withBackoff(fn, label, maxRetries = 10) {
  let delay = RATE_LIMIT_SLEEP_MS
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await throttle()
    try {
      return await fn()
    } catch (err) {
      const msg = err?.shortMessage || err?.message || String(err)
      const rl = isRateLimit(err)
      console.warn(`  retry ${attempt + 1}/${maxRetries} ${label}${rl ? ' [rate-limit]' : ''}: ${String(msg).slice(0, 100)}`)
      if (attempt === maxRetries - 1) throw err
      await sleep(rl ? delay : Math.min(2000 * (attempt + 1), 10000))
      if (rl) delay = Math.min(delay * 1.5, 30000)
    }
  }
}

async function fetchLogsChunked(address, event, fromBlock, toBlock) {
  const all = []
  let currentFrom = fromBlock
  let chunks = 0
  while (currentFrom <= toBlock) {
    const currentTo = currentFrom + CHUNK - 1n > toBlock ? toBlock : currentFrom + CHUNK - 1n
    const logs = await withBackoff(
      () => client.getLogs({ address, event, fromBlock: currentFrom, toBlock: currentTo }),
      `getLogs ${currentFrom}-${currentTo}`
    )
    all.push(...logs)
    chunks++
    currentFrom = currentTo + 1n
  }
  return { logs: all, chunks }
}

async function main() {
  console.log(`Generating leaderboard from ${RPC}`)
  console.log(`Factory: ${FACTORY_ADDRESS}`)
  console.log(`CALL_GAP_MS=${CALL_GAP_MS} RATE_LIMIT_SLEEP_MS=${RATE_LIMIT_SLEEP_MS}`)

  const latest = await withBackoff(() => client.getBlockNumber(), 'getBlockNumber')
  const startBlock = latest > 100000n ? latest - 100000n : 0n
  console.log(`Block range: ${startBlock} → ${latest}`)

  console.log('\nFetching TokenCreated events...')
  const { logs: createLogs, chunks: createChunks } = await fetchLogsChunked(
    FACTORY_ADDRESS,
    TOKEN_CREATED,
    startBlock,
    latest
  )
  console.log(`  Found ${createLogs.length} tokens (${createChunks} chunks)`)

  const creatorLaunches = new Map()
  const curveAddresses = []
  const curveToCreator = new Map()

  for (const log of createLogs) {
    const creator = log.args.creator.toLowerCase()
    const curve = log.args.curve.toLowerCase()
    creatorLaunches.set(creator, (creatorLaunches.get(creator) || 0) + 1)
    curveAddresses.push(curve)
    curveToCreator.set(curve, creator)
  }

  console.log(`  ${creatorLaunches.size} unique creators`)
  console.log(`  ${curveAddresses.length} curves to index`)

  const walletVolumes = new Map()
  const walletTrades = new Map()
  const creatorFees = new Map()

  for (let i = 0; i < curveAddresses.length; i++) {
    const curve = curveAddresses[i]
    console.log(`\n[${i + 1}/${curveAddresses.length}] Indexing curve ${curve.slice(0, 10)}...`)

    const { logs: buyLogs } = await fetchLogsChunked(curve, TOKENS_PURCHASED, startBlock, latest)
    console.log(`  buys: ${buyLogs.length}`)

    const { logs: sellLogs } = await fetchLogsChunked(curve, TOKENS_SOLD, startBlock, latest)
    console.log(`  sells: ${sellLogs.length}`)

    const { logs: feeLogs } = await fetchLogsChunked(curve, CREATOR_FEES_CLAIMED, startBlock, latest)
    console.log(`  fee claims: ${feeLogs.length}`)

    for (const log of buyLogs) {
      const buyer = log.args.buyer.toLowerCase()
      const quoteIn = log.args.quoteIn
      walletVolumes.set(buyer, (walletVolumes.get(buyer) || 0n) + quoteIn)
      walletTrades.set(buyer, (walletTrades.get(buyer) || 0) + 1)
    }

    for (const log of sellLogs) {
      const seller = log.args.seller.toLowerCase()
      const quoteOut = log.args.quoteOut
      walletVolumes.set(seller, (walletVolumes.get(seller) || 0n) + quoteOut)
      walletTrades.set(seller, (walletTrades.get(seller) || 0) + 1)
    }

    for (const log of feeLogs) {
      const creator = log.args.creator.toLowerCase()
      const amount = log.args.amount
      creatorFees.set(creator, (creatorFees.get(creator) || 0n) + amount)
    }

    await sleep(200)
  }

  const allWallets = new Set([
    ...creatorLaunches.keys(),
    ...walletVolumes.keys(),
    ...creatorFees.keys(),
  ])

  const entries = Array.from(allWallets).map((wallet) => ({
    wallet,
    tokensLaunched: creatorLaunches.get(wallet) || 0,
    feesClaimed: (creatorFees.get(wallet) || 0n).toString(),
    chaosVolume: (walletVolumes.get(wallet) || 0n).toString(),
    tradeCount: walletTrades.get(wallet) || 0,
  }))

  entries.sort((a, b) => {
    const volA = BigInt(a.chaosVolume)
    const volB = BigInt(b.chaosVolume)
    return volA > volB ? -1 : volA < volB ? 1 : 0
  })

  const leaderboard = {
    generatedAt: new Date().toISOString(),
    factoryAddress: FACTORY_ADDRESS,
    blockRange: { from: startBlock.toString(), to: latest.toString() },
    totalWallets: entries.length,
    entries,
  }

  const publicDir = join(ROOT, 'web/public/leaderboard')
  const distDir = join(ROOT, 'web/dist/leaderboard')
  mkdirSync(publicDir, { recursive: true })
  mkdirSync(distDir, { recursive: true })

  const json = JSON.stringify(leaderboard, null, 2)
  writeFileSync(join(publicDir, 'leaderboard.json'), json)
  writeFileSync(join(distDir, 'leaderboard.json'), json)

  console.log('\n=== Summary ===')
  console.log(`Total wallets: ${entries.length}`)
  console.log(`Total tokens created: ${createLogs.length}`)
  console.log(`Top 5 by volume:`)
  for (const e of entries.slice(0, 5)) {
    const vol = Number(formatUnits(BigInt(e.chaosVolume), 18))
    console.log(`  ${e.wallet.slice(0, 10)}... vol=${vol.toFixed(2)} launched=${e.tokensLaunched} trades=${e.tradeCount}`)
  }
  console.log(`\nWrote leaderboard.json to public/leaderboard/ and dist/leaderboard/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
