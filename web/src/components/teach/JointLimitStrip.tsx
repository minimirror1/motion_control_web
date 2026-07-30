import type { JointLimit, LimitStatus } from '../../lib/jointLimits'

const NEEDLE: Record<LimitStatus, string> = {
  unknown: 'bg-slate-600',
  ok: 'bg-sky-400',
  near: 'bg-amber-400',
  over: 'bg-red-500',
}

export function JointLimitStrip({ limits }: { limits: JointLimit[] }) {
  if (limits.length === 0) {
    return null
  }

  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-end gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-1 rounded bg-sky-400 ring-1 ring-slate-100" />현재 위치
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-1 rounded bg-violet-400" />모터 명령
        </span>
      </div>
      <ul className="space-y-1">
        {limits.map(
          ({
            controllerIndex,
            position,
            commandedPosition,
            percent,
            commandedPercent,
            status,
          }) => (
        <li
          key={controllerIndex}
          data-testid={`teach-joint-limit-${controllerIndex}`}
          data-status={status}
          className="flex items-center gap-2 text-xs tabular-nums"
        >
          <span className="w-6 shrink-0 text-slate-400">J{controllerIndex}</span>
          <div className="relative h-2 flex-1 rounded bg-slate-950/60">
            {commandedPercent !== null && (
              <div
                data-testid={`teach-joint-command-marker-${controllerIndex}`}
                aria-label={`J${controllerIndex} 모터 명령 위치`}
                className="pointer-events-none absolute top-0 z-0 h-2 w-1 -translate-x-1/2 rounded bg-violet-400"
                style={{ left: `${commandedPercent}%` }}
              />
            )}
            {percent !== null && (
              <div
                data-testid={`teach-joint-current-marker-${controllerIndex}`}
                aria-label={`J${controllerIndex} 현재 위치`}
                // The feedback marker stays above the sent target when both
                // occupy the same part of the travel bar.
                className={`pointer-events-none absolute top-0 z-10 h-2 w-1 -translate-x-1/2 rounded ring-1 ring-slate-100 ${NEEDLE[status]}`}
                style={{ left: `${percent}%` }}
              />
            )}
          </div>
          <div className="flex w-36 shrink-0 items-center justify-end text-right">
            <span
              data-testid={`teach-joint-current-value-${controllerIndex}`}
              className={`min-w-0 ${
              status === 'over'
                ? 'text-red-400'
                : status === 'near'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {position.toFixed(3)}°
            </span>
            <span aria-hidden="true" className="mx-2 h-3 border-l border-slate-700" />
            <span
              data-testid={`teach-joint-command-value-${controllerIndex}`}
              className="min-w-0 text-violet-300"
            >
              {commandedPosition === null ? '—' : `${commandedPosition.toFixed(3)}°`}
            </span>
          </div>
        </li>
          ),
        )}
      </ul>
    </div>
  )
}
