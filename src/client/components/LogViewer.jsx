/**
 * components/LogViewer.jsx — Console log display with type filters
 */

import { useEffect, useRef, useState } from 'react'
import { Trash2, Download, Pause, Play } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'

const LOG_TYPES = ['all', 'system', 'chat', 'error', 'warn', 'info']

const TYPE_CLASS = {
  error:  'log-error',
  warn:   'log-warn',
  chat:   'log-chat',
  system: 'log-system',
  info:   'log-info',
}

const TYPE_PREFIX = {
  error:  '[ERR] ',
  warn:   '[WRN] ',
  chat:   '[CHT] ',
  system: '[SYS] ',
  info:   '[INF] ',
}

export default function LogViewer({ botId }) {
  const { consoleLogs, setLogs, showToast } = useStore()
  const [filter, setFilter]   = useState('all')
  const [paused, setPaused]   = useState(false)
  const [search, setSearch]   = useState('')
  const scrollRef = useRef(null)
  const pausedRef = useRef(false)

  pausedRef.current = paused

  // Load initial logs from DB
  useEffect(() => {
    api.getLogs(botId, 500)
       .then(logs => setLogs(botId, [...logs].reverse()))
       .catch(() => {})
  }, [botId])

  // Auto-scroll
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [consoleLogs[botId], paused])

  const rawLogs = consoleLogs[botId] ?? []
  const filtered = rawLogs.filter(log => {
    const typeOk   = filter === 'all' || log.type === filter
    const searchOk = !search || log.message?.toLowerCase().includes(search.toLowerCase())
    return typeOk && searchOk
  })

  const handleClear = async () => {
    try {
      await api.clearLogs(botId)
      setLogs(botId, [])
      showToast('Logs cleared', 'info')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleExport = () => {
    const text = rawLogs.map(l => {
      const d = new Date(l.created_at * 1000 || l.ts || Date.now()).toISOString()
      return `[${d}] [${l.type?.toUpperCase() ?? 'LOG'}] ${l.message}`
    }).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `bot-${botId.slice(0,8)}-logs.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-border bg-bg-900 flex-shrink-0">
        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {LOG_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-2 py-1 rounded capitalize transition-colors
                ${filter === t
                  ? 'bg-bg-700 text-white border border-border-light'
                  : 'text-[#484f58] hover:text-[#8b949e]'
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[120px]">
          <input
            className="input text-xs py-1 h-7"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setPaused(p => !p)}
            className={`btn-secondary text-xs py-1 px-2 ${paused ? 'text-accent-yellow' : ''}`}
            title={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button onClick={handleExport} className="btn-secondary text-xs py-1 px-2" title="Export logs">
            <Download size={12} />
          </button>
          <button onClick={handleClear} className="btn-danger text-xs py-1 px-2" title="Clear logs">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed space-y-0.5"
        style={{ background: 'var(--bg-950)' }}
      >
        {filtered.length === 0 ? (
          <div className="text-[#3d444d] text-center mt-8">No logs yet…</div>
        ) : (
          filtered.map((log, i) => {
            const ts  = log.created_at
              ? new Date(log.created_at * 1000).toLocaleTimeString()
              : log.ts
              ? new Date(log.ts).toLocaleTimeString()
              : '??:??:??'
            const cls = TYPE_CLASS[log.type] ?? 'log-system'
            const pfx = TYPE_PREFIX[log.type] ?? ''

            return (
              <div key={i} className={`flex gap-2 ${cls}`}>
                <span className="text-[#3d444d] flex-shrink-0">{ts}</span>
                <span className="flex-shrink-0 opacity-60">{pfx}</span>
                <span className="break-all">{log.message}</span>
              </div>
            )
          })
        )}
        {/* Blinking cursor at bottom */}
        {!paused && <div className="text-accent-green mt-1 mc-cursor" />}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-border bg-bg-900 text-xs text-[#484f58] flex justify-between flex-shrink-0">
        <span>{filtered.length} entries{search ? ' (filtered)' : ''}</span>
        {paused && <span className="text-accent-yellow animate-pulse">⏸ Paused</span>}
      </div>
    </div>
  )
}
