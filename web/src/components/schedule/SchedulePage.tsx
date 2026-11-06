import { useCallback, useEffect, useState } from 'react'
import { useConnectionStore } from '../../store/connectionStore'
import { listMotionFiles } from '../../lib/teachServices'
import {
  DAYS,
  DAY_LABELS,
  PHASE_LABELS,
  getSchedule,
  setSchedule,
  type Range,
  type ScheduleConfig,
} from '../../lib/scheduleServices'

const INPUT =
  'rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 disabled:opacity-50'
const CARD = 'rounded-lg border border-slate-700 bg-slate-900 p-4'

function StatusCard({
  savedEnabled,
  busy,
  onToggle,
}: {
  savedEnabled: boolean | null
  busy: boolean
  onToggle: () => void
}) {
  const status = useConnectionStore((state) => state.scheduleStatus)
  const enabled = status?.enabled ?? savedEnabled

  return (
    <section className={CARD} data-testid="schedule-status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">스케줄 상태</h2>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {status ? PHASE_LABELS[status.phase] ?? status.phase : '상태 수신 대기 중'}
          </p>
        </div>
        <button
          type="button"
          data-testid="schedule-toggle"
          disabled={busy || enabled === null}
          onClick={onToggle}
          className={`rounded-md px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-700 ${
            enabled ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {enabled ? '스케줄 끄기 (즉시 정지)' : '스케줄 켜기'}
        </button>
      </div>
      {status && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-3">
          <div>
            현재 시각: <span className="text-slate-200">{status.now.slice(0, 19).replace('T', ' ')}</span>
          </div>
          <div>
            시간대: <span className="text-slate-200">{status.timezone}</span>
          </div>
          <div>
            영업시간: <span className="text-slate-200">{status.open_now ? '영업 중' : '영업 외'}</span>
          </div>
          <div>
            현재 모션: <span className="text-slate-200">{status.active_motion ?? '-'}</span>
          </div>
          <div>
            휴게까지 남은 모션: <span className="text-slate-200">{status.motions_left}</span>
          </div>
          <div>
            휴게 남은 시간:{' '}
            <span className="text-slate-200">
              {status.rest_remaining_sec === null ? '-' : `${Math.ceil(status.rest_remaining_sec)}초`}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-3">
            모터 온도 (토크 OFF 때만 측정, 마지막 값):{' '}
            <span className="text-slate-200">
              {status.temperatures.length
                ? status.motor_ids.map((id, i) => `#${id} ${status.temperatures[i]}℃`).join(' · ')
                : '-'}
            </span>
          </div>
          {status.last_error && (
            <div className="col-span-2 text-red-400 sm:col-span-3">최근 오류: {status.last_error}</div>
          )}
        </dl>
      )}
    </section>
  )
}

function RangeInput({
  label,
  unit,
  value,
  step,
  onChange,
  testId,
}: {
  label: string
  unit: string
  value: Range
  step: number
  onChange: (value: Range) => void
  testId: string
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
      <span className="w-40">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value.min}
        data-testid={`${testId}-min`}
        onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
        className={`${INPUT} w-24`}
      />
      ~
      <input
        type="number"
        min={0}
        step={step}
        value={value.max}
        data-testid={`${testId}-max`}
        onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
        className={`${INPUT} w-24`}
      />
      <span className="text-slate-500">{unit}</span>
    </label>
  )
}

export function SchedulePage() {
  const connected = useConnectionStore((state) => state.connected)
  const [saved, setSaved] = useState<ScheduleConfig | null>(null)
  const [form, setForm] = useState<ScheduleConfig | null>(null)
  const [motionFiles, setMotionFiles] = useState<string[]>([])
  const [addFile, setAddFile] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const { config } = await getSchedule()
      setSaved(config)
      setForm(config)
      const files = await listMotionFiles()
      setMotionFiles(files.files)
      setAddFile(files.files[0] ?? '')
    } catch (error) {
      setMessage({ ok: false, text: `불러오기 실패: ${(error as Error).message}` })
    }
  }, [])

  useEffect(() => {
    if (connected) {
      void load()
    }
  }, [connected, load])

  const save = async (config: ScheduleConfig, okText: string) => {
    setBusy(true)
    try {
      await setSchedule(config)
      setSaved(config)
      setMessage({ ok: true, text: okText })
      return true
    } catch (error) {
      setMessage({ ok: false, text: `저장 실패: ${(error as Error).message}` })
      return false
    } finally {
      setBusy(false)
    }
  }

  // The switch applies the last *saved* settings so unsaved edits in the form
  // never go live by accident.
  const toggle = async () => {
    if (!saved) {
      return
    }
    // Flip what the robot reports, which wins over a stale page copy.
    const current = useConnectionStore.getState().scheduleStatus?.enabled ?? saved.enabled
    const next = { ...saved, enabled: !current }
    if (await save(next, next.enabled ? '스케줄을 켰습니다.' : '스케줄을 껐습니다.')) {
      setForm((current) => (current ? { ...current, enabled: next.enabled } : current))
    }
  }

  if (!connected) {
    return <p className="text-sm text-slate-400">ROS 연결 후 스케줄을 설정할 수 있습니다.</p>
  }

  const update = (patch: Partial<ScheduleConfig>) =>
    setForm((current) => (current ? { ...current, ...patch } : current))

  const moveItem = (index: number, delta: number) => {
    if (!form) return
    const playlist = [...form.playlist]
    const target = index + delta
    if (target < 0 || target >= playlist.length) return
    ;[playlist[index], playlist[target]] = [playlist[target], playlist[index]]
    update({ playlist })
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  return (
    <div className="space-y-4">
      <StatusCard savedEnabled={saved?.enabled ?? null} busy={busy} onToggle={toggle} />

      {form && (
        <>
          <section className={CARD}>
            <h2 className="mb-3 text-sm font-medium text-slate-200">주간 운영 시간</h2>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const entry = form.week[day]
                const setDay = (patch: Partial<typeof entry>) =>
                  update({ week: { ...form.week, [day]: { ...entry, ...patch } } })
                return (
                  <div key={day} className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <label className="flex w-20 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.enabled}
                        data-testid={`schedule-day-${day}`}
                        onChange={(e) => setDay({ enabled: e.target.checked })}
                      />
                      {DAY_LABELS[day]}
                    </label>
                    <input
                      type="time"
                      value={entry.open}
                      disabled={!entry.enabled}
                      data-testid={`schedule-open-${day}`}
                      onChange={(e) => setDay({ open: e.target.value })}
                      className={INPUT}
                    />
                    ~
                    <input
                      type="time"
                      value={entry.close}
                      disabled={!entry.enabled}
                      data-testid={`schedule-close-${day}`}
                      onChange={(e) => setDay({ close: e.target.value })}
                      className={INPUT}
                    />
                    {!entry.enabled && <span className="text-slate-500">휴무</span>}
                  </div>
                )
              })}
            </div>
          </section>

          <section className={CARD}>
            <h2 className="mb-1 text-sm font-medium text-slate-200">플레이리스트 (순서대로 반복)</h2>
            <p className="mb-3 text-xs text-slate-500">
              비워 두면 현재 활성 모션 하나만 반복합니다.
            </p>
            <ol className="space-y-1" data-testid="schedule-playlist">
              {form.playlist.map((file, index) => (
                <li key={`${file}-${index}`} className="flex items-center gap-2 text-sm text-slate-200">
                  <span className="w-6 text-right text-slate-500">{index + 1}.</span>
                  <span className="flex-1 truncate">{file}</span>
                  <button type="button" className="px-2 text-slate-400 hover:text-slate-100" onClick={() => moveItem(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className="px-2 text-slate-400 hover:text-slate-100" onClick={() => moveItem(index, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="px-2 text-red-400 hover:text-red-300"
                    onClick={() => update({ playlist: form.playlist.filter((_, i) => i !== index) })}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={addFile}
                onChange={(e) => setAddFile(e.target.value)}
                data-testid="schedule-add-file"
                className={`${INPUT} min-w-0 flex-1`}
              >
                {motionFiles.map((file) => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addFile}
                data-testid="schedule-add"
                onClick={() => update({ playlist: [...form.playlist, addFile] })}
                className="rounded-md bg-slate-700 px-3 py-1 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </section>

          <section className={`${CARD} space-y-3`}>
            <h2 className="text-sm font-medium text-slate-200">휴게 / 과열</h2>
            <RangeInput
              label="휴게 전 모션 수 (무작위)"
              unit="개"
              step={1}
              value={form.motions_per_rest}
              testId="schedule-motions"
              onChange={(motions_per_rest) => update({ motions_per_rest })}
            />
            <RangeInput
              label="휴게 시간 (무작위)"
              unit="초"
              step={1}
              value={form.rest_sec}
              testId="schedule-rest"
              onChange={(rest_sec) => update({ rest_sec })}
            />
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="w-40">과열 기준</span>
              <input
                type="number"
                value={form.overheat.limit_c}
                data-testid="schedule-limit"
                onChange={(e) => update({ overheat: { ...form.overheat, limit_c: Number(e.target.value) } })}
                className={`${INPUT} w-24`}
              />
              <span className="text-slate-500">℃ 이상이면 휴게 연장,</span>
              <input
                type="number"
                value={form.overheat.resume_c}
                data-testid="schedule-resume"
                onChange={(e) => update({ overheat: { ...form.overheat, resume_c: Number(e.target.value) } })}
                className={`${INPUT} w-24`}
              />
              <span className="text-slate-500">℃ 미만에서 재개, 재측정</span>
              <input
                type="number"
                min={1}
                value={form.overheat.recheck_sec}
                data-testid="schedule-recheck"
                onChange={(e) => update({ overheat: { ...form.overheat, recheck_sec: Number(e.target.value) } })}
                className={`${INPUT} w-20`}
              />
              <span className="text-slate-500">초마다</span>
            </label>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="schedule-save"
              disabled={busy || !dirty}
              onClick={() => void save({ ...form, enabled: saved?.enabled ?? false }, '설정을 저장했습니다.')}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              설정 저장
            </button>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => setForm(saved)}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
            >
              되돌리기
            </button>
          </div>
        </>
      )}

      {message && (
        <p
          data-testid="schedule-message"
          className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
