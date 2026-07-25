import { useEffect } from 'react'
import { useConnectionStore } from '../store/connectionStore'

export function ConnectionStatus() {
  const connected = useConnectionStore((s) => s.connected)
  const robotState = useConnectionStore((s) => s.robotState)
  const connect = useConnectionStore((s) => s.connect)

  useEffect(() => {
    connect()
  }, [connect])

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div
        data-testid="connection-status"
        className={connected ? 'text-green-400' : 'text-red-400'}
      >
        {connected ? 'Connected' : 'Disconnected'}
      </div>
      {robotState && (
        <pre data-testid="robot-state" className="mt-2 text-xs text-slate-400">
          {JSON.stringify(robotState, null, 2)}
        </pre>
      )}
    </div>
  )
}
