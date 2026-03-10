/**
 * routes/bots.js — REST endpoints for bot/account management
 */

import { Router } from 'express'
import { botManager } from '../botManager.js'

const router = Router()

// ── List all accounts + live state ─────────────────────────────────────────
router.get('/', (_req, res) => {
  res.json(botManager.getAllSnapshots())
})

// ── Get single bot snapshot ────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    res.json(botManager.getSnapshot(req.params.id))
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
})

// ── Create account ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const account = botManager.addAccount(req.body)
    res.status(201).json(account)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ── Update account ─────────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const account = botManager.updateAccount(req.params.id, req.body)
    res.json(account)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ── Delete account ─────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    botManager.deleteAccount(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
})

// ── Bot control ────────────────────────────────────────────────────────────
router.post('/:id/start', async (req, res) => {
  try {
    await botManager.startBot(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

router.post('/:id/stop', async (req, res) => {
  try {
    await botManager.stopBot(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

router.post('/:id/restart', async (req, res) => {
  try {
    await botManager.restartBot(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// ── Chat send ──────────────────────────────────────────────────────────────
router.post('/:id/chat', (req, res) => {
  const { message } = req.body ?? {}
  if (!message) return res.status(400).json({ error: 'message required' })
  try {
    botManager.sendChat(req.params.id, message)
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// ── Logs ───────────────────────────────────────────────────────────────────
router.get('/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit ?? '200', 10)
  const type  = req.query.type ?? null
  try {
    const logs = botManager.getLogs(req.params.id, limit, type)
    res.json(logs)
  } catch (e) { res.status(400).json({ error: e.message }) }
})

router.delete('/:id/logs', (req, res) => {
  try {
    botManager.clearLogs(req.params.id)
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// ── Start / stop all ──────────────────────────────────────────────────────
router.post('/control/startAll', async (_req, res) => {
  await botManager.startAll()
  res.json({ ok: true })
})

router.post('/control/stopAll', async (_req, res) => {
  await botManager.stopAll()
  res.json({ ok: true })
})

export default router
