/**
 * components/Sidebar.jsx — Account list + status badges + add account
 */

import { useState } from 'react'
import { Plus, Bot, Trash2, X, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'

// ── Status badge config ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  online:       { color: 'bg-accent-green', pulse: true,  label: 'Online' },
  connecting:   { color: 'bg-accent-yellow', pulse: true, label: 'Connecting' },
  reconnecting: { color: 'bg-accent-yellow', pulse: true, label: 'Reconnecting' },
  disconnected: { color: 'bg-accent-red', pulse: false,   label: 'Disconnected' },
  error:        { color: 'bg-accent-red', pulse: false,   label: 'Error' },
  idle:         { color: 'bg-[#484f58]', pulse: false,    label: 'Idle' },
}

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
  return (
    <span
      className={`status-dot ${cfg.color} ${cfg.pulse ? 'animate-pulse-slow' : ''}`}
      title={cfg.label}
    />
  )
}

// ── Add Bot modal ─────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  label: '', auth_type: 'offline', username: '',
  server_host: 'localhost', server_port: 25565, version: 'auto',
  anti_afk: 1, movement_pattern: 'random',
  auto_eat: 1, auto_respawn: 1,
  join_commands: '', reconnect_enabled: 1, reconnect_max: 999,
}

function AddBotModal({ onClose }) {
  const [form, setForm]     = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const { showToast } = useStore()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        server_port:   parseInt(form.server_port, 10) || 25565,
        join_commands: form.join_commands
          ? JSON.stringify(form.join_commands.split('\n').map(s => s.trim()).filter(Boolean))
          : '[]',
      }
      await api.createBot(payload)
      showToast(`Bot "${form.label || form.username}" added!`, 'success')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-white">Add Bot Account</h2>
          <button onClick={onClose} className="btn-secondary !p-1 !border-transparent">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Label */}
          <div>
            <label className="label">Display Label</label>
            <input className="input" placeholder="My Bot" value={form.label}
              onChange={e => set('label', e.target.value)} />
          </div>

          {/* Auth type */}
          <div>
            <label className="label">Auth Type</label>
            <select className="input" value={form.auth_type} onChange={e => set('auth_type', e.target.value)}>
              <option value="offline">Offline / Cracked</option>
              <option value="microsoft">Microsoft Account</option>
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="label">
              {form.auth_type === 'microsoft' ? 'Microsoft Email / Gamertag' : 'Username'}
            </label>
            <input className="input" required placeholder="Steve"
              value={form.username} onChange={e => set('username', e.target.value)} />
          </div>

          {/* Server */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="label">Server Host</label>
              <input className="input" placeholder="play.server.net" required
                value={form.server_host} onChange={e => set('server_host', e.target.value)} />
            </div>
            <div>
              <label className="label">Port</label>
              <input className="input" type="number" placeholder="25565"
                value={form.server_port} onChange={e => set('server_port', e.target.value)} />
            </div>
          </div>

          {/* Version */}
          <div>
            <label className="label">MC Version</label>
            <input className="input" placeholder="auto (e.g. 1.20.1)"
              value={form.version} onChange={e => set('version', e.target.value)} />
          </div>

          {/* Anti-AFK + movement */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Anti-AFK</label>
              <select className="input" value={form.anti_afk}
                onChange={e => set('anti_afk', +e.target.value)}>
                <option value={1}>Enabled</option>
                <option value={0}>Disabled</option>
              </select>
            </div>
            <div>
              <label className="label">Movement Pattern</label>
              <select className="input" value={form.movement_pattern}
                onChange={e => set('movement_pattern', e.target.value)}>
                <option value="random">Random</option>
                <option value="jump">Jump Only</option>
                <option value="strafe">Strafe</option>
                <option value="circle">Circle</option>
              </select>
            </div>
          </div>

          {/* Auto eat / respawn */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Auto Eat</label>
              <select className="input" value={form.auto_eat}
                onChange={e => set('auto_eat', +e.target.value)}>
                <option value={1}>Enabled</option>
                <option value={0}>Disabled</option>
              </select>
            </div>
            <div>
              <label className="label">Auto Respawn</label>
              <select className="input" value={form.auto_respawn}
                onChange={e => set('auto_respawn', +e.target.value)}>
                <option value={1}>Enabled</option>
                <option value={0}>Disabled</option>
              </select>
            </div>
          </div>

          {/* Join commands */}
          <div>
            <label className="label">Join Commands (one per line)</label>
            <textarea className="input font-mono text-xs resize-none h-16"
              placeholder="/register pass123 pass123&#10;/login pass123"
              value={form.join_commands}
              onChange={e => set('join_commands', e.target.value)} />
          </div>

          {error && (
            <div className="text-accent-red text-sm bg-accent-red/10 border border-accent-red/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Adding…' : 'Add Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { bots, selectedBotId, selectBot, sidebarOpen, showToast } = useStore()
  const [showAdd, setShowAdd]   = useState(false)
  const [deletingId, setDel]    = useState(null)

  const botList = Object.values(bots)

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this bot account?')) return
    setDel(id)
    try {
      await api.deleteBot(id)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDel(null)
    }
  }

  if (!sidebarOpen) return null

  return (
    <>
      <aside className="w-64 flex-shrink-0 bg-bg-900 border-r border-border flex flex-col h-full">
        {/* Add bot button */}
        <div className="p-3 border-b border-border">
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary w-full justify-center text-sm py-2"
          >
            <Plus size={14} />
            Add Bot Account
          </button>
        </div>

        {/* Bot list */}
        <div className="flex-1 overflow-y-auto py-1">
          {botList.length === 0 ? (
            <div className="p-6 text-center text-[#484f58] text-sm">
              <Bot size={32} className="mx-auto mb-2 opacity-30" />
              <p>No bots yet.</p>
              <p className="text-xs mt-1">Add one to get started.</p>
            </div>
          ) : (
            botList.map(bot => (
              <button
                key={bot.id}
                onClick={() => selectBot(bot.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                  transition-colors group relative
                  ${selectedBotId === bot.id
                    ? 'bg-bg-700 text-white'
                    : 'text-[#8b949e] hover:bg-bg-800 hover:text-white'
                  }`}
              >
                <StatusDot status={bot.status} />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {bot.label || bot.account?.username || 'Unknown'}
                  </div>
                  <div className="text-xs text-[#484f58] truncate">
                    {bot.account?.server_host}:{bot.account?.server_port}
                  </div>
                </div>

                {selectedBotId === bot.id && (
                  <ChevronRight size={12} className="text-[#484f58] flex-shrink-0" />
                )}

                {/* Delete button (hover) */}
                <button
                  onClick={(e) => handleDelete(e, bot.id)}
                  disabled={deletingId === bot.id}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 p-1
                    text-[#484f58] hover:text-accent-red transition-all"
                  title="Delete bot"
                >
                  <Trash2 size={12} />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Footer stats */}
        <div className="p-3 border-t border-border">
          <div className="flex justify-between text-xs text-[#484f58]">
            <span>{botList.filter(b => b.status === 'online').length} online</span>
            <span>{botList.length} total</span>
          </div>
        </div>
      </aside>

      {showAdd && <AddBotModal onClose={() => setShowAdd(false)} />}
    </>
  )
}
