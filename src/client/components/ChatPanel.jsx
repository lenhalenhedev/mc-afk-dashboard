/**
 * components/ChatPanel.jsx — Real-time server chat relay + send
 */

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { getSocket } from '../lib/socket.js'

export default function ChatPanel({ botId, bot }) {
  const { chatLogs, showToast } = useStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  const logs = chatLogs[botId] ?? []

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const handleSend = async (e) => {
    e.preventDefault()
    const msg = message.trim()
    if (!msg) return
    setSending(true)
    try {
      const socket = getSocket()
      await new Promise((res, rej) =>
        socket.emit('bot:sendChat', { id: botId, message: msg },
          r => r?.ok ? res() : rej(new Error(r?.error ?? 'Failed'))
        )
      )
      setMessage('')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const isOnline = bot?.status === 'online'

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-sm"
        style={{ background: 'var(--bg-950)' }}
      >
        {logs.length === 0 ? (
          <div className="text-center text-[#3d444d] mt-8 text-xs">
            No chat messages yet.
            {!isOnline && (
              <p className="mt-1 text-[#484f58]">Bot must be online to relay chat.</p>
            )}
          </div>
        ) : (
          logs.map((msg, i) => {
            const ts = new Date(msg.ts).toLocaleTimeString()
            return (
              <div key={i} className="flex gap-2 leading-relaxed">
                <span className="text-[#3d444d] flex-shrink-0 text-xs">{ts}</span>
                <span className="text-accent-blue break-words flex-1">{msg.message}</span>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-2 border-t border-border bg-bg-900 flex gap-2">
        <input
          className="input flex-1 font-mono text-sm"
          placeholder={isOnline ? 'Type a message… (/ for commands)' : 'Bot must be online to chat'}
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={!isOnline || sending}
          maxLength={256}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!isOnline || sending || !message.trim()}
          className="btn-primary flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </form>

      {/* Char count */}
      <div className="px-3 py-1 border-t border-border bg-bg-900 text-xs text-[#484f58] text-right flex-shrink-0">
        {message.length}/256
      </div>
    </div>
  )
}
