import type { MotionProgress, StepKind, TimelineStep } from '../../lib/scheduleServices'

const KIND_LABELS: Record<StepKind, string> = {
  motion: '모션',
  rest: '휴게',
  cooling: '냉각',
  closed: '영업 외',
  disabled: '꺼짐',
  error: '오류',
  open: '영업 시작',
  close: '영업 종료',
}

// Accent per kind for the highlighted (current) step.
const KIND_ACCENT: Record<StepKind, { ring: string; dot: string; badge: string; bar: string }> = {
  motion: { ring: 'border-emerald-500 bg-emerald-950/40', dot: 'bg-emerald-400', badge: 'bg-emerald-600', bar: 'bg-emerald-500' },
  rest: { ring: 'border-sky-500 bg-sky-950/40', dot: 'bg-sky-400', badge: 'bg-sky-600', bar: 'bg-sky-500' },
  cooling: { ring: 'border-amber-500 bg-amber-950/40', dot: 'bg-amber-400', badge: 'bg-amber-600', bar: 'bg-amber-500' },
  closed: { ring: 'border-slate-500 bg-slate-800/60', dot: 'bg-slate-400', badge: 'bg-slate-600', bar: 'bg-slate-500' },
  disabled: { ring: 'border-slate-500 bg-slate-800/60', dot: 'bg-slate-400', badge: 'bg-slate-600', bar: 'bg-slate-500' },
  error: { ring: 'border-red-500 bg-red-950/40', dot: 'bg-red-400', badge: 'bg-red-600', bar: 'bg-red-500' },
  open: { ring: 'border-slate-500 bg-slate-800/60', dot: 'bg-slate-400', badge: 'bg-slate-600', bar: 'bg-slate-500' },
  close: { ring: 'border-slate-500 bg-slate-800/60', dot: 'bg-slate-400', badge: 'bg-slate-600', bar: 'bg-slate-500' },
}

/** "HH:MM:SS" for today, "MM-DD HH:MM" for another day (robot-local ISO input). */
export function formatStepTime(iso: string | null | undefined, nowIso: string): string {
  if (!iso) return ''
  return iso.slice(0, 10) === nowIso.slice(0, 10)
    ? iso.slice(11, 19)
    : `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

function seconds(value: number): string {
  return `${value.toFixed(1)}초`
}

export function MotionProgressBar({ motion, showName = true }: { motion: MotionProgress; showName?: boolean }) {
  const percent = Math.round(motion.progress * 100)
  return (
    <div data-testid="schedule-motion-progress">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate text-slate-300">{showName ? motion.name : '진행률'}</span>
        <span className="shrink-0 font-mono text-slate-200">
          {motion.duration_sec > 0
            ? `${seconds(motion.elapsed_sec)} / ${seconds(motion.duration_sec)} · `
            : ''}
          <span className="font-semibold text-emerald-300">{percent}%</span>
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h3>
  )
}

function PastStep({ step, nowIso }: { step: TimelineStep; nowIso: string }) {
  return (
    <li className="flex items-start gap-3 py-1 text-sm text-slate-500" data-testid="timeline-past">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-600" />
      <span className="w-36 shrink-0 font-mono text-xs leading-5">
        {formatStepTime(step.start, nowIso)}
        {step.end ? `–${formatStepTime(step.end, nowIso)}` : ''}
      </span>
      <span className="w-14 shrink-0 text-xs leading-5">{KIND_LABELS[step.kind]}</span>
      <span className="min-w-0 flex-1 truncate">
        {step.label}
        {step.detail && <span className="ml-2 text-xs text-slate-600">{step.detail}</span>}
      </span>
    </li>
  )
}

function CurrentStep({
  step,
  nowIso,
  motion,
  restRemainingSec,
}: {
  step: TimelineStep
  nowIso: string
  motion: MotionProgress | null
  restRemainingSec: number | null
}) {
  const accent = KIND_ACCENT[step.kind]
  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 shadow-lg shadow-black/20 ${accent.ring}`}
      data-testid="timeline-current"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${accent.dot}`} />
          <span className={`relative inline-flex h-3 w-3 rounded-full ${accent.dot}`} />
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold text-white ${accent.badge}`}>
          지금 · {KIND_LABELS[step.kind]}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-50">{step.label}</span>
        <span className="font-mono text-xs text-slate-400">{formatStepTime(step.start, nowIso)} 시작</span>
      </div>
      {step.detail && <p className="mt-1 text-xs text-slate-300">{step.detail}</p>}
      {motion && step.kind === 'motion' && (
        <div className="mt-3">
          <MotionProgressBar motion={motion} showName={false} />
        </div>
      )}
      {restRemainingSec !== null && (step.kind === 'rest' || step.kind === 'cooling') && (
        <p className="mt-2 text-sm text-slate-200" data-testid="timeline-rest-remaining">
          {step.kind === 'cooling' ? '다음 온도 측정까지' : '휴게 종료까지'}{' '}
          <span className="font-mono font-semibold">{Math.ceil(restRemainingSec)}초</span>
        </p>
      )}
    </div>
  )
}

function FutureStep({ step, nowIso, first }: { step: TimelineStep; nowIso: string; first: boolean }) {
  return (
    <li
      className={`flex items-start gap-3 py-1 text-sm ${first ? 'text-slate-300' : 'text-slate-400'}`}
      data-testid="timeline-future"
    >
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-dashed border-slate-400" />
      <span className="w-36 shrink-0 font-mono text-xs leading-5">
        {step.start ? formatStepTime(step.start, nowIso) : first ? '다음' : '이후'}
      </span>
      <span className="w-14 shrink-0 text-xs leading-5">{KIND_LABELS[step.kind]}</span>
      <span className="min-w-0 flex-1 truncate">
        {step.label}
        {step.detail && <span className="ml-2 text-xs text-slate-500">{step.detail}</span>}
      </span>
    </li>
  )
}

export function ScheduleTimeline({
  past,
  current,
  future,
  nowIso,
  motion,
  restRemainingSec,
}: {
  past: TimelineStep[]
  current: TimelineStep | null
  future: TimelineStep[]
  nowIso: string
  motion: MotionProgress | null
  restRemainingSec: number | null
}) {
  return (
    <div className="space-y-3" data-testid="schedule-timeline">
      <div>
        <SectionTitle>지난 단계</SectionTitle>
        {past.length === 0 ? (
          <p className="py-1 text-xs text-slate-600">아직 기록 없음</p>
        ) : (
          <ol>
            {past.map((step, i) => (
              <PastStep key={`${step.start}-${i}`} step={step} nowIso={nowIso} />
            ))}
          </ol>
        )}
      </div>
      <div>
        <SectionTitle>지금</SectionTitle>
        {current ? (
          <CurrentStep step={current} nowIso={nowIso} motion={motion} restRemainingSec={restRemainingSec} />
        ) : (
          <p className="py-1 text-xs text-slate-500">대기 중</p>
        )}
      </div>
      <div>
        <SectionTitle>다음 예정</SectionTitle>
        {future.length === 0 ? (
          <p className="py-1 text-xs text-slate-600">예정 없음 (스케줄 꺼짐)</p>
        ) : (
          <ol>
            {future.map((step, i) => (
              <FutureStep key={`${step.kind}-${i}`} step={step} nowIso={nowIso} first={i === 0} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
