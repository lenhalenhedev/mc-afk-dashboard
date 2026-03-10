/**
 * socketHandlers.js — Socket.IO event routing
 *
 * Client events  (client → server): bot:start, bot:stop, bot:restart,
 *   bot:chat, bot:getLogs, bots:startAll, bots:stopAll
 *
 * Server events  (server → client): bot:stateUpdate, bot:statusChange,
 *   bot:chat, bot:log, bots:list
 */

import { botManager } from './botManager.js'
import { logger } from './logger.js'

export function registerSocketHandlers(io) {

  // Relay botManager events to ALL connected sockets
  botManager.on('stateUpdate', (snap) => io.emit('bot:stateUpdate', snap))
  botManager.on('statusChange', (ev)  => io.emit('bot:statusChange', ev))
  botManager.on('chat',  (ev) => io.emit('bot:chat',  ev))
  botManager.on('log',   (ev) => io.emit('bot:log',   ev))
  botManager.on('accountAdded',   (acc) => io.emit('account:added',   acc))
  botManager.on('accountUpdated', (acc) => io.emit('account:updated', acc))
  botManager.on('accountDeleted', (ev)  => io.emit('account:deleted', ev))

  io.on('connection', (socket) => {
    logger.info('Dashboard client connected', { id: socket.id })

    // Send full state snapshot on connect
    socket.emit('bots:snapshot', botManager.getAllSnapshots())

    // ── Bot control ──────────────────────────────────────────────────

    socket.on('bot:start', async ({ id }, cb) => {
      try {
        await botManager.startBot(id)
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    socket.on('bot:stop', async ({ id }, cb) => {
      try {
        await botManager.stopBot(id)
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    socket.on('bot:restart', async ({ id }, cb) => {
      try {
        await botManager.restartBot(id)
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    socket.on('bots:startAll', async (_, cb) => {
      try {
        await botManager.startAll()
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    socket.on('bots:stopAll', async (_, cb) => {
      try {
        await botManager.stopAll()
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    // ── Chat ─────────────────────────────────────────────────────────

    socket.on('bot:sendChat', ({ id, message }, cb) => {
      try {
        botManager.sendChat(id, message)
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    // ── Logs ─────────────────────────────────────────────────────────

    socket.on('bot:getLogs', ({ id, limit = 200, type = null }, cb) => {
      try {
        const logs = botManager.getLogs(id, limit, type)
        cb?.({ ok: true, logs })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    socket.on('bot:clearLogs', ({ id }, cb) => {
      try {
        botManager.clearLogs(id)
        cb?.({ ok: true })
      } catch (e) {
        cb?.({ ok: false, error: e.message })
      }
    })

    // ── Snapshot refresh ─────────────────────────────────────────────

    socket.on('bots:getSnapshot', (_, cb) => {
      cb?.({ ok: true, bots: botManager.getAllSnapshots() })
    })

    socket.on('disconnect', () => {
      logger.info('Dashboard client disconnected', { id: socket.id })
    })
  })
}
