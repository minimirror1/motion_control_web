import { isMotorEnabled, positionGaugePercent } from '../lib/motorStatus'
import type { MotorConfigEntry } from '../lib/motorConfig'

export interface MotorCardProps {
  controllerIndex: number
  statusword: number
  errorcode: number
  position: number
  velocity: number
  effort: number
  config?: MotorConfigEntry
}

export function MotorCard({
  controllerIndex,
  statusword,
  errorcode,
  position,
  velocity,
  effort,
  config,
}: MotorCardProps) {
  const enabled = isMotorEnabled(statusword)
  const faulted = errorcode !== 0
  const gaugePercent = config
    ? positionGaugePercent(position, config.lower, config.upper)
    : null

  return (
    <div
      data-testid={`motor-card-${controllerIndex}`}
      className={`rounded-lg border p-3 text-xs transition ${
        enabled
          ? 'border-emerald-800 bg-emerald-950'
          : 'border-slate-700 bg-slate-800'
      } ${faulted ? 'ring-2 ring-red-500' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">
          모터 {controllerIndex}
        </span>
        <div className="flex items-center gap-1">
          {faulted && (
            <span
              data-testid={`motor-card-${controllerIndex}-fault`}
              className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
            >
              폴트 {errorcode}
            </span>
          )}
          <span className={enabled ? 'text-emerald-300' : 'text-slate-400'}>
            {enabled ? '활성' : '비활성'}
          </span>
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-[10px] text-slate-400">
          <span>위치 {position.toFixed(1)}</span>
          {config && (
            <span>
              각도 제한 [{config.lower}, {config.upper}]
            </span>
          )}
        </div>
        <div className="relative h-2 rounded bg-slate-950/60">
          {gaugePercent !== null && (
            <div
              data-testid={`motor-card-${controllerIndex}-gauge`}
              className="absolute top-0 h-2 w-1 -translate-x-1/2 rounded bg-sky-400"
              style={{ left: `${gaugePercent}%` }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
        <span>속도: {velocity.toFixed(2)}</span>
        <span>토크: {effort.toFixed(2)}</span>
      </div>

      <div className="mt-2 border-t border-slate-700/60 pt-1 text-[10px] text-slate-500">
        {config
          ? `${config.motorType} · 감속비 ${config.gearRatio} · 정격 토크 ${config.ratedEffort}`
          : '설정값 로딩 중...'}
      </div>
    </div>
  )
}
