import { isMotorEnabled } from '../../lib/motorStatus'
import { robotStateLabel, ROBOT_STATE, selectedRobot } from '../../lib/robotState'
import { CONTROL_COMMAND, useConnectionStore } from '../../store/connectionStore'

const STATE_TONE: Record<number, string> = {
  [ROBOT_STATE.HOMING]: 'bg-amber-950 text-amber-300',
  [ROBOT_STATE.STOPPED]: 'bg-slate-800 text-slate-300',
  [ROBOT_STATE.OPERATING]: 'bg-blue-950 text-blue-300',
  [ROBOT_STATE.INVALID]: 'bg-red-950 text-red-300',
}

function Badge({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}: {value}
    </span>
  )
}

function torqueSummary(
  statusword: number[] | undefined,
): { text: string; tone: string } {
  if (!statusword || statusword.length === 0) {
    return { text: '상태 대기 중', tone: 'bg-slate-800 text-slate-400' }
  }
  const enabled = statusword.filter(isMotorEnabled).length
  if (enabled === 0) {
    return { text: `해제 (${statusword.length}축)`, tone: 'bg-amber-950 text-amber-300' }
  }
  if (enabled === statusword.length) {
    return { text: '전체 인가', tone: 'bg-emerald-950 text-emerald-300' }
  }
  return {
    text: `일부 인가 (${enabled}/${statusword.length})`,
    tone: 'bg-amber-950 text-amber-300',
  }
}

export function SafetyStrip() {
  const connected = useConnectionStore((store) => store.connected)
  const robotState = useConnectionStore((store) => store.robotState)
  const motorStatus = useConnectionStore((store) => store.motorStatus)
  const sendControlCommand = useConnectionStore((store) => store.sendControlCommand)

  const { state } = selectedRobot(robotState)
  const torque = torqueSummary(motorStatus?.statusword)
  const faults = (motorStatus?.errorcode ?? []).filter((code) => code !== 0).length

  return (
    <section
      data-testid="teach-safety-strip"
      // Pinned so 정지 and the torque state stay reachable however far the
      // operator has scrolled down the workspace.
      className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-lg shadow-slate-950/60"
    >
      <Badge
        label="연결"
        value={connected ? '정상' : '끊김'}
        tone={connected ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}
      />
      <Badge
        label="로봇"
        value={robotStateLabel(state)}
        tone={state === null ? 'bg-slate-800 text-slate-400' : STATE_TONE[state] ?? ''}
      />
      <Badge label="토크" value={torque.text} tone={torque.tone} />
      {faults > 0 && (
        <Badge
          label="결함"
          value={`${faults}축`}
          tone="bg-red-950 text-red-300"
        />
      )}
      <button
        type="button"
        data-testid="teach-emergency-stop"
        disabled={!connected}
        onClick={() => sendControlCommand(CONTROL_COMMAND.STOP_MOTION)}
        className="ml-auto rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        ■ 정지
      </button>
    </section>
  )
}
