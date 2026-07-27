import { useEffect, useState } from 'react'
import { robotStateLabel, selectedRobot } from '../../lib/robotState'
import { setMoveDuration } from '../../lib/teachServices'
import {
  CONTROL_COMMAND,
  type ControlCommand,
  useConnectionStore,
} from '../../store/connectionStore'
import { MotionReview, motionSummary } from './MotionReview'
import type { TeachAction, TeachState } from './teachState'
import { buttonClass } from './teachUi'
import { useHotkey } from './useHotkey'
import { useMotionPreview } from './useMotionPreview'

interface Props {
  state: TeachState
  dispatch: (action: TeachAction) => void
  run: (action: () => Promise<void>) => Promise<void>
  reloadAfterChange: () => Promise<string>
}

const SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2]

const TRANSPORT: Array<{
  command: ControlCommand
  label: string
  className: string
  testId: string
}> = [
  {
    command: CONTROL_COMMAND.HOME,
    label: '⌂ 홈 이동',
    className: 'bg-amber-600 hover:bg-amber-500',
    testId: 'teach-transport-home',
  },
  {
    command: CONTROL_COMMAND.PLAY_MOTION,
    label: '▶ 재생',
    className: 'bg-blue-600 hover:bg-blue-500',
    testId: 'teach-transport-play',
  },
  {
    command: CONTROL_COMMAND.STOP_MOTION,
    label: '⏸ 정지',
    className: 'bg-red-600 hover:bg-red-500',
    testId: 'teach-transport-stop',
  },
]

export function PlaybackPanel({ state, dispatch, run, reloadAfterChange }: Props) {
  const connected = useConnectionStore((store) => store.connected)
  const robotState = useConnectionStore((store) => store.robotState)
  const sendControlCommand = useConnectionStore((store) => store.sendControlCommand)

  // Preview whatever the operator picked in the library, falling back to what is
  // actually loaded for playback.
  const previewFile = state.selectedFile ?? state.activeFile
  const preview = useMotionPreview(
    previewFile,
    state.previewVersion,
    state.previewFullResolution ? 0 : undefined,
  )

  // The recorded duration is the 1x reference; the slider scales it.
  const baseDuration = preview.data?.duration ?? 0
  const [speedIndex, setSpeedIndex] = useState(SPEED_STEPS.indexOf(1))
  useEffect(() => setSpeedIndex(SPEED_STEPS.indexOf(1)), [previewFile])

  const { state: robotMode, progress } = selectedRobot(robotState)
  const percent = progress === null ? null : Math.min(100, Math.max(0, progress * 100))

  const send = (command: ControlCommand, label: string) => {
    if (sendControlCommand(command)) {
      dispatch({ type: 'feedback', message: `${label} 명령 전송됨` })
    }
  }

  const transportEnabled = connected && !state.recording
  useHotkey('Enter', () => send(CONTROL_COMMAND.PLAY_MOTION, '▶ 재생'), transportEnabled)
  // Esc stays live during a recording - stopping is never something to gate.
  useHotkey('Escape', () => send(CONTROL_COMMAND.STOP_MOTION, '⏸ 정지'), connected)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-slate-100">③ 확인 · 재생</h2>
          <span
            data-testid="teach-active-file"
            className="truncate text-xs font-semibold text-sky-300"
          >
            {state.activeFile || '없음'}
            {state.selectedFile && state.selectedFile !== state.activeFile && (
              <span className="text-amber-400"> · 미리보기: {state.selectedFile}</span>
            )}
          </span>
          {preview.data && (
            <span data-testid="teach-preview-summary" className="text-xs text-slate-500">
              {motionSummary(preview.data)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">재생은 정지할 때까지 반복됩니다</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TRANSPORT.map(({ command, label, className, testId }) => (
          <button
            key={command}
            type="button"
            data-testid={testId}
            // Playing while a recording is in flight would fight the operator's
            // hands on the arm.
            disabled={!transportEnabled}
            onClick={() => send(command, label)}
            className={buttonClass(className)}
          >
            {label}
          </button>
        ))}
        {baseDuration > 0 && (
          <div className="flex min-w-[18rem] flex-1 items-center gap-2">
            <span className="shrink-0 text-xs text-slate-400">
              속도 {SPEED_STEPS[speedIndex]}x
            </span>
            <input
              type="range"
              data-testid="teach-speed-slider"
              min={0}
              max={SPEED_STEPS.length - 1}
              step={1}
              value={speedIndex}
              disabled={!transportEnabled}
              onChange={(event) => setSpeedIndex(Number(event.target.value))}
              className="min-w-0 flex-1 accent-blue-500 disabled:cursor-not-allowed"
            />
            <span className="shrink-0 text-xs tabular-nums text-slate-400">
              {(baseDuration / SPEED_STEPS[speedIndex]).toFixed(1)}초
            </span>
            <button
              type="button"
              data-testid="teach-speed-apply"
              disabled={!transportEnabled || state.busy}
              onClick={() =>
                run(async () => {
                  const response = await setMoveDuration(
                    baseDuration / SPEED_STEPS[speedIndex],
                  )
                  if (!response.success) {
                    dispatch({ type: 'feedback', message: response.message })
                    return
                  }
                  const suffix = await reloadAfterChange()
                  dispatch({
                    type: 'feedback',
                    message: `재생 속도 ${SPEED_STEPS[speedIndex]}x 적용${suffix}`,
                  })
                })
              }
              className="shrink-0 rounded-md bg-slate-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              속도 적용
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span
          data-testid="teach-robot-state"
          className="shrink-0 text-xs font-semibold text-slate-300"
        >
          {robotStateLabel(robotMode)}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded bg-slate-950/60">
          {percent !== null && (
            <div
              data-testid="teach-progress-bar"
              className="h-2 rounded bg-blue-500 transition-[width]"
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
        <span
          data-testid="teach-progress-value"
          className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400"
        >
          {percent === null ? '—' : `${percent.toFixed(0)}%`}
        </span>
      </div>
      {preview.data ? (
        <MotionReview data={preview.data} />
      ) : (
        <p data-testid="teach-preview-status" className="mt-3 text-xs text-slate-500">
          {!connected
            ? 'ROS 연결 후 궤적을 볼 수 있습니다.'
            : preview.loading
              ? '궤적 불러오는 중…'
              : preview.error ?? '표시할 모션이 없습니다.'}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-600">
        정지는 일시정지이며, 다음 재생은 멈춘 지점부터 이어집니다.
      </p>
    </section>
  )
}
