/**
 * App.jsx — Root component
 * Handles: auth gate, socket init, real-time event wiring
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { getSocket, disconnectSocket } from './lib/socket.js'
import LoginPage from './pages/LoginPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Toast from './components/Toast.jsx'

export default function App() {
  const { token, setBots, upsertBot, removeBot, appendChat, appendLog, showToast } = useStore()

  // ── Socket init when authenticated ──────────────────────────────────
  useEffect(() => {
    if (!token) {
      disconnectSocket()
      return
    }

    const socket = getSocket(token)

    socket.on('connect', () => {
      console.info('[socket] connected')
    })

    socket.on('connect_error', (err) => {
      if (err.message === 'SOCKET_INVALID_TOKEN' || err.message === 'SOCKET_NO_TOKEN') {
        useStore.getState().clearAuth()
      }
    })

    // Full snapshot on connect / refresh
    socket.on('bots:snapshot', (snapshots) => {
      setBots(snapshots)
    })

    // Individual state updates
    socket.on('bot:stateUpdate',  (snap) => upsertBot(snap))
    socket.on('bot:statusChange', (ev) => {
      const bots = useStore.getState().bots
      if (bots[ev.botId]) {
        upsertBot({ ...bots[ev.botId], status: ev.status })
      }
    })

    // Chat relay
    socket.on('bot:chat', (ev) => {
      appendChat(ev.botId, ev)
      appendLog(ev.botId, { ...ev, type: 'chat' })
    })

    // Console log
    socket.on('bot:log', (ev) => {
      appendLog(ev.botId, ev)
    })

    // Account CRUD events
    socket.on('account:added', (acc) => {
      upsertBot({ ...acc, status: 'idle' })
      showToast(`Account "${acc.label}" added`, 'success')
    })
    socket.on('account:updated', (acc) => {
      const bots = useStore.getState().bots
      upsertBot({ ...bots[acc.id], ...acc })
    })
    socket.on('account:deleted', ({ id }) => {
      removeBot(id)
      showToast('Account removed', 'info')
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('bots:snapshot')
      socket.off('bot:stateUpdate')
      socket.off('bot:statusChange')
      socket.off('bot:chat')
      socket.off('bot:log')
      socket.off('account:added')
      socket.off('account:updated')
      socket.off('account:deleted')
    }
  }, [token]) // re-wire when token changes

  return (
    <>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/*"     element={token ? <Dashboard /> : <Navigate to="/login" replace />} />
      </Routes>
      <Toast />
    </>
  )
}
