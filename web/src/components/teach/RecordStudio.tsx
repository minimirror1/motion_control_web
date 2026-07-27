import { useState } from 'react'
import {
  startRecording,
  stopRecording,
  torqueOff,
  torqueOn,
} from '../../lib/teachServices'
import { jointLimits } from '../../lib/jointLimits'
import { autoMotionFileName, sanitizeMotionFileName } from '../../lib/motionFileName'
import { isReadyToRecord, readinessChecks } from '../../lib/teachReadiness'
import { useConnectionStore } from '../../store/connectionStore'
import { JointLimitStrip } from './JointLimitStrip'
import { LiveWaveform } from './LiveWaveform'
import { ReadinessChecklist } from './ReadinessChecklist'
import type { TeachAction, TeachState } from './teachState'
import { buttonClass, formatCount } from './teachUi'
import { useHotkey } from './useHotkey'
import { useRecordingMonitor } from './useRecordingMonitor'

// motor_status runs at ~1 kHz, so a minute is already a 60k-column CSV.
const LONG_RECORDING_SECONDS = 60

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${(seconds - minutes * 60)
    .toFixed(1)
    .padStart(4, '0')}`
}

interface Props {
  state: TeachState
  dispatch: (action: TeachAction) => void
  run: (action: () => Promise<void>) => Promise<void>
  refreshFiles: () => Promise<void>
  reloadAfterChange: () => Promise<string>
}

export function RecordStudio({
  state,
  dispatch,
  run,
  refreshFiles,
  reloadAfterChange,
}: Props) {
  const connected = useConnectionStore((store) => store.connected)
  const robotState = useConnectionStore((store) => store.robotState)
  const motorStatus = useConnectionStore((store) => store.motorStatus)
  const motorConfig = useConnectionStore((store) => store.motorConfig)
  const recordingStatus = useConnectionStore((store) => store.recordingStatus)
  const [fileName, setFileName] = useState('')
  const { recording, busy } = state
  const { stats, data } = useRecordingMonitor(recording)

  const checks = readinessChecks({ connected, robotState, motorStatus, motorConfig })
  const ready = isReadyToRecord(checks)
  const limits = jointLimits(motorStatus, motorConfig)
  // The node counts what actually lands in the CSV. The local buffer only sees
  // what rosbridge forwards (~100 Hz of a 1 kHz feed) and restarts on reload, so
  // it must not drive the counters - only the waveform.
  const counters =
    recordingStatus?.active === true
      ? { elapsed: recordingStatus.elapsed, samples: recordingStatus.sample_count }
      : { elapsed: stats.elapsed, samples: stats.totalSamples }

  const sanitized = fileName.trim() === '' ? null : sanitizeMotionFileName(fileName)
  const nameRejected = sanitized?.error != null

  const handleTorqueOff = () =>
    run(async () => {
      const response = await torqueOff()
      dispatch({ type: 'feedback', message: response.message })
    })

  const handleTorqueOn = () =>
    run(async () => {
      const response = await torqueOn()
      dispatch({ type: 'feedback', message: response.message })
    })

  const handleStartRecording = () =>
    run(async () => {
      const response = await startRecording(fileName.trim())
      if (!response.success) {
        dispatch({ type: 'feedback', message: response.message })
        return
      }
      dispatch({ type: 'recording_started', file: response.file_name })
      dispatch({ type: 'feedback', message: `녹화 시작: ${response.file_name}` })
    })

  const handleStopRecording = () =>
    run(async () => {
      const response = await stopRecording()
      dispatch({ type: 'recording_stopped' })
      if (!response.success) {
        dispatch({ type: 'feedback', message: response.message })
        return
      }
      const suffix = await reloadAfterChange()
      dispatch({
        type: 'feedback',
        message: `저장됨: ${response.file_name} (${response.duration.toFixed(1)}초)${suffix}`,
      })
      await refreshFiles()
    })

  const canStart = connected && !busy && !recording && ready && !nameRejected

  useHotkey(
    ' ',
    () => {
      if (recording) {
        handleStopRecording()
      } else if (canStart) {
        handleStartRecording()
      }
    },
    connected,
  )

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-slate-200">녹화 스튜디오</h2>
        <span
          data-testid="teach-recording-state"
          className={`rounded px-2 py-1 text-xs font-semibold ${
            recording ? 'bg-red-950 text-red-300' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {recording ? '녹화 중' : '대기'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!connected || busy}
          onClick={handleTorqueOff}
          className={buttonClass('bg-amber-600 hover:bg-amber-500')}
        >
          토크 해제
        </button>
        <button
          type="button"
          disabled={!connected || busy}
          onClick={handleTorqueOn}
          className={buttonClass('bg-emerald-600 hover:bg-emerald-500')}
        >
          토크 온
        </button>
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStartRecording}
          className={buttonClass('bg-red-600 hover:bg-red-500')}
        >
          녹화 시작
        </button>
        <button
          type="button"
          disabled={!connected || busy || !recording}
          onClick={handleStopRecording}
          className={buttonClass('bg-blue-600 hover:bg-blue-500')}
        >
          녹화 종료
        </button>
      </div>
      <input
        type="text"
        data-testid="teach-file-input"
        value={fileName}
        disabled={!connected || recording}
        onChange={(event) => setFileName(event.target.value)}
        placeholder="파일 이름 (비우면 자동 생성)"
        className="mt-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
      />
      <p
        data-testid="teach-file-name-preview"
        className={`mt-1 text-xs ${nameRejected ? 'text-red-400' : 'text-slate-500'}`}
      >
        {sanitized
          ? sanitized.error ?? `저장 이름: ${sanitized.name}`
          : `자동 생성: ${autoMotionFileName(new Date())} (중복 시 초 단위 접미사)`}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        단축키: Space 녹화 토글 · Enter 재생 · Esc 정지
      </p>
      <div className="mt-4">
        <h3 className="mb-2 text-xs font-medium text-slate-400">녹화 준비</h3>
        <ReadinessChecklist checks={checks} />
        <JointLimitStrip limits={limits} />
      </div>
      {recording && (
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
          <p
            data-testid="teach-recording-hud"
            className="mb-2 text-xs tabular-nums text-slate-300"
          >
            {formatElapsed(counters.elapsed)} · {formatCount(counters.samples)} 샘플
            {stats.rate !== null && ` · 화면 ${stats.rate.toFixed(0)} Hz`}
          </p>
          <LiveWaveform stats={stats} data={data} />
          {counters.elapsed > LONG_RECORDING_SECONDS && (
            <p
              data-testid="teach-long-recording-warning"
              className="mt-2 text-xs text-amber-400"
            >
              {LONG_RECORDING_SECONDS}초를 넘겼습니다. 1 kHz 샘플링이라 CSV가 매우 커집니다.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
