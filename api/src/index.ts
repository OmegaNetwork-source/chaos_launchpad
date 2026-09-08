import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { config } from './config.js'
import { getTokens, getToken, getCurveState, getTokenCount } from './db.js'
import { startSyncLoop, getBuyQuote, getSellQuote, syncCurveState } from './indexer.js'
import { parseUnits } from 'viem'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => {
  return c.json({
    name: 'Spark API',
    version: '1.0.0',
    chainId: config.chainId,
    factoryAddress: config.factoryAddress,
    endpoints: {
      'GET /tokens': 'List tokens',
      'GET /tokens/:address': 'Get token details',
      'GET /tokens/:address/state': 'Get curve state',
      'GET /quote/buy': 'Get buy quote (query: curve, amount)',
      'GET /quote/sell': 'Get sell quote (query: curve, amount)',
      'GET /stats': 'Get platform stats',
    },
  })
})

app.get('/tokens', (c) => {
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  const graduated = c.req.query('graduated')

  const tokens = getTokens({
    limit: Math.min(limit, 100),
    offset,
    graduated: graduated === 'true' ? true : graduated === 'false' ? false : undefined,
  })

  const total = getTokenCount()

  return c.json({
    tokens: tokens.map((t) => ({
      ...t,
      state: getCurveState(t.curve),
    })),
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + tokens.length < total,
    },
  })
})

app.get('/tokens/:address', async (c) => {
  const address = c.req.param('address').toLowerCase()
  const token = getToken(address)

  if (!token) {
    return c.json({ error: 'Token not found' }, 404)
  }

  const state = getCurveState(token.curve)

  return c.json({
    ...token,
    state,
  })
})

app.get('/tokens/:address/state', async (c) => {
  const address = c.req.param('address').toLowerCase()
  const token = getToken(address)

  if (!token) {
    return c.json({ error: 'Token not found' }, 404)
  }

  await syncCurveState(token.curve as `0x${string}`)
  const state = getCurveState(token.curve)

  return c.json(state || { error: 'State not found' })
})

app.get('/quote/buy', async (c) => {
  const curve = c.req.query('curve')
  const amount = c.req.query('amount')

  if (!curve || !amount) {
    return c.json({ error: 'Missing curve or amount parameter' }, 400)
  }

  try {
    const amountWei = parseUnits(amount, 18)
    const quote = await getBuyQuote(curve as `0x${string}`, amountWei)
    return c.json(quote)
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

app.get('/quote/sell', async (c) => {
  const curve = c.req.query('curve')
  const amount = c.req.query('amount')

  if (!curve || !amount) {
    return c.json({ error: 'Missing curve or amount parameter' }, 400)
  }

  try {
    const amountWei = parseUnits(amount, 18)
    const quote = await getSellQuote(curve as `0x${string}`, amountWei)
    return c.json(quote)
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

app.get('/stats', (c) => {
  const total = getTokenCount()
  const graduated = getTokens({ graduated: true, limit: 1000 }).length
  const active = total - graduated

  return c.json({
    totalTokens: total,
    graduatedTokens: graduated,
    activeTokens: active,
    chainId: config.chainId,
    factoryAddress: config.factoryAddress,
  })
})

app.post('/sync', async (c) => {
  const { syncTokens } = await import('./indexer.js')
  await syncTokens()
  return c.json({ success: true, message: 'Sync triggered' })
})

console.log(`Starting Spark API on port ${config.port}`)
console.log(`Factory: ${config.factoryAddress}`)
console.log(`RPC: ${config.rpcUrl}`)

startSyncLoop(30000)

serve({
  fetch: app.fetch,
  port: config.port,
})

console.log(`Spark API running at http://localhost:${config.port}`)
