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
    <ul className="mt-3 space-y-1">
      {limits.map(({ controllerIndex, position, percent, status }) => (
        <li
          key={controllerIndex}
          data-testid={`teach-joint-limit-${controllerIndex}`}
          data-status={status}
          className="flex items-center gap-2 text-xs tabular-nums"
        >
          <span className="w-6 shrink-0 text-slate-400">J{controllerIndex}</span>
          <div className="relative h-2 flex-1 rounded bg-slate-950/60">
            {percent !== null && (
              <div
                className={`absolute top-0 h-2 w-1 -translate-x-1/2 rounded ${NEEDLE[status]}`}
                style={{ left: `${percent}%` }}
              />
            )}
          </div>
          <span
            className={`w-16 shrink-0 text-right ${
              status === 'over'
                ? 'text-red-400'
                : status === 'near'
                  ? 'text-amber-400'
                  : 'text-slate-400'
            }`}
          >
            {position.toFixed(3)}
          </span>
        </li>
      ))}
    </ul>
  )
}
