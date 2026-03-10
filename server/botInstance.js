/**
 * botInstance.js — Manages a single Minecraft bot lifecycle
 *
 * Handles: connect, disconnect, reconnect, anti-AFK, auto-eat,
 * auto-respawn, chat relay, join commands, state broadcast.
 */

import mineflayer from 'mineflayer'
import { pathfinder, Movements } from 'mineflayer-pathfinder'
// mineflayer-auto-eat export name differs across versions — this handles all of them
import * as autoEatPkg from 'mineflayer-auto-eat'
const autoEat = autoEatPkg.plugin ?? autoEatPkg.default ?? autoEatPkg
import { EventEmitter } from 'events'
import { botLogger } from './logger.js'
import { logsDb } from './database.js'

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS = Object.freeze({
  IDLE:         'idle',
  CONNECTING:   'connecting',
  ONLINE:       'online',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  ERROR:        'error',
})

const randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// ─── BotInstance ──────────────────────────────────────────────────────────

export class BotInstance extends EventEmitter {
  constructor(account) {
    super()
    this.account        = account   // DB row (includes config fields)
    this.id             = account.id
    this.label          = account.label
    this.bot            = null
    this.status         = STATUS.IDLE
    this.reconnectCount = 0
    this.reconnectTimer = null
    this.afkTimers      = []   // setTimeout IDs
    this.afkIntervals   = []   // setInterval IDs — need clearInterval, not clearTimeout
    this.pingInterval   = null
    this.log            = botLogger(account.id, account.label)
    this.lastError      = null

    // Runtime state shown on dashboard
    this.state = {
      health:    20,
      food:      20,
      position:  { x: 0, y: 0, z: 0 },
      yaw:       0,
      pitch:     0,
      heldItem:  null,
      ping:      0,
      gameMode:  'unknown',
      dimension: 'overworld',
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Public API
  // ──────────────────────────────────────────────────────────────────────

  async start() {
    if (this.status === STATUS.ONLINE || this.status === STATUS.CONNECTING) {
      this.log.warn('start() called but bot is already connecting/online')
      return
    }
    this.reconnectCount = 0
    await this._connect()
  }

  async stop() {
    this._cancelReconnect()
    this._stopAFK()
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null }
    this.reconnectCount = Infinity // prevent auto-reconnect triggered by the 'end' event

    if (this.bot) {
      this._setStatus(STATUS.IDLE)
      try { this.bot.quit('Manual stop') } catch {}
      this.bot = null
    } else {
      this._setStatus(STATUS.IDLE)
    }
    this._dbLog('system', '🛑 Bot stopped manually')
  }

  async restart() {
    await this.stop()
    await new Promise(r => setTimeout(r, 1500))
    this.reconnectCount = 0
    await this.start()
  }

  sendChat(message) {
    if (!this.bot || this.status !== STATUS.ONLINE) {
      throw new Error('Bot is not online')
    }
    this.bot.chat(message)
  }

  getSnapshot() {
    return {
      id:             this.id,
      label:          this.label,
      status:         this.status,
      reconnectCount: this.reconnectCount,
      lastError:      this.lastError,
      ...this.state,
      account: {
        username:    this.account.username,
        server_host: this.account.server_host,
        server_port: this.account.server_port,
        version:     this.account.version,
        auth_type:   this.account.auth_type,
      },
    }
  }

  updateConfig(newAccount) {
    this.account = { ...this.account, ...newAccount }
    this.label   = this.account.label
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Internal: connection
  // ──────────────────────────────────────────────────────────────────────

  async _connect() {
    this._setStatus(STATUS.CONNECTING)
    this._dbLog('system', `🔌 Connecting to ${this.account.server_host}:${this.account.server_port}`)

    const options = {
      host:       this.account.server_host,
      port:       parseInt(this.account.server_port, 10) || 25565,
      username:   this.account.username,
      auth:       this.account.auth_type === 'microsoft' ? 'microsoft' : 'offline',
      hideErrors: false,
      // keepAlive: true sends keep-alive packets — prevents idle timeout kicks
      keepAlive:  true,
    }

    // Only set version if explicitly specified — let mineflayer auto-detect otherwise
    if (this.account.version && this.account.version !== 'auto') {
      options.version = this.account.version
    }

    try {
      this.bot = mineflayer.createBot(options)
      this._attachEvents()
    } catch (err) {
      this.lastError = err.message
      this._setStatus(STATUS.ERROR)
      this._dbLog('error', `❌ Failed to create bot: ${err.message}`)
      this._scheduleReconnect()
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Internal: event wiring
  // ──────────────────────────────────────────────────────────────────────

  _attachEvents() {
    const bot = this.bot

    // ── Login ─────────────────────────────────────────────────────────
    bot.once('login', () => {
      this._setStatus(STATUS.ONLINE)
      this.reconnectCount = 0
      this.lastError      = null
      this.log.info('Logged in as ' + bot.username)
      this._dbLog('system', `✅ Connected as ${bot.username}`)
    })

    bot.once('spawn', async () => {
      this.log.info('Spawned in world')
      this._dbLog('system', '🌍 Spawned in world')

      // Load pathfinder plugin (safe to call multiple times — mineflayer deduplicates)
      try {
        bot.loadPlugin(pathfinder)
        const defaultMove = new Movements(bot)
        bot.pathfinder.setMovements(defaultMove)
      } catch (e) {
        this.log.warn('pathfinder load skipped: ' + e.message)
      }

      // mineflayer-auto-eat v5 — default export IS the plugin function
      if (this.account.auto_eat) {
        try {
          bot.loadPlugin(autoEat)
          // v5 API: configure via bot.autoEat.options
          bot.autoEat.options = {
            priority:   'foodPoints',
            startAt:    16,
            bannedFood: [],
          }
          bot.autoEat.enable()
          this._dbLog('system', '🍖 Auto-eat enabled')
        } catch (e) {
          this.log.warn('Auto-eat unavailable: ' + e.message)
        }
      }

      // Run join commands (e.g. /register, /login)
      await this._runJoinCommands()

      // Start anti-AFK
      if (this.account.anti_afk) {
        this._startAFK()
      }
    })

    // ── Health/Food ────────────────────────────────────────────────────
    bot.on('health', () => {
      this.state.health = bot.health
      this.state.food   = bot.food
      this._broadcastState()
    })

    // ── Auto-respawn ───────────────────────────────────────────────────
    bot.on('death', () => {
      this._dbLog('warn', '💀 Bot died')
      if (this.account.auto_respawn) {
        setTimeout(() => {
          try { bot.respawn() } catch {}
        }, 1000)
      }
    })

    // ── Position tick (throttled) ──────────────────────────────────────
    let positionTick = 0
    bot.on('move', () => {
      if (++positionTick % 20 !== 0) return // update every ~1 second
      // Guard: entity can be null briefly after respawn
      if (!bot.entity) return
      const pos = bot.entity.position
      this.state.position  = { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) }
      this.state.yaw       = +bot.entity.yaw.toFixed(3)
      this.state.pitch     = +bot.entity.pitch.toFixed(3)
      this.state.heldItem  = bot.heldItem?.name ?? null
      this.state.gameMode  = bot.game?.gameMode ?? 'unknown'
      this.state.dimension = bot.game?.dimension ?? 'overworld'
      this._broadcastState()
    })

    // ── Ping tick (cleared on disconnect) ────────────────────────────
    this.pingInterval = setInterval(() => {
      if (bot && bot.player) {
        this.state.ping = bot.player.ping ?? 0
        this._broadcastState()
      }
    }, 5000)

    // ── Chat relay ────────────────────────────────────────────────────
    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString()
      this._dbLog('chat', text)
      this.emit('chat', { botId: this.id, message: text, ts: Date.now() })
    })

    // ── Kicked ────────────────────────────────────────────────────────
    bot.on('kicked', (reason) => {
      let msg = reason
      try { msg = JSON.parse(reason)?.text ?? reason } catch {}
      this._dbLog('warn', `⚡ Kicked: ${msg}`)
      this.lastError = `Kicked: ${msg}`
      this._setStatus(STATUS.DISCONNECTED)
    })

    // ── Error ─────────────────────────────────────────────────────────
    bot.on('error', (err) => {
      this.lastError = err.message
      this.log.error('Bot error: ' + err.message)
      this._dbLog('error', `❌ ${err.message}`)
      this._setStatus(STATUS.ERROR)
    })

    // ── End (disconnect) ──────────────────────────────────────────────
    bot.on('end', (reason) => {
      this._stopAFK()
      // Clear the ping interval so it doesn't pile up across reconnects
      if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null }
      this.log.warn('Disconnected: ' + (reason || 'unknown'))
      this._dbLog('system', `🔌 Disconnected: ${reason || 'unknown'}`)
      this.bot = null

      if (this.status !== STATUS.IDLE && this.reconnectCount !== Infinity) {
        this._setStatus(STATUS.DISCONNECTED)
        this._scheduleReconnect()
      }
    })

    // ── Custom events forwarded to manager ────────────────────────────
    bot.on('entityHurt', (entity) => {
      if (entity === bot.entity) {
        this._broadcastState()
      }
    })
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Internal: anti-AFK
  // ──────────────────────────────────────────────────────────────────────

  _startAFK() {
    this._stopAFK()
    const pattern = this.account.movement_pattern || 'random'
    this.log.info(`Starting anti-AFK [pattern=${pattern}]`)
    this._dbLog('system', `🕹️ Anti-AFK started [${pattern}]`)

    // Recurring action: random delay between 30–80s
    const scheduleNext = () => {
      const delay = randBetween(30_000, 80_000)
      const timer = setTimeout(() => {
        if (!this.bot || this.status !== STATUS.ONLINE) return
        this._performAFKAction(pattern)
        scheduleNext()
      }, delay)
      this.afkTimers.push(timer)
    }
    scheduleNext()

    // Head rotation: setInterval — must use clearInterval, not clearTimeout!
    const headInterval = setInterval(() => {
      if (!this.bot || this.status !== STATUS.ONLINE) return
      const yaw   = (Math.random() * Math.PI * 2) - Math.PI
      const pitch = (Math.random() * 1.2) - 0.6
      try { this.bot.look(yaw, pitch, false) } catch {}
    }, randBetween(10_000, 30_000))
    this.afkIntervals.push(headInterval)
  }

  _stopAFK() {
    // clearTimeout for setTimeout IDs
    for (const t of this.afkTimers) clearTimeout(t)
    this.afkTimers = []
    // clearInterval for setInterval IDs
    for (const t of this.afkIntervals) clearInterval(t)
    this.afkIntervals = []
  }

  _performAFKAction(pattern) {
    const bot = this.bot
    if (!bot) return

    const actions = {
      jump: () => {
        bot.setControlState('jump', true)
        setTimeout(() => bot.setControlState('jump', false), 300)
      },
      sneak: () => {
        bot.setControlState('sneak', true)
        setTimeout(() => bot.setControlState('sneak', false), randBetween(500, 1500))
      },
      strafe: () => {
        const dir = Math.random() > 0.5 ? 'left' : 'right'
        bot.setControlState(dir, true)
        setTimeout(() => bot.setControlState(dir, false), randBetween(300, 800))
      },
      forward: () => {
        bot.setControlState('forward', true)
        setTimeout(() => bot.setControlState('forward', false), randBetween(200, 600))
      },
      look: () => {
        const yaw   = (Math.random() * Math.PI * 2) - Math.PI
        const pitch = (Math.random() * 1.0) - 0.5
        bot.look(yaw, pitch, true)
      },
    }

    try {
      switch (pattern) {
        case 'jump':   actions.jump();   break
        case 'strafe': actions.strafe(); break
        case 'circle': {
          actions.look()
          actions.forward()
          break
        }
        case 'random':
        default: {
          const pool = ['jump', 'sneak', 'strafe', 'look', 'forward', 'jump']
          const pick = pool[Math.floor(Math.random() * pool.length)]
          actions[pick]?.()
        }
      }
    } catch (e) {
      this.log.debug('AFK action error (harmless): ' + e.message)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Internal: join commands
  // ──────────────────────────────────────────────────────────────────────

  async _runJoinCommands() {
    let commands = []
    try {
      commands = JSON.parse(this.account.join_commands || '[]')
    } catch {
      return
    }
    if (!commands.length) return

    // Stagger commands by 2s each to avoid spam detection
    for (const cmd of commands) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        this.bot?.chat(cmd)
        this._dbLog('system', `📤 Sent join command: ${cmd}`)
      } catch (e) {
        this._dbLog('error', `Failed to send join command "${cmd}": ${e.message}`)
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Internal: reconnect
  // ──────────────────────────────────────────────────────────────────────

  _scheduleReconnect() {
    if (!this.account.reconnect_enabled) return
    const maxRetry = this.account.reconnect_max ?? 999
    if (this.reconnectCount >= maxRetry) {
      this._setStatus(STATUS.ERROR)
      this._dbLog('error', `❌ Max reconnect attempts (${maxRetry}) reached`)
      return
    }

    this._setStatus(STATUS.RECONNECTING)
    const delay = randBetween(3000, 15_000)
    this.reconnectCount++
    this._dbLog('system', `🔄 Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectCount})`)

    this.reconnectTimer = setTimeout(() => this._connect(), delay)
  }

  _cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Internal: helpers
  // ──────────────────────────────────────────────────────────────────────

  _setStatus(status) {
    if (this.status === status) return
    this.status = status
    this.emit('statusChange', { botId: this.id, status })
    this._broadcastState()
  }

  _broadcastState() {
    this.emit('stateUpdate', this.getSnapshot())
  }

  _dbLog(type, message) {
    try {
      logsDb.insert(this.id, type, message)
    } catch { /* DB not critical */ }
    this.emit('log', { botId: this.id, type, message, ts: Date.now() })
  }
}

export { STATUS }
