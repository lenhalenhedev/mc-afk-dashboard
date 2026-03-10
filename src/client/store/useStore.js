/**
 * store/useStore.js — Zustand global state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Auth ──────────────────────────────────────────────────────────
      token:    null,
      username: null,
      setAuth:  (token, username) => set({ token, username }),
      clearAuth: () => set({ token: null, username: null }),

      // ── Bots ─────────────────────────────────────────────────────────
      /** @type {Record<string, object>} id → snapshot */
      bots: {},

      setBots(snapshots) {
        const bots = {}
        for (const s of snapshots) bots[s.id] = s
        set({ bots })
      },

      upsertBot(snapshot) {
        set(state => ({ bots: { ...state.bots, [snapshot.id]: snapshot } }))
      },

      removeBot(id) {
        set(state => {
          const bots = { ...state.bots }
          delete bots[id]
          return { bots, selectedBotId: state.selectedBotId === id ? null : state.selectedBotId }
        })
      },

      // ── Selected bot ─────────────────────────────────────────────────
      selectedBotId: null,
      selectBot: (id) => set({ selectedBotId: id }),

      selectedBot() {
        return get().bots[get().selectedBotId] ?? null
      },

      // ── Chat log per bot ─────────────────────────────────────────────
      /** @type {Record<string, Array>} */
      chatLogs: {},

      appendChat(botId, entry) {
        set(state => {
          const prev = state.chatLogs[botId] ?? []
          const next = [...prev, entry].slice(-500) // keep last 500
          return { chatLogs: { ...state.chatLogs, [botId]: next } }
        })
      },

      // ── Console logs per bot ─────────────────────────────────────────
      /** @type {Record<string, Array>} */
      consoleLogs: {},

      appendLog(botId, entry) {
        set(state => {
          const prev = state.consoleLogs[botId] ?? []
          const next = [...prev, entry].slice(-1000)
          return { consoleLogs: { ...state.consoleLogs, [botId]: next } }
        })
      },

      setLogs(botId, logs) {
        set(state => ({ consoleLogs: { ...state.consoleLogs, [botId]: logs } }))
      },

      // ── UI state ─────────────────────────────────────────────────────
      activeTab:    'console', // 'console' | 'chat' | 'settings'
      setActiveTab: (tab) => set({ activeTab: tab }),

      sidebarOpen: true,
      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

      // ── Notification toast ───────────────────────────────────────────
      toast: null,
      showToast(message, type = 'info') {
        set({ toast: { message, type, id: Date.now() } })
        setTimeout(() => set(s => (s.toast?.message === message ? { toast: null } : {})), 3500)
      },
    }),
    {
      name:    'mcafk-store',
      partialize: (state) => ({ token: state.token, username: state.username, sidebarOpen: state.sidebarOpen }),
    }
  )
)
