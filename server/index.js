/**
 * index.js — MC AFK Dashboard backend entry point
 *
 * Boots: database → logger → Express → Socket.IO → BotManager
 */

import 'dotenv/config'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import { Server as SocketIOServer } from 'socket.io'
import jwt from 'jsonwebtoken'

import { initDatabase } from './database.js'
import { logger } from './logger.js'
import { botManager } from './botManager.js'
import { registerSocketHandlers } from './socketHandlers.js'
import { requireAuth } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import botsRoutes from './routes/bots.js'
import configRoutes from './routes/config.js'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR   = path.resolve(__dirname, '../../dist')
const PORT       = parseInt(process.env.PORT ?? '3001', 10)
const CORS_ORIG  = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const IS_PROD    = process.env.NODE_ENV === 'production'
const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback-secret-change-me'

// ──────────────────────────────────────────────────────────────────────────
//  1. Database
// ──────────────────────────────────────────────────────────────────────────
initDatabase()

// ──────────────────────────────────────────────────────────────────────────
//  2. Express setup
// ──────────────────────────────────────────────────────────────────────────
const app = express()

app.use(helmet({
  contentSecurityPolicy: false, // CSP managed separately if needed
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: IS_PROD ? false : CORS_ORIG,
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Rate-limit auth endpoint
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again in 15 minutes' },
})

// ──────────────────────────────────────────────────────────────────────────
//  3. Routes
// ──────────────────────────────────────────────────────────────────────────
app.use('/api/auth',   authLimiter, authRoutes)
app.use('/api/bots',   requireAuth, botsRoutes)
app.use('/api/config', requireAuth, configRoutes)

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now(), bots: botManager.getAllSnapshots().length })
})

// Serve Vite build in production
if (IS_PROD) {
  const { existsSync } = await import('fs')
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR))
    app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
  } else {
    logger.warn('No dist/ directory found — run `npm run build` first')
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  4. HTTP + Socket.IO
// ──────────────────────────────────────────────────────────────────────────
const httpServer = createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: IS_PROD ? false : CORS_ORIG,
    credentials: true,
  },
  // JWT auth for socket connections
  // The client sends auth.token in handshake
})

// Authenticate every socket connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('SOCKET_NO_TOKEN'))

  try {
    socket.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    next(new Error('SOCKET_INVALID_TOKEN'))
  }
})

registerSocketHandlers(io)

// ──────────────────────────────────────────────────────────────────────────
//  5. BotManager init
// ──────────────────────────────────────────────────────────────────────────
botManager.init()

// ──────────────────────────────────────────────────────────────────────────
//  6. Start listening
// ──────────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`⛏️  MC AFK Dashboard running on http://localhost:${PORT}`)
  logger.info(`   Mode: ${IS_PROD ? 'production' : 'development'}`)
})

// ──────────────────────────────────────────────────────────────────────────
//  7. Graceful shutdown
// ──────────────────────────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal} — shutting down gracefully…`)
  await botManager.shutdown()
  httpServer.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
  // Force-kill after 10s if things hang
  setTimeout(() => process.exit(1), 10_000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack })
})
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) })
})
