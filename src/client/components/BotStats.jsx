/**
 * components/BotStats.jsx — Live stats grid for a bot
 */

import { Heart, Zap, MapPin, Wifi, Gamepad2, Package } from 'lucide-react'

const STATUS_COLORS = {
  online:       'text-accent-green border-accent-green/30 bg-accent-green/10',
  connecting:   'text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10',
  reconnecting: 'text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10',
  disconnected: 'text-accent-red border-accent-red/30 bg-accent-red/10',
  error:        'text-accent-red border-accent-red/30 bg-accent-red/10',
  idle:         'text-[#8b949e] border-border bg-bg-700',
}

function StatCard({ icon: Icon, label, value, color = 'text-white', bar = null, barColor = 'bg-accent-green' }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[#8b949e] text-xs">
        <Icon size={11} />
        <span>{label}</span>
      </div>
      <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
      {bar !== null && (
        <div className="h-1 bg-bg-700 rounded-full overflow-hidden mt-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function BotStats({ bot }) {
  const acc    = bot.account ?? {}
  const status = bot.status  ?? 'idle'
  const statusCls = STATUS_COLORS[status] ?? STATUS_COLORS.idle

  const healthPct = ((bot.health ?? 20) / 20) * 100
  const foodPct   = ((bot.food   ?? 20) / 20) * 100
  const healthColor = healthPct > 50 ? 'bg-accent-green' : healthPct > 25 ? 'bg-accent-yellow' : 'bg-accent-red'

  const pos = bot.position ?? { x: 0, y: 0, z: 0 }

  return (
    <div className="space-y-3">
      {/* Title row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">{bot.label}</h2>
          <p className="text-xs text-[#484f58] font-mono">
            {acc.username} @ {acc.server_host}:{acc.server_port}
          </p>
        </div>

        <div className={`ml-auto inline-flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-medium capitalize ${statusCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full bg-current ${['connecting','reconnecting'].includes(status) ? 'animate-pulse' : ''}`} />
          {status}
          {bot.reconnectCount > 0 && ` (${bot.reconnectCount})`}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard
          icon={Heart} label="Health"
          value={`${(bot.health ?? 20).toFixed(1)} / 20`}
          color={healthPct > 50 ? 'text-accent-green' : healthPct > 25 ? 'text-accent-yellow' : 'text-accent-red'}
          bar={healthPct} barColor={healthColor}
        />
        <StatCard
          icon={Zap} label="Hunger"
          value={`${(bot.food ?? 20).toFixed(0)} / 20`}
          color={foodPct > 50 ? 'text-accent-green' : 'text-accent-yellow'}
          bar={foodPct} barColor="bg-accent-yellow"
        />
        <StatCard
          icon={MapPin} label="Position"
          value={`${pos.x} / ${pos.y} / ${pos.z}`}
          color="text-accent-blue"
        />
        <StatCard
          icon={Wifi} label="Ping"
          value={`${bot.ping ?? 0}ms`}
          color={(bot.ping ?? 0) < 100 ? 'text-accent-green' : (bot.ping ?? 0) < 250 ? 'text-accent-yellow' : 'text-accent-red'}
        />
        <StatCard
          icon={Gamepad2} label="Game Mode"
          value={bot.gameMode ?? '—'}
        />
        <StatCard
          icon={Package} label="Held Item"
          value={bot.heldItem ?? 'None'}
        />
      </div>

      {/* Error banner */}
      {bot.lastError && (
        <div className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-md px-3 py-2 font-mono truncate">
          ⚠ {bot.lastError}
        </div>
      )}
    </div>
  )
}
