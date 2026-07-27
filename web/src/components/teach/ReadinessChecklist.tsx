import type { CheckLevel, ReadinessCheck } from '../../lib/teachReadiness'

const TONE: Record<CheckLevel, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-red-400',
}

export function ReadinessChecklist({ checks }: { checks: ReadinessCheck[] }) {
  return (
    <ul data-testid="teach-readiness" className="space-y-1.5">
      {checks.map(({ id, label, level, detail }) => (
        <li
          key={id}
          data-testid={`teach-readiness-${id}`}
          data-level={level}
          className="flex items-baseline justify-between gap-2 text-xs"
        >
          <span className="shrink-0 text-slate-500">{label}</span>
          {/* Details run long enough to wrap a 17rem column, so the full text
              stays reachable as a tooltip. */}
          <span title={detail} className={`min-w-0 truncate text-right ${TONE[level]}`}>
            {detail}
          </span>
        </li>
      ))}
    </ul>
  )
}
