import { useEffect } from 'react'
import { MotorCard } from './MotorCard'
import { findMotorConfig } from '../lib/motorConfig'
import { useConnectionStore } from '../store/connectionStore'

export function MotorCardGrid() {
  const connected = useConnectionStore((state) => state.connected)
  const motorStatus = useConnectionStore((state) => state.motorStatus)
  const motorConfig = useConnectionStore((state) => state.motorConfig)
  const fetchMotorConfig = useConnectionStore((state) => state.fetchMotorConfig)

  useEffect(() => {
    if (!connected) {
      return
    }
    fetchMotorConfig()
  }, [connected, fetchMotorConfig])

  return (
    <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-slate-200">모터 상태</h2>
        <button
          type="button"
          disabled={!connected}
          onClick={() => fetchMotorConfig()}
          className="rounded-md bg-slate-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          설정값 새로고침
        </button>
      </div>
      {!connected || !motorStatus || motorStatus.controller_index.length === 0 ? (
        <p className="text-xs text-slate-400">
          {connected ? '모터 상태 대기 중...' : 'ROS 연결 후 표시됩니다.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {motorStatus.controller_index.map((controllerIndex, i) => (
            <MotorCard
              key={controllerIndex}
              controllerIndex={controllerIndex}
              statusword={motorStatus.statusword[i] ?? 0}
              errorcode={motorStatus.errorcode[i] ?? 0}
              position={motorStatus.position[i] ?? 0}
              velocity={motorStatus.velocity[i] ?? 0}
              effort={motorStatus.effort[i] ?? 0}
              config={findMotorConfig(motorConfig, controllerIndex)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
