#!/usr/bin/env node
/**
 * Offline indexer: fetch TokensPurchased/TokensSold for swarm tokens
 * and write static analytics JSON for the web UI.
 *
 * Strictly serial RPC with long backoff — Arc rate-limits aggressively.
 *
 * Usage: node scripts/index-analytics.mjs
 */
import { createPublicClient, http, parseAbiItem, formatUnits } from '../web/node_modules/viem/_esm/index.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TOKENS_PATH = process.env.TOKENS_JSON || '/workspace/fuse-swarm/tokens.json'
const RPC = process.env.ARC_RPC || 'https://rpc.testnet.arc.network'
const CHUNK = 5000n
const ZERO = '0x0000000000000000000000000000000000000000'
const CALL_GAP_MS = Number(process.env.CALL_GAP_MS || 600)
const RATE_LIMIT_SLEEP_MS = Number(process.env.RATE_LIMIT_SLEEP_MS || 8000)

const TOKENS_PURCHASED = parseAbiItem(
  'event TokensPurchased(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 newPrice)'
)
const TOKENS_SOLD = parseAbiItem(
  'event TokensSold(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 newPrice)'
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
    const currentTo =
      currentFrom + CHUNK - 1n > toBlock ? toBlock : currentFrom + CHUNK - 1n
    const logs = await withBackoff(
      () =>
        client.getLogs({
          address,
          event,
          fromBlock: currentFrom,
          toBlock: currentTo,
        }),
      `getLogs ${address.slice(0, 10)} ${currentFrom}-${currentTo}`
    )
    all.push(...logs)
    chunks++
    currentFrom = currentTo + 1n
  }
  return { logs: all, chunks }
}

async function resolveCreateBlock(createTx) {
  if (!createTx) return null
  const receipt = await withBackoff(
    () => client.getTransactionReceipt({ hash: createTx }),
    `receipt ${createTx.slice(0, 12)}`
  )
  return receipt.blockNumber
}

function estimateTimestamps(blockNumbers, tipBlock, tipTs, blockTimeSec = 2) {
  const map = new Map()
  for (const bn of blockNumbers) {
    const delta = Number(tipBlock - bn)
    map.set(bn, Math.max(0, tipTs - delta * blockTimeSec))
  }
  return map
}

function buildAnalytics({ token, curve, createBlock, buyLogs, sellLogs, blockTimestamps }) {
  const balances = new Map()
  for (const log of buyLogs) {
    const buyer = log.args.buyer.toLowerCase()
    balances.set(buyer, (balances.get(buyer) || 0n) + log.args.tokensOut)
  }
  for (const log of sellLogs) {
    const seller = log.args.seller.toLowerCase()
    balances.set(seller, (balances.get(seller) || 0n) - log.args.tokensIn)
  }
  balances.delete(curve.toLowerCase())
  balances.delete(ZERO)

  const positive = Array.from(balances.entries())
    .filter(([, bal]) => bal > 0n)
    .sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0))

  const sold = positive.reduce((acc, [, b]) => acc + b, 0n)

  const holders = positive.slice(0, 50).map(([addr, balance]) => ({
    address: addr,
    balance: balance.toString(),
    percentage: sold > 0n ? Number((balance * 10000n) / sold) / 100 : 0,
  }))

  let totalVolume = 0n
  for (const log of buyLogs) totalVolume += log.args.quoteIn
  for (const log of sellLogs) totalVolume += log.args.quoteOut

  const buyTrades = buyLogs.map((log) => ({
    type: 'buy',
    trader: log.args.buyer,
    quoteAmount: log.args.quoteIn.toString(),
    tokenAmount: log.args.tokensOut.toString(),
    newPrice: log.args.newPrice.toString(),
    timestamp: blockTimestamps.get(log.blockNumber) || 0,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber.toString(),
  }))
  const sellTrades = sellLogs.map((log) => ({
    type: 'sell',
    trader: log.args.seller,
    quoteAmount: log.args.quoteOut.toString(),
    tokenAmount: log.args.tokensIn.toString(),
    newPrice: log.args.newPrice.toString(),
    timestamp: blockTimestamps.get(log.blockNumber) || 0,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber.toString(),
  }))

  const trades = [...buyTrades, ...sellTrades]
    .sort(
      (a, b) =>
        b.timestamp - a.timestamp ||
        Number(BigInt(b.blockNumber) - BigInt(a.blockNumber))
    )
    .slice(0, 100)

  const chronological = [...buyLogs, ...sellLogs].sort(
    (a, b) => Number(a.blockNumber - b.blockNumber)
  )
  const prices = chronological.map((log) => ({
    time: blockTimestamps.get(log.blockNumber) || 0,
    price: Number(formatUnits(log.args.newPrice, 18)),
  }))
  const priceHistory = Array.from(
    prices
      .reduce((acc, p) => {
        acc.set(p.time, p)
        return acc
      }, new Map())
      .values()
  ).sort((a, b) => a.time - b.time)

  return {
    token: token.toLowerCase(),
    curve: curve.toLowerCase(),
    createBlock: createBlock.toString(),
    indexedAt: new Date().toISOString(),
    holderCount: positive.length,
    buyCount: buyLogs.length,
    sellCount: sellLogs.length,
    totalVolume: totalVolume.toString(),
    holders,
    trades,
    priceHistory,
  }
}

async function indexToken(entry, latest, tipTs) {
  const token = entry.token
  const curve = entry.curve
  console.log(`\n[${entry.symbol}] token=${token} curve=${curve}`)

  let createBlock = await resolveCreateBlock(entry.createTx)
  if (createBlock == null) {
    console.warn('  no createTx receipt; scanning last 100k')
    createBlock = latest > 100000n ? latest - 100000n : 0n
  }
  console.log(`  createBlock=${createBlock} → latest=${latest}`)

  // Serial: buys then sells (never parallel — Arc rate limits hard)
  const buys = await fetchLogsChunked(curve, TOKENS_PURCHASED, createBlock, latest)
  console.log(`  buys=${buys.logs.length} (${buys.chunks} chunks)`)
  const sells = await fetchLogsChunked(curve, TOKENS_SOLD, createBlock, latest)
  console.log(`  sells=${sells.logs.length} (${sells.chunks} chunks)`)

  const blocks = [...buys.logs, ...sells.logs].map((l) => l.blockNumber)
  const blockTimestamps = estimateTimestamps(blocks, latest, tipTs)

  return buildAnalytics({
    token,
    curve,
    createBlock,
    buyLogs: buys.logs,
    sellLogs: sells.logs,
    blockTimestamps,
  })
}

async function main() {
  if (!existsSync(TOKENS_PATH)) {
    console.error('tokens.json not found at', TOKENS_PATH)
    process.exit(1)
  }
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'))
  console.log(`Indexing ${tokens.length} tokens via ${RPC}`)
  console.log(`CALL_GAP_MS=${CALL_GAP_MS} RATE_LIMIT_SLEEP_MS=${RATE_LIMIT_SLEEP_MS}`)

  const latest = await withBackoff(() => client.getBlockNumber(), 'getBlockNumber')
  const tipBlock = await withBackoff(
    () => client.getBlock({ blockNumber: latest }),
    'getBlock tip'
  )
  const tipTs = Number(tipBlock.timestamp)
  console.log('latest block', latest.toString(), 'ts', tipTs)

  const publicDir = join(ROOT, 'web/public/analytics')
  const distDir = join(ROOT, 'web/dist/analytics')
  mkdirSync(publicDir, { recursive: true })
  mkdirSync(distDir, { recursive: true })

  const only = process.env.ONLY_SYMBOLS
    ? new Set(process.env.ONLY_SYMBOLS.split(',').map((s) => s.trim().toUpperCase()))
    : null

  const indexPath = join(publicDir, 'index.json')
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {}

  for (const entry of tokens) {
    if (only && !only.has(entry.symbol.toUpperCase())) continue

    const outName = `${entry.token.toLowerCase()}.json`
    const outPublic = join(publicDir, outName)
    if (process.env.SKIP_EXISTING === '1' && existsSync(outPublic)) {
      const prev = JSON.parse(readFileSync(outPublic, 'utf8'))
      if ((prev.buyCount || 0) > 0) {
        console.log(`\n[${entry.symbol}] skip existing buys=${prev.buyCount}`)
        index[entry.token.toLowerCase()] = {
          holderCount: prev.holderCount,
          buyCount: prev.buyCount,
          sellCount: prev.sellCount,
          totalVolume: prev.totalVolume,
          curve: prev.curve,
          symbol: entry.symbol,
        }
        continue
      }
    }

    try {
      const analytics = await indexToken(entry, latest, tipTs)
      const json = JSON.stringify(analytics, null, 2)
      writeFileSync(outPublic, json)
      writeFileSync(join(distDir, outName), json)
      index[analytics.token] = {
        holderCount: analytics.holderCount,
        buyCount: analytics.buyCount,
        sellCount: analytics.sellCount,
        totalVolume: analytics.totalVolume,
        curve: analytics.curve,
        symbol: entry.symbol,
      }
      // persist index incrementally
      writeFileSync(indexPath, JSON.stringify(index, null, 2))
      writeFileSync(join(distDir, 'index.json'), JSON.stringify(index, null, 2))
      console.log(
        `  wrote ${outName} holders=${analytics.holderCount} buys=${analytics.buyCount} sells=${analytics.sellCount} vol=${analytics.totalVolume}`
      )
    } catch (err) {
      console.error(`  FAILED ${entry.symbol}:`, err?.shortMessage || err?.message || err)
      index[entry.token.toLowerCase()] = {
        holderCount: 0,
        buyCount: 0,
        sellCount: 0,
        totalVolume: '0',
        curve: entry.curve.toLowerCase(),
        symbol: entry.symbol,
        error: String(err?.shortMessage || err?.message || err),
      }
      writeFileSync(indexPath, JSON.stringify(index, null, 2))
      // cool down hard after a failure
      await sleep(RATE_LIMIT_SLEEP_MS)
    }
  }

  writeFileSync(indexPath, JSON.stringify(index, null, 2))
  writeFileSync(join(distDir, 'index.json'), JSON.stringify(index, null, 2))
  console.log('\nDone. Wrote', Object.keys(index).length, 'entries to public+dist analytics/')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
