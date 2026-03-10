/**
 * logger.js — Winston logger with colour console + rotating file output
 */

import winston from 'winston'
import { existsSync, mkdirSync } from 'fs'

const LOG_DIR = process.env.LOG_DIR || './logs'
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

const { combine, timestamp, printf, colorize, errors } = winston.format

// Pretty console format
const consoleFormat = printf(({ level, message, timestamp: ts, accountId, ...meta }) => {
  const prefix = accountId ? `[${accountId.slice(0, 8)}]` : '[SERVER]'
  const extra  = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${ts} ${level} ${prefix} ${message}${extra}`
})

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'HH:mm:ss' }),
  ),
  transports: [
    // Colourful console
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat,
      ),
    }),
    // Rolling file — combined
    new winston.transports.File({
      filename: `${LOG_DIR}/combined.log`,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      format: combine(timestamp(), winston.format.json()),
    }),
    // Error-only file
    new winston.transports.File({
      level: 'error',
      filename: `${LOG_DIR}/error.log`,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      format: combine(timestamp(), winston.format.json()),
    }),
  ],
})

/**
 * Create a child logger scoped to a specific bot account
 */
export function botLogger(accountId, label) {
  return logger.child({ accountId, label })
}
