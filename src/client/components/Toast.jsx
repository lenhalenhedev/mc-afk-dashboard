/**
 * components/Toast.jsx — Global notification toast
 */

import { useStore } from '../store/useStore.js'
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'

const CONFIG = {
  success: { Icon: CheckCircle, cls: 'border-accent-green/40 bg-accent-green/10 text-accent-green' },
  error:   { Icon: XCircle,     cls: 'border-accent-red/40 bg-accent-red/10 text-accent-red' },
  warn:    { Icon: AlertTriangle,cls: 'border-accent-yellow/40 bg-accent-yellow/10 text-accent-yellow' },
  info:    { Icon: Info,         cls: 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue' },
}

export default function Toast() {
  const { toast } = useStore()
  if (!toast) return null

  const { Icon, cls } = CONFIG[toast.type] ?? CONFIG.info

  return (
    <div
      key={toast.id}
      className={`fixed bottom-4 right-4 z-[100] flex items-center gap-3
        border rounded-lg px-4 py-3 shadow-2xl text-sm font-medium
        animate-slide-in max-w-sm ${cls}`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span>{toast.message}</span>
    </div>
  )
}
