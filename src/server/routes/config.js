/**
 * routes/config.js — Export / import dashboard configuration
 */

import { Router } from 'express'
import { botManager } from '../botManager.js'

const router = Router()

// ── Export all accounts as JSON ────────────────────────────────────────────
router.get('/export', (_req, res) => {
  try {
    const config = botManager.exportConfig()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="mcafk-config-${Date.now()}.json"`)
    res.json(config)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Import accounts from JSON ──────────────────────────────────────────────
router.post('/import', (req, res) => {
  try {
    const result = botManager.importConfig(req.body)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

export default router
