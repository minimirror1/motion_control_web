import { Fragment } from 'react'

export type StepState = 'done' | 'active' | 'todo'

const STEPS = ['① 준비', '② 녹화', '③ 확인 · 재생']

const PILL: Record<StepState, string> = {
  done: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  active: 'border-blue-700 bg-blue-950/60 text-blue-300',
  todo: 'border-slate-800 bg-slate-900 text-slate-500',
}

const MARKER: Record<StepState, string> = {
  done: 'bg-emerald-600 text-white',
  active: 'bg-blue-600 text-white',
  todo: 'bg-slate-700 text-slate-400',
}

/** Where the operator is in the 준비 → 녹화 → 확인·재생 loop. */
export function stepStates(
  ready: boolean,
  recording: boolean,
  hasMotion: boolean,
): StepState[] {
  if (recording) {
    return ['done', 'active', 'todo']
  }
  if (!ready) {
    return ['active', 'todo', 'todo']
  }
  return hasMotion ? ['done', 'done', 'active'] : ['done', 'active', 'todo']
}

export function WorkflowSteps({ states }: { states: StepState[] }) {
  return (
    <div
      data-testid="teach-workflow-steps"
      className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2"
    >
      {STEPS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className="h-px w-6 shrink-0 bg-slate-700" />}
          <span
            data-testid={`teach-step-${i + 1}`}
            data-state={states[i]}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${PILL[states[i]]}`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${MARKER[states[i]]}`}
            >
              {states[i] === 'done' ? '✓' : i + 1}
            </span>
            {label}
          </span>
        </Fragment>
      ))}
      <p className="ml-auto text-xs text-slate-500">
        조이스틱 조작이 여기서 설정한 토크 상태를 덮어쓸 수 있습니다.
      </p>
    </div>
  )
}
