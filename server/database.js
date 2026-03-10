/**
 * database.js — SQLite database setup + query helpers
 * Uses better-sqlite3 (synchronous, fast, no async hell)
 */

import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'
import { logger } from './logger.js'

const DB_PATH = process.env.DB_PATH || './data/mcafk.db'

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

let db

export function initDatabase() {
  db = new Database(DB_PATH, { verbose: null })

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    -- ─── Accounts ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS accounts (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      auth_type   TEXT NOT NULL DEFAULT 'offline',  -- 'offline' | 'microsoft'
      username    TEXT NOT NULL,
      server_host TEXT NOT NULL DEFAULT 'localhost',
      server_port INTEGER NOT NULL DEFAULT 25565,
      version     TEXT DEFAULT 'auto',
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- ─── Bot configs (one per account) ───────────────────────────────
    CREATE TABLE IF NOT EXISTS bot_configs (
      account_id        TEXT PRIMARY KEY,
      anti_afk          INTEGER NOT NULL DEFAULT 1,
      movement_pattern  TEXT NOT NULL DEFAULT 'random',  -- 'random'|'circle'|'jump'|'strafe'
      auto_eat          INTEGER NOT NULL DEFAULT 1,
      auto_respawn      INTEGER NOT NULL DEFAULT 1,
      join_commands     TEXT NOT NULL DEFAULT '[]',      -- JSON array of strings
      reconnect_enabled INTEGER NOT NULL DEFAULT 1,
      reconnect_max     INTEGER NOT NULL DEFAULT 999,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    -- ─── Logs (ring buffer, max 10k rows per bot) ─────────────────────
    CREATE TABLE IF NOT EXISTS logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      type       TEXT NOT NULL DEFAULT 'system',  -- 'system'|'chat'|'error'|'warn'|'info'
      message    TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_logs_account ON logs(account_id, created_at DESC);

    -- ─── Key/value settings ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  logger.info('Database initialised', { path: DB_PATH })
  return db
}

export function getDb() {
  if (!db) throw new Error('Database not initialised — call initDatabase() first')
  return db
}

// ─── Accounts ──────────────────────────────────────────────────────────────

export const accountsDb = {
  getAll() {
    return getDb().prepare(`
      SELECT a.*, bc.anti_afk, bc.movement_pattern, bc.auto_eat, bc.auto_respawn,
             bc.join_commands, bc.reconnect_enabled, bc.reconnect_max
      FROM accounts a
      LEFT JOIN bot_configs bc ON bc.account_id = a.id
      ORDER BY a.created_at ASC
    `).all()
  },

  getById(id) {
    return getDb().prepare(`
      SELECT a.*, bc.anti_afk, bc.movement_pattern, bc.auto_eat, bc.auto_respawn,
             bc.join_commands, bc.reconnect_enabled, bc.reconnect_max
      FROM accounts a
      LEFT JOIN bot_configs bc ON bc.account_id = a.id
      WHERE a.id = ?
    `).get(id)
  },

  create(account) {
    const insert = getDb().prepare(`
      INSERT INTO accounts (id, label, auth_type, username, server_host, server_port, version)
      VALUES (@id, @label, @auth_type, @username, @server_host, @server_port, @version)
    `)
    const insertConfig = getDb().prepare(`
      INSERT INTO bot_configs (account_id, anti_afk, movement_pattern, auto_eat,
                               auto_respawn, join_commands, reconnect_enabled, reconnect_max)
      VALUES (@account_id, @anti_afk, @movement_pattern, @auto_eat,
              @auto_respawn, @join_commands, @reconnect_enabled, @reconnect_max)
    `)

    const run = getDb().transaction((acc) => {
      insert.run(acc)
      insertConfig.run({
        account_id: acc.id,
        anti_afk: acc.anti_afk ?? 1,
        movement_pattern: acc.movement_pattern ?? 'random',
        auto_eat: acc.auto_eat ?? 1,
        auto_respawn: acc.auto_respawn ?? 1,
        join_commands: acc.join_commands ?? '[]',
        reconnect_enabled: acc.reconnect_enabled ?? 1,
        reconnect_max: acc.reconnect_max ?? 999,
      })
    })

    run(account)
    return this.getById(account.id)
  },

  update(id, fields) {
    const allowedAccount = ['label', 'auth_type', 'username', 'server_host', 'server_port', 'version', 'enabled']
    const allowedConfig  = ['anti_afk', 'movement_pattern', 'auto_eat', 'auto_respawn', 'join_commands', 'reconnect_enabled', 'reconnect_max']

    const accFields  = {}
    const cfgFields  = {}

    for (const [k, v] of Object.entries(fields)) {
      if (allowedAccount.includes(k)) accFields[k]  = v
      if (allowedConfig.includes(k))  cfgFields[k]  = v
    }

    const run = getDb().transaction(() => {
      if (Object.keys(accFields).length) {
        const sets = Object.keys(accFields).map(k => `${k} = @${k}`).join(', ')
        getDb().prepare(`UPDATE accounts SET ${sets}, updated_at = unixepoch() WHERE id = @id`)
               .run({ ...accFields, id })
      }
      if (Object.keys(cfgFields).length) {
        const sets = Object.keys(cfgFields).map(k => `${k} = @${k}`).join(', ')
        getDb().prepare(`UPDATE bot_configs SET ${sets} WHERE account_id = @id`)
               .run({ ...cfgFields, id })
      }
    })

    run()
    return this.getById(id)
  },

  delete(id) {
    return getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id)
  },
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export const logsDb = {
  insert(accountId, type, message) {
    getDb().prepare(`
      INSERT INTO logs (account_id, type, message) VALUES (?, ?, ?)
    `).run(accountId, type, message)

    // Ring buffer: keep only last 2000 rows per account
    getDb().prepare(`
      DELETE FROM logs WHERE account_id = ? AND id NOT IN (
        SELECT id FROM logs WHERE account_id = ? ORDER BY id DESC LIMIT 2000
      )
    `).run(accountId, accountId)
  },

  get(accountId, limit = 200, type = null) {
    if (type) {
      return getDb().prepare(`
        SELECT * FROM logs WHERE account_id = ? AND type = ?
        ORDER BY id DESC LIMIT ?
      `).all(accountId, type, limit)
    }
    return getDb().prepare(`
      SELECT * FROM logs WHERE account_id = ?
      ORDER BY id DESC LIMIT ?
    `).all(accountId, limit)
  },

  clear(accountId) {
    return getDb().prepare('DELETE FROM logs WHERE account_id = ?').run(accountId)
  },
}

// ─── Settings ─────────────────────────────────────────────────────────────

export const settingsDb = {
  get(key, defaultValue = null) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? JSON.parse(row.value) : defaultValue
  },
  set(key, value) {
    getDb().prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value))
  },
}
