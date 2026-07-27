import { useEffect } from 'react'
import { useConnectionStore } from '../store/connectionStore'

export function ConnectionStatus() {
  const connected = useConnectionStore((s) => s.connected)
  const connect = useConnectionStore((s) => s.connect)
  const statusLabel = connected ? 'ROS 연결됨' : 'ROS 연결 끊김'

  useEffect(() => {
    connect()
  }, [connect])

  return (
    <div
      role="status"
      aria-label={statusLabel}
      title={statusLabel}
      data-testid="connection-status"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        connected
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-red-500/40 bg-red-500/10'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${
          connected ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />
      <span className="sr-only">{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  )
}
