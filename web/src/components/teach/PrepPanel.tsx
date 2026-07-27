import { jointLimits } from '../../lib/jointLimits'
import { isMotorEnabled } from '../../lib/motorStatus'
import type { ReadinessCheck } from '../../lib/teachReadiness'
import { torqueOff, torqueOn } from '../../lib/teachServices'
import { useConnectionStore } from '../../store/connectionStore'
import { JointLimitStrip } from './JointLimitStrip'
import { ReadinessChecklist } from './ReadinessChecklist'
import type { TeachAction } from './teachState'
import { buttonClass } from './teachUi'

interface Props {
  checks: ReadinessCheck[]
  busy: boolean
  dispatch: (action: TeachAction) => void
  run: (action: () => Promise<void>) => Promise<void>
}

function banner(checks: ReadinessCheck[]) {
  const blocking = checks.filter((check) => check.level === 'fail')
  if (blocking.length > 0) {
    return {
      tone: 'border-red-900 bg-red-950/40 text-red-300',
      glyph: '■',
      text: `녹화 불가: ${blocking.map((check) => check.label).join(', ')}`,
    }
  }
  const warnings = checks.filter((check) => check.level === 'warn')
  if (warnings.length > 0) {
    return {
      tone: 'border-amber-900 bg-amber-950/40 text-amber-300',
      glyph: '▲',
      text: `확인 필요: ${warnings.map((check) => check.label).join(', ')}`,
    }
  }
  return {
    tone: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
    glyph: '✓',
    text: '녹화 준비 완료',
  }
}

export function PrepPanel({ checks, busy, dispatch, run }: Props) {
  const connected = useConnectionStore((store) => store.connected)
  const motorStatus = useConnectionStore((store) => store.motorStatus)
  const motorConfig = useConnectionStore((store) => store.motorConfig)

  const limits = jointLimits(motorStatus, motorConfig)
  const { tone, glyph, text } = banner(checks)

  // Mirrors SafetyStrip's torqueSummary: any enabled motor counts as "on", so
  // the button always offers the opposite of what is currently true.
  const statusword = motorStatus?.statusword
  const torqueOn_ = Boolean(statusword?.some(isMotorEnabled))

  const handleToggleTorque = () =>
    run(async () => {
      const response = torqueOn_ ? await torqueOff() : await torqueOn()
      dispatch({ type: 'feedback', message: response.message })
    })

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      {/* The column is 17rem wide at xl; the cap keeps the label/value rows from
          spreading across the page once the grid stacks. */}
      <div className="max-w-sm xl:max-w-none">
        <h2 className="text-sm font-semibold text-slate-100">① 준비</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          토크를 해제하면 손으로 자세를 잡을 수 있습니다
        </p>
        <div className="mt-3">
          <button
            type="button"
            data-testid="teach-torque-toggle"
            disabled={!connected || busy}
            onClick={handleToggleTorque}
            className={buttonClass(
              `w-full ${
                torqueOn_
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`,
            )}
          >
            {torqueOn_ ? '토크 해제' : '토크 온'}
          </button>
        </div>
        <p
          data-testid="teach-readiness-banner"
          className={`mt-3 rounded-md border px-3 py-2 text-xs font-semibold ${tone}`}
        >
          {glyph} {text}
        </p>
        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          로봇 상태
        </h3>
        <ReadinessChecklist checks={checks} />
        {limits.length > 0 && (
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            조인트 실시간
          </h3>
        )}
        <JointLimitStrip limits={limits} />
      </div>
    </section>
  )
}
