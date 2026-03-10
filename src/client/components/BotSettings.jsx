/**
 * components/BotSettings.jsx — Edit bot config in-place
 */

import { useState, useEffect } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'

export default function BotSettings({ botId, bot }) {
  const { showToast } = useStore()
  const acc = bot?.account ?? {}

  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)

  // Initialise form from bot data
  useEffect(() => {
    if (!bot) return
    setForm({
      label:             bot.label ?? '',
      auth_type:         acc.auth_type ?? 'offline',
      username:          acc.username  ?? '',
      server_host:       acc.server_host ?? '',
      server_port:       acc.server_port ?? 25565,
      version:           acc.version ?? 'auto',
      anti_afk:          bot.anti_afk ?? 1,
      movement_pattern:  bot.movement_pattern ?? 'random',
      auto_eat:          bot.auto_eat ?? 1,
      auto_respawn:      bot.auto_respawn ?? 1,
      join_commands:     (() => {
        try { return JSON.parse(bot.join_commands ?? '[]').join('\n') }
        catch { return '' }
      })(),
      reconnect_enabled: bot.reconnect_enabled ?? 1,
      reconnect_max:     bot.reconnect_max ?? 999,
    })
  }, [botId])

  if (!form) return null

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateBot(botId, {
        ...form,
        server_port:  parseInt(form.server_port, 10) || 25565,
        reconnect_max: parseInt(form.reconnect_max, 10) || 999,
        join_commands: JSON.stringify(
          form.join_commands.split('\n').map(s => s.trim()).filter(Boolean)
        ),
      })
      showToast('Settings saved!', 'success')
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <form onSubmit={handleSave} className="space-y-5 max-w-2xl">

        {/* ── Account ──────────────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest mb-3 border-b border-border pb-2">
            Account
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Display Label</label>
              <input className="input" value={form.label}
                onChange={e => set('label', e.target.value)} />
            </div>
            <div>
              <label className="label">Auth Type</label>
              <select className="input" value={form.auth_type}
                onChange={e => set('auth_type', e.target.value)}>
                <option value="offline">Offline / Cracked</option>
                <option value="microsoft">Microsoft Account</option>
              </select>
            </div>
            <div>
              <label className="label">Username / Email</label>
              <input className="input" required value={form.username}
                onChange={e => set('username', e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Server ───────────────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest mb-3 border-b border-border pb-2">
            Server
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Host</label>
              <input className="input" required value={form.server_host}
                onChange={e => set('server_host', e.target.value)} />
            </div>
            <div>
              <label className="label">Port</label>
              <input className="input" type="number" value={form.server_port}
                onChange={e => set('server_port', e.target.value)} />
            </div>
            <div className="col-span-3 sm:col-span-1">
              <label className="label">MC Version (or "auto")</label>
              <input className="input" placeholder="auto" value={form.version}
                onChange={e => set('version', e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Behaviour ────────────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest mb-3 border-b border-border pb-2">
            Behaviour
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label">Anti-AFK</label>
              <select className="input" value={form.anti_afk}
                onChange={e => set('anti_afk', +e.target.value)}>
                <option value={1}>Enabled</option>
                <option value={0}>Disabled</option>
              </select>
            </div>
            <div>
              <label className="label">Movement</label>
              <select className="input" value={form.movement_pattern}
                onChange={e => set('movement_pattern', e.target.value)}>
                <option value="random">Random</option>
                <option value="jump">Jump Only</option>
                <option value="strafe">Strafe</option>
                <option value="circle">Circle</option>
              </select>
            </div>
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
        </section>

        {/* ── Reconnect ─────────────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest mb-3 border-b border-border pb-2">
            Reconnect
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Auto Reconnect</label>
              <select className="input" value={form.reconnect_enabled}
                onChange={e => set('reconnect_enabled', +e.target.value)}>
                <option value={1}>Enabled</option>
                <option value={0}>Disabled</option>
              </select>
            </div>
            <div>
              <label className="label">Max Retries</label>
              <input className="input" type="number" min="1" max="9999"
                value={form.reconnect_max}
                onChange={e => set('reconnect_max', e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Join commands ─────────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-widest mb-3 border-b border-border pb-2">
            Join Commands
          </h3>
          <label className="label">One command per line. Run in order after spawn (2s gap each).</label>
          <textarea
            className="input font-mono text-xs resize-none h-24"
            placeholder="/register mypass mypass&#10;/login mypass"
            value={form.join_commands}
            onChange={e => set('join_commands', e.target.value)}
          />
        </section>

        {/* Save */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
              : <><Save size={14} /> Save Settings</>
            }
          </button>
          <p className="text-xs text-[#484f58] self-center">
            Changes take effect on next (re)connect
          </p>
        </div>
      </form>
    </div>
  )
}
