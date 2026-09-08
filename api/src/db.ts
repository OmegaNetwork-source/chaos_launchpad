import Database from 'better-sqlite3'
import { config } from './config.js'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

let db: Database.Database | null = null

export interface TokenRecord {
  address: string
  curve: string
  name: string
  symbol: string
  metadataURI: string
  creator: string
  createdAt: number
  graduated: boolean
  lastSynced: number
}

export interface CurveState {
  address: string
  virtualUsdc: string
  virtualTokens: string
  realUsdcRaised: string
  tokensSold: string
  graduated: boolean
  pair: string | null
  currentPrice: string
  progress: number
  lastSynced: number
}

export function getDb(): Database.Database {
  if (db) return db

  try {
    mkdirSync(dirname(config.dbPath), { recursive: true })
  } catch {}

  db = new Database(config.dbPath)
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      address TEXT PRIMARY KEY,
      curve TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      metadataURI TEXT,
      creator TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      graduated INTEGER DEFAULT 0,
      lastSynced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS curve_states (
      address TEXT PRIMARY KEY,
      virtualUsdc TEXT NOT NULL,
      virtualTokens TEXT NOT NULL,
      realUsdcRaised TEXT NOT NULL,
      tokensSold TEXT NOT NULL,
      graduated INTEGER DEFAULT 0,
      pair TEXT,
      currentPrice TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      lastSynced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_tokens_graduated ON tokens(graduated);
    CREATE INDEX IF NOT EXISTS idx_curve_raised ON curve_states(realUsdcRaised DESC);
  `)

  return db
}

export function upsertToken(token: TokenRecord): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO tokens (address, curve, name, symbol, metadataURI, creator, createdAt, graduated, lastSynced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      graduated = excluded.graduated,
      lastSynced = excluded.lastSynced
  `).run(
    token.address,
    token.curve,
    token.name,
    token.symbol,
    token.metadataURI,
    token.creator,
    token.createdAt,
    token.graduated ? 1 : 0,
    token.lastSynced
  )
}

export function upsertCurveState(state: CurveState): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO curve_states (address, virtualUsdc, virtualTokens, realUsdcRaised, tokensSold, graduated, pair, currentPrice, progress, lastSynced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      virtualUsdc = excluded.virtualUsdc,
      virtualTokens = excluded.virtualTokens,
      realUsdcRaised = excluded.realUsdcRaised,
      tokensSold = excluded.tokensSold,
      graduated = excluded.graduated,
      pair = excluded.pair,
      currentPrice = excluded.currentPrice,
      progress = excluded.progress,
      lastSynced = excluded.lastSynced
  `).run(
    state.address,
    state.virtualUsdc,
    state.virtualTokens,
    state.realUsdcRaised,
    state.tokensSold,
    state.graduated ? 1 : 0,
    state.pair,
    state.currentPrice,
    state.progress,
    state.lastSynced
  )
}

export function getTokens(options: { limit?: number; offset?: number; graduated?: boolean } = {}) {
  const db = getDb()
  const { limit = 50, offset = 0, graduated } = options

  let query = 'SELECT * FROM tokens'
  const params: any[] = []

  if (graduated !== undefined) {
    query += ' WHERE graduated = ?'
    params.push(graduated ? 1 : 0)
  }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return db.prepare(query).all(...params) as TokenRecord[]
}

export function getToken(address: string): TokenRecord | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM tokens WHERE address = ?').get(address) as TokenRecord | undefined
}

export function getCurveState(address: string): CurveState | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM curve_states WHERE address = ?').get(address) as CurveState | undefined
}

export function getTokenCount(): number {
  const db = getDb()
  const result = db.prepare('SELECT COUNT(*) as count FROM tokens').get() as { count: number }
  return result.count
}
