import {
  stringifyMotorManagerConfig,
  validateMotorManagerConfig,
  type MotorManagerConfig,
} from '../../lib/motorManagerConfig'

interface ReviewStepProps {
  config: MotorManagerConfig
  saving: boolean
  saveMessage: string | null
  saveError: string | null
  onPrev: () => void
  onSave: () => void
  onReset: () => void
}

export function ReviewStep({
  config,
  saving,
  saveMessage,
  saveError,
  onPrev,
  onSave,
  onReset,
}: ReviewStepProps) {
  const errors = validateMotorManagerConfig(config)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-200">검토 및 저장</h3>

      {errors.length > 0 && (
        <ul
          data-testid="review-errors"
          className="list-disc space-y-1 rounded-md border border-red-800 bg-red-950 p-3 pl-6 text-xs text-red-300"
        >
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <pre
        data-testid="review-yaml-preview"
        className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-300"
      >
        {stringifyMotorManagerConfig(config)}
      </pre>

      {saveMessage && (
        <p
          data-testid="save-success"
          className="rounded-md border border-emerald-800 bg-emerald-950 p-2 text-xs text-emerald-300"
        >
          {saveMessage}
        </p>
      )}
      {saveError && (
        <p
          data-testid="save-error"
          className="rounded-md border border-red-800 bg-red-950 p-2 text-xs text-red-300"
        >
          {saveError}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-600"
          >
            이전
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-600"
          >
            처음부터
          </button>
        </div>
        <button
          type="button"
          disabled={errors.length > 0 || saving}
          onClick={onSave}
          data-testid="save-button"
          className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
