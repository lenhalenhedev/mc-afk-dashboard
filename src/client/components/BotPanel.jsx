/**
 * components/BotPanel.jsx — Main content for selected bot
 */

import { useState } from 'react'
import { Play, Square, RefreshCw, Bot, Terminal, MessageSquare, Settings2 } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { getSocket } from '../lib/socket.js'
import LogViewer from './LogViewer.jsx'
import ChatPanel from './ChatPanel.jsx'
import BotSettings from './BotSettings.jsx'
import BotStats from './BotStats.jsx'

const TABS = [
  { id: 'console', label: 'Console', Icon: Terminal },
  { id: 'chat',    label: 'Chat',    Icon: MessageSquare },
  { id: 'settings',label: 'Settings', Icon: Settings2 },
]

export default function BotPanel() {
  const { bots, selectedBotId, activeTab, setActiveTab, showToast } = useStore()
  const bot = selectedBotId ? bots[selectedBotId] : null
  const [actionLoading, setActionLoading] = useState('')

  const socketAction = (event, data, successMsg) => async () => {
    setActionLoading(event)
    try {
      const socket = getSocket()
      await new Promise((res, rej) =>
        socket.emit(event, data, r => r?.ok ? res() : rej(new Error(r?.error ?? 'Failed')))
      )
      if (successMsg) showToast(successMsg, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setActionLoading('')
    }
  }

  if (!bot) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-8">
        <Bot size={56} className="text-[#21262d] mb-4" />
        <h2 className="text-lg font-semibold text-[#484f58]">No bot selected</h2>
        <p className="text-sm text-[#3d444d] mt-2 max-w-xs">
          Select a bot from the sidebar, or add a new one to get started.
        </p>
      </div>
    )
  }

  const id = bot.id
  const isOnline = bot.status === 'online'

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* ── Top: Stats card ─────────────────────────────────────────── */}
      <BotStats bot={bot} />

      {/* ── Action buttons ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={socketAction('bot:start', { id }, 'Bot started!')}
          disabled={!!actionLoading || isOnline || bot.status === 'connecting'}
          className="btn-primary"
        >
          <Play size={14} />
          Start
        </button>

        <button
          onClick={socketAction('bot:stop', { id }, 'Bot stopped')}
          disabled={!!actionLoading || bot.status === 'idle'}
          className="btn-danger"
        >
          <Square size={14} />
          Stop
        </button>

        <button
          onClick={socketAction('bot:restart', { id }, 'Bot restarting…')}
          disabled={!!actionLoading}
          className="btn-yellow"
        >
          <RefreshCw size={14} className={actionLoading === 'bot:restart' ? 'animate-spin' : ''} />
          Restart
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-border bg-bg-900 flex-shrink-0">
          {TABS.map(({ id: tabId, label, Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
                border-b-2 -mb-px
                ${activeTab === tabId
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-[#8b949e] hover:text-white'
                }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'console'  && <LogViewer  botId={id} />}
          {activeTab === 'chat'     && <ChatPanel   botId={id} bot={bot} />}
          {activeTab === 'settings' && <BotSettings botId={id} bot={bot} />}
        </div>
      </div>
    </div>
  )
}
