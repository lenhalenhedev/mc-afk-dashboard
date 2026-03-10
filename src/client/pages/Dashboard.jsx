/**
 * pages/Dashboard.jsx — Main dashboard shell (sidebar + main panel)
 */

import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import Sidebar from '../components/Sidebar.jsx'
import BotPanel from '../components/BotPanel.jsx'
import Header from '../components/Header.jsx'

export default function Dashboard() {
  const { setBots, showToast, sidebarOpen } = useStore()

  // Initial load of bots
  useEffect(() => {
    api.getBots()
       .then(setBots)
       .catch(e => showToast('Failed to load bots: ' + e.message, 'error'))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-950 font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-200`}>
        <Header />

        <main className="flex-1 overflow-auto p-4">
          <BotPanel />
        </main>
      </div>
    </div>
  )
}
