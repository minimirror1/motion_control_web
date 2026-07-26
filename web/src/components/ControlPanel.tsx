import { useState } from 'react'
import {
  CONTROL_COMMAND,
  type ControlCommand,
  type MotorStatus,
  useConnectionStore,
} from '../store/connectionStore'
import { isMotorEnabled } from '../lib/motorStatus'

function motorStateLabel(connected: boolean, motorStatus: MotorStatus | null) {
  if (!connected) {
    return '확인 불가'
  }
  if (!motorStatus || motorStatus.statusword.length === 0) {
    return '상태 대기 중'
  }

  const enabledCount = motorStatus.statusword.filter(isMotorEnabled).length
  if (enabledCount === motorStatus.statusword.length) {
    return '활성'
  }
  if (enabledCount === 0) {
    return '비활성'
  }
  return `일부 활성 (${enabledCount}/${motorStatus.statusword.length})`
}

const controls: Array<{
  command: ControlCommand
  label: string
  className: string
}> = [
  {
    command: CONTROL_COMMAND.ENABLE_MOTORS,
    label: '모터 활성화',
    className: 'bg-emerald-600 hover:bg-emerald-500',
  },
  {
    command: CONTROL_COMMAND.PLAY_MOTION,
    label: '모션 재생',
    className: 'bg-blue-600 hover:bg-blue-500',
  },
  {
    command: CONTROL_COMMAND.STOP_MOTION,
    label: '중지',
    className: 'bg-red-600 hover:bg-red-500',
  },
  {
    command: CONTROL_COMMAND.HOME,
    label: 'Home',
    className: 'bg-amber-600 hover:bg-amber-500',
  },
  {
    command: CONTROL_COMMAND.DISABLE_MOTORS,
    label: '모터 비활성화',
    className: 'bg-slate-600 hover:bg-slate-500',
  },
]

export function ControlPanel() {
  const connected = useConnectionStore((state) => state.connected)
  const sendControlCommand = useConnectionStore(
    (state) => state.sendControlCommand,
  )
  const motorStatus = useConnectionStore((state) => state.motorStatus)
  const [lastCommand, setLastCommand] = useState<string | null>(null)

  const send = (command: ControlCommand, label: string) => {
    if (sendControlCommand(command)) {
      setLastCommand(`${label} 명령 전송됨`)
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-slate-200">로봇 제어</h2>
        <span
          data-testid="motor-power-state"
          className="text-sm font-semibold text-slate-200"
        >
          모터: {motorStateLabel(connected, motorStatus)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {controls.map(({ command, label, className }) => (
          <button
            key={command}
            type="button"
            disabled={!connected}
            onClick={() => send(command, label)}
            className={`rounded-md px-3 py-3 text-sm font-semibold text-white transition ${className} disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400`}
          >
            {label}
          </button>
        ))}
      </div>
      <p
        data-testid="control-feedback"
        className="mt-3 min-h-5 text-xs text-slate-400"
      >
        {connected
          ? lastCommand ?? '명령을 선택하세요.'
          : 'ROS 연결 후 제어할 수 있습니다.'}
      </p>
    </section>
  )
}
