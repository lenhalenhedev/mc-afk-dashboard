/**
 * pages/LoginPage.jsx — Dashboard login screen
 */

import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'

export default function LoginPage() {
  const { setAuth } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(username, password)
      setAuth(res.token, res.username)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-950 flex items-center justify-center p-4">
      {/* Background grid decoration */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#58a6ff 1px, transparent 1px), linear-gradient(90deg, #58a6ff 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⛏️</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">MC AFK Dashboard</h1>
          <p className="text-[#8b949e] text-sm mt-1">Sign in to manage your bots</p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-2xl shadow-black/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="admin"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="text-accent-red text-sm bg-accent-red/10 border border-accent-red/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-2.5 text-base font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#484f58] text-xs mt-6">
          Credentials are set in your <code className="text-[#8b949e]">.env</code> file
        </p>
      </div>
    </div>
  )
}
