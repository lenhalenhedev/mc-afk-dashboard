/**
 * botManager.js — Central registry for all BotInstance objects.
 * Bridges DB accounts → live bot instances → Socket.IO events.
 */

import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import { BotInstance } from './botInstance.js'
import { accountsDb, logsDb } from './database.js'
import { logger } from './logger.js'

class BotManager extends EventEmitter {
  constructor() {
    super()
    /** @type {Map<string, BotInstance>} */
    this.instances = new Map()
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Initialisation — load saved accounts from DB
  // ──────────────────────────────────────────────────────────────────────

  init() {
    const accounts = accountsDb.getAll()
    for (const acc of accounts) {
      this._createInstance(acc)
    }
    logger.info(`BotManager initialised with ${accounts.length} account(s)`)
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Account CRUD (persists to DB + updates in-memory instance)
  // ──────────────────────────────────────────────────────────────────────

  addAccount(data) {
    const account = accountsDb.create({
      id:              uuidv4(),
      label:           data.label || data.username,
      auth_type:       data.auth_type || 'offline',
      username:        data.username,
      server_host:     data.server_host || 'localhost',
      server_port:     data.server_port  || 25565,
      version:         data.version      || 'auto',
      anti_afk:        data.anti_afk     ?? 1,
      movement_pattern: data.movement_pattern || 'random',
      auto_eat:        data.auto_eat     ?? 1,
      auto_respawn:    data.auto_respawn ?? 1,
      join_commands:   data.join_commands || '[]',
      reconnect_enabled: data.reconnect_enabled ?? 1,
      reconnect_max:   data.reconnect_max ?? 999,
    })

    this._createInstance(account)
    logger.info('Account created', { id: account.id, label: account.label })
    this.emit('accountAdded', account)
    return account
  }

  updateAccount(id, data) {
    const account = accountsDb.update(id, data)
    if (!account) throw new Error('Account not found')

    const instance = this.instances.get(id)
    if (instance) instance.updateConfig(account)

    logger.info('Account updated', { id })
    this.emit('accountUpdated', account)
    return account
  }

  deleteAccount(id) {
    const instance = this.instances.get(id)
    if (instance) {
      instance.stop().catch(() => {})
      this._detachInstance(instance)
      this.instances.delete(id)
    }

    accountsDb.delete(id)
    logger.info('Account deleted', { id })
    this.emit('accountDeleted', { id })
  }

  getAccount(id) {
    return accountsDb.getById(id)
  }

  getAllAccounts() {
    return accountsDb.getAll()
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Bot control
  // ──────────────────────────────────────────────────────────────────────

  async startBot(id) {
    const instance = this._getInstance(id)
    await instance.start()
  }

  async stopBot(id) {
    const instance = this._getInstance(id)
    await instance.stop()
  }

  async restartBot(id) {
    const instance = this._getInstance(id)
    await instance.restart()
  }

  async startAll() {
    const promises = [...this.instances.values()].map(i => i.start().catch(e => logger.error(e)))
    await Promise.allSettled(promises)
  }

  async stopAll() {
    const promises = [...this.instances.values()].map(i => i.stop().catch(e => logger.error(e)))
    await Promise.allSettled(promises)
  }

  sendChat(id, message) {
    const instance = this._getInstance(id)
    instance.sendChat(message)
  }

  // ──────────────────────────────────────────────────────────────────────
  //  State / snapshot
  // ──────────────────────────────────────────────────────────────────────

  getSnapshot(id) {
    return this._getInstance(id).getSnapshot()
  }

  getAllSnapshots() {
    return [...this.instances.values()].map(i => i.getSnapshot())
  }

  getLogs(id, limit, type) {
    return logsDb.get(id, limit, type)
  }

  clearLogs(id) {
    return logsDb.clear(id)
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Config export / import
  // ──────────────────────────────────────────────────────────────────────

  exportConfig() {
    const accounts = accountsDb.getAll().map(a => ({
      ...a,
      // Never export MS tokens or sensitive data
      ms_token: undefined,
    }))
    return {
      exportedAt: new Date().toISOString(),
      version:    '1.0',
      accounts,
    }
  }

  importConfig(config) {
    if (!config?.accounts?.length) throw new Error('Invalid config: no accounts')
    const added = []
    for (const acc of config.accounts) {
      // Skip duplicates by username+host
      const existing = accountsDb.getAll().find(
        a => a.username === acc.username && a.server_host === acc.server_host
      )
      if (!existing) {
        const created = this.addAccount(acc)
        added.push(created)
      }
    }
    return { imported: added.length, skipped: config.accounts.length - added.length }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Graceful shutdown
  // ──────────────────────────────────────────────────────────────────────

  async shutdown() {
    logger.info('BotManager shutting down — stopping all bots…')
    await this.stopAll()
    logger.info('All bots stopped')
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Private helpers
  // ──────────────────────────────────────────────────────────────────────

  _createInstance(account) {
    const instance = new BotInstance(account)
    this._attachInstance(instance)
    this.instances.set(account.id, instance)
    return instance
  }

  _attachInstance(instance) {
    instance.on('stateUpdate', (snap) => this.emit('stateUpdate', snap))
    instance.on('statusChange', (ev)  => this.emit('statusChange', ev))
    instance.on('chat',  (ev) => this.emit('chat',  ev))
    instance.on('log',   (ev) => this.emit('log',   ev))
  }

  _detachInstance(instance) {
    instance.removeAllListeners()
  }

  _getInstance(id) {
    const inst = this.instances.get(id)
    if (!inst) throw new Error(`Bot instance not found: ${id}`)
    return inst
  }
}

// Singleton
export const botManager = new BotManager()
