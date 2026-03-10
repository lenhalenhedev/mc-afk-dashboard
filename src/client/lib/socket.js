/**
 * lib/socket.js — Socket.IO client singleton
 *
 * Connects once using the JWT from the store.
 * Re-exports the socket so any component can import it directly.
 */

import { io } from 'socket.io-client'

let socket = null

export function getSocket(token) {
  if (socket?.connected) return socket

  const url = import.meta.env.DEV
    ? 'http://localhost:3001'
    : window.location.origin

  socket = io(url, {
    auth: { token },
    reconnectionAttempts: Infinity,
    reconnectionDelay:    2000,
    reconnectionDelayMax: 10_000,
    transports: ['websocket', 'polling'],
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export { socket }
