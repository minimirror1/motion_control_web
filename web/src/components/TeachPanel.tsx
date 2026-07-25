import { useCallback, useEffect, useState } from 'react'
import {
  listMotionFiles,
  reloadConfig,
  setActiveMotion,
  startRecording,
  stopRecording,
  torqueOff,
  torqueOn,
} from '../lib/teachServices'
import { useConnectionStore } from '../store/connectionStore'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function TeachPanel() {
  const connected = useConnectionStore((state) => state.connected)
  const [fileName, setFileName] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState('')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refreshFiles = useCallback(async () => {
    const response = await listMotionFiles()
    if (response.success) {
      setFiles(response.files)
      setActiveFile(response.active_file)
    } else {
      setFeedback(response.message)
    }
  }, [])

  useEffect(() => {
    if (!connected) {
      return
    }
    refreshFiles().catch((error) =>
      setFeedback(`서비스 호출 실패: ${errorText(error)}`),
    )
  }, [connected, refreshFiles])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      setFeedback(`서비스 호출 실패: ${errorText(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleTorqueOff = () =>
    run(async () => {
      const response = await torqueOff()
      setFeedback(response.message)
    })

  const handleTorqueOn = () =>
    run(async () => {
      const response = await torqueOn()
      setFeedback(response.message)
    })

  const handleStartRecording = () =>
    run(async () => {
      const response = await startRecording(fileName.trim())
      if (response.success) {
        setRecording(true)
        setFeedback(`녹화 시작: ${response.file_name}`)
      } else {
        setFeedback(response.message)
      }
    })

  const handleStopRecording = () =>
    run(async () => {
      const response = await stopRecording()
      setRecording(false)
      if (!response.success) {
        setFeedback(response.message)
        return
      }
      setActiveFile(response.file_name)
      let message = `저장됨: ${response.file_name} (${response.duration.toFixed(1)}초)`
      try {
        const reload = await reloadConfig()
        message += reload.success ? ' · 설정 리로드 완료' : ` · ${reload.message}`
      } catch (error) {
        message += ` · 리로드 실패: ${errorText(error)}`
      }
      setFeedback(message)
      await refreshFiles()
    })

  const handleApply = (name: string) =>
    run(async () => {
      const response = await setActiveMotion(name)
      if (!response.success) {
        setFeedback(response.message)
        return
      }
      let message = `적용됨: ${name}`
      try {
        const reload = await reloadConfig()
        message += reload.success ? ' · 설정 리로드 완료' : ` · ${reload.message}`
      } catch (error) {
        message += ` · 리로드 실패: ${errorText(error)}`
      }
      setFeedback(message)
      await refreshFiles()
    })

  const handleRefresh = () => run(refreshFiles)

  const buttonClass = (className: string) =>
    `rounded-md px-3 py-3 text-sm font-semibold text-white transition ${className} disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400`

  return (
    <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-slate-200">모션 티칭</h2>
        <span
          data-testid="teach-recording-state"
          className={`rounded px-2 py-1 text-xs font-semibold ${
            recording ? 'bg-red-950 text-red-300' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {recording ? '녹화 중' : '대기'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          disabled={!connected || busy || recording}
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
      <div className="mb-2 mt-4 flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium text-slate-200">모션 파일</h3>
        <button
          type="button"
          disabled={!connected || busy}
          onClick={handleRefresh}
          className="rounded-md bg-slate-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          목록 새로고침
        </button>
      </div>
      <ul data-testid="teach-file-list" className="space-y-1">
        {files.map((name) => (
          <li
            key={name}
            className="flex items-center justify-between gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs text-slate-200"
          >
            <span className="truncate">{name}</span>
            {name === activeFile ? (
              <span className="shrink-0 rounded bg-emerald-950 px-2 py-1 font-semibold text-emerald-300">
                사용 중
              </span>
            ) : (
              <button
                type="button"
                data-testid={`teach-file-apply-${name}`}
                disabled={!connected || busy}
                onClick={() => handleApply(name)}
                className="shrink-0 rounded bg-blue-600 px-2 py-1 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                적용
              </button>
            )}
          </li>
        ))}
      </ul>
      <p
        data-testid="teach-feedback"
        className="mt-3 min-h-5 text-xs text-slate-400"
      >
        {connected
          ? feedback ?? '토크를 해제한 뒤 녹화를 시작하세요.'
          : 'ROS 연결 후 사용할 수 있습니다.'}
      </p>
    </section>
  )
}
