import type { CheckLevel, ReadinessCheck } from '../../lib/teachReadiness'

const MARK: Record<CheckLevel, { glyph: string; className: string }> = {
  ok: { glyph: '●', className: 'text-emerald-400' },
  warn: { glyph: '▲', className: 'text-amber-400' },
  fail: { glyph: '■', className: 'text-red-400' },
}

export function ReadinessChecklist({ checks }: { checks: ReadinessCheck[] }) {
  return (
    <ul data-testid="teach-readiness" className="space-y-1">
      {checks.map(({ id, label, level, detail }) => (
        <li
          key={id}
          data-testid={`teach-readiness-${id}`}
          data-level={level}
          className="flex items-baseline gap-2 text-xs"
        >
          <span className={`shrink-0 ${MARK[level].className}`}>{MARK[level].glyph}</span>
          <span className="shrink-0 text-slate-300">{label}</span>
          <span className="truncate text-slate-500">{detail}</span>
        </li>
      ))}
    </ul>
  )
}
