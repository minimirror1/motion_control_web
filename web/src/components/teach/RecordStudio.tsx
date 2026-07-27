import { useState } from 'react'
import { startRecording, stopRecording } from '../../lib/teachServices'
import { autoMotionFileName, sanitizeMotionFileName } from '../../lib/motionFileName'
import { useConnectionStore } from '../../store/connectionStore'
import { LiveWaveform } from './LiveWaveform'
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
  ready: boolean
  dispatch: (action: TeachAction) => void
  run: (action: () => Promise<void>) => Promise<void>
  refreshFiles: () => Promise<void>
  reloadAfterChange: () => Promise<string>
}

export function RecordStudio({
  state,
  ready,
  dispatch,
  run,
  refreshFiles,
  reloadAfterChange,
}: Props) {
  const connected = useConnectionStore((store) => store.connected)
  const recordingStatus = useConnectionStore((store) => store.recordingStatus)
  const [fileName, setFileName] = useState('')
  const { recording, busy } = state
  const { stats, data } = useRecordingMonitor(recording)

  // The node counts what actually lands in the CSV. The local buffer only sees
  // what rosbridge forwards (~100 Hz of a 1 kHz feed) and restarts on reload, so
  // it must not drive the counters - only the waveform.
  const counters =
    recordingStatus?.active === true
      ? { elapsed: recordingStatus.elapsed, samples: recordingStatus.sample_count }
      : { elapsed: stats.elapsed, samples: stats.totalSamples }

  const sanitized = fileName.trim() === '' ? null : sanitizeMotionFileName(fileName)
  const nameRejected = sanitized?.error != null

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
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">② 녹화</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Space 녹화 토글 · Enter 재생 · Esc 정지 · 종료하면 아래 ③에 바로 나타납니다
          </p>
        </div>
        <span
          data-testid="teach-recording-state"
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            recording ? 'bg-red-950 text-red-300' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {recording ? '녹화 중' : '대기'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
          className={buttonClass('bg-slate-600 hover:bg-slate-500')}
        >
          녹화 종료
        </button>
        <input
          type="text"
          data-testid="teach-file-input"
          value={fileName}
          disabled={!connected || recording}
          onChange={(event) => setFileName(event.target.value)}
          placeholder="파일 이름 (비우면 자동 생성)"
          className="min-w-[14rem] flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
        />
      </div>
      <p
        data-testid="teach-file-name-preview"
        className={`mt-2 text-xs ${nameRejected ? 'text-red-400' : 'text-slate-500'}`}
      >
        {sanitized
          ? sanitized.error ?? `저장 이름: ${sanitized.name}`
          : `자동 생성: ${autoMotionFileName(new Date())} (중복 시 초 단위 접미사)`}
      </p>
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
