/**
 * routes/auth.js — Dashboard authentication (simple username/password → JWT)
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = Router()

const DASHBOARD_USER = process.env.DASHBOARD_USERNAME || 'admin'
const DASHBOARD_PASS = process.env.DASHBOARD_PASSWORD || 'changeme123'
const JWT_SECRET     = process.env.JWT_SECRET         || 'fallback-secret-change-me'
const JWT_EXPIRES    = parseInt(process.env.JWT_EXPIRES_IN ?? '86400', 10)

// Pre-hash the env password once at startup for constant-time comparison
const PASS_HASH = bcrypt.hashSync(DASHBOARD_PASS, 10)

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' })
  }

  const usernameOk = username === DASHBOARD_USER
  // Always run bcrypt to prevent timing attacks
  const passwordOk = await bcrypt.compare(password, PASS_HASH)

  if (!usernameOk || !passwordOk) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ sub: username, role: 'admin' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  })

  res.json({
    token,
    expiresIn: JWT_EXPIRES,
    username,
  })
})

router.post('/logout', (_req, res) => {
  // JWTs are stateless; the client just discards the token.
  // If you need server-side revocation, add a Redis blocklist here.
  res.json({ ok: true })
})

// Token verification endpoint
router.get('/me', (req, res) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    res.json({ username: payload.sub, role: payload.role })
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
})

export default router
