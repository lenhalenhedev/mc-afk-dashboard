/**
 * lib/api.js — Thin fetch wrapper that injects the JWT
 */

import { useStore } from '../store/useStore.js'

const BASE = '/api'

async function request(method, path, body = null) {
  const token = useStore.getState().token
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),

  // Auth
  login:  (username, password) => request('POST', '/auth/login', { username, password }),
  me:     ()                   => request('GET',  '/auth/me'),

  // Bots
  getBots:       ()     => request('GET',  '/bots'),
  createBot:     (data) => request('POST', '/bots', data),
  updateBot:     (id, data) => request('PATCH', `/bots/${id}`, data),
  deleteBot:     (id)   => request('DELETE', `/bots/${id}`),
  startBot:      (id)   => request('POST', `/bots/${id}/start`),
  stopBot:       (id)   => request('POST', `/bots/${id}/stop`),
  restartBot:    (id)   => request('POST', `/bots/${id}/restart`),
  sendChat:      (id, message) => request('POST', `/bots/${id}/chat`, { message }),
  getLogs:       (id, limit, type) => request('GET', `/bots/${id}/logs?limit=${limit ?? 200}${type ? `&type=${type}` : ''}`),
  clearLogs:     (id)   => request('DELETE', `/bots/${id}/logs`),

  // Config
  exportConfig:  ()     => request('GET',  '/config/export'),
  importConfig:  (data) => request('POST', '/config/import', data),
}
