/**
 * components/Header.jsx — Top bar with global controls
 */

import { useState } from 'react'
import { Menu, Play, Square, Download, Upload, LogOut } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { getSocket } from '../lib/socket.js'

export default function Header() {
  const { toggleSidebar, username, clearAuth, showToast } = useStore()
  const [loading, setLoading] = useState('')

  const wrap = async (action, key) => {
    setLoading(key)
    try { await action() }
    catch (e) { showToast(e.message, 'error') }
    finally { setLoading('') }
  }

  const handleStartAll = () => wrap(async () => {
    const socket = getSocket()
    await new Promise((res, rej) =>
      socket.emit('bots:startAll', {}, (r) => r?.ok ? res() : rej(new Error(r?.error)))
    )
    showToast('All bots started', 'success')
  }, 'startAll')

  const handleStopAll = () => wrap(async () => {
    const socket = getSocket()
    await new Promise((res, rej) =>
      socket.emit('bots:stopAll', {}, (r) => r?.ok ? res() : rej(new Error(r?.error)))
    )
    showToast('All bots stopped', 'info')
  }, 'stopAll')

  const handleExport = async () => {
    try {
      const config = await api.exportConfig()
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `mcafk-config-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error')
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text   = await file.text()
        const config = JSON.parse(text)
        const result = await api.importConfig(config)
        showToast(`Imported ${result.imported} account(s), skipped ${result.skipped}`, 'success')
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error')
      }
    }
    input.click()
  }

  return (
    <header className="h-12 border-b border-border bg-bg-900 flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={toggleSidebar}
        className="btn-secondary !p-1.5 !border-transparent"
        title="Toggle sidebar"
      >
        <Menu size={16} />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-lg">⛏️</span>
        <span className="text-sm font-semibold text-white hidden sm:block">MC AFK</span>
      </div>

      <div className="flex-1" />

      {/* Global actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleStartAll}
          disabled={loading === 'startAll'}
          className="btn-primary text-xs py-1 px-2.5"
          title="Start all bots"
        >
          <Play size={12} />
          <span className="hidden sm:inline">Start All</span>
        </button>

        <button
          onClick={handleStopAll}
          disabled={loading === 'stopAll'}
          className="btn-danger text-xs py-1 px-2.5"
          title="Stop all bots"
        >
          <Square size={12} />
          <span className="hidden sm:inline">Stop All</span>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={handleExport} className="btn-secondary text-xs py-1 px-2.5" title="Export config">
          <Download size={12} />
          <span className="hidden md:inline">Export</span>
        </button>

        <button onClick={handleImport} className="btn-secondary text-xs py-1 px-2.5" title="Import config">
          <Upload size={12} />
          <span className="hidden md:inline">Import</span>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8b949e] hidden sm:block">{username}</span>
          <button
            onClick={() => clearAuth()}
            className="btn-secondary text-xs py-1 px-2"
            title="Sign out"
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </header>
  )
}
