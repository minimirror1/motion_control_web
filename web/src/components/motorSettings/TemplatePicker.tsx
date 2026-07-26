import { useState } from 'react'

interface TemplatePickerProps {
  templates: string[]
  hasActiveConfig: boolean
  onStartFromActive: () => void
  onStartFromTemplate: (name: string) => Promise<void>
}

export function TemplatePicker({
  templates,
  hasActiveConfig,
  onStartFromActive,
  onStartFromTemplate,
}: TemplatePickerProps) {
  const [busy, setBusy] = useState(false)

  const handleTemplate = async (name: string) => {
    setBusy(true)
    try {
      await onStartFromTemplate(name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        시작할 기준을 선택하세요. 현재 활성 설정에서 시작하거나, 모터 종류별 템플릿을 선택할 수 있습니다.
      </p>
      <button
        type="button"
        disabled={!hasActiveConfig || busy}
        onClick={onStartFromActive}
        data-testid="start-from-active"
        className="w-full rounded-md bg-emerald-700 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        현재 활성 설정에서 시작
      </button>
      <ul className="space-y-1">
        {templates.map((name) => (
          <li key={name}>
            <button
              type="button"
              disabled={busy}
              data-testid={`start-from-template-${name}`}
              onClick={() => handleTemplate(name)}
              className="w-full rounded-md bg-slate-700 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
      {templates.length === 0 && (
        <p className="text-xs text-slate-500">사용 가능한 템플릿이 없습니다.</p>
      )}
    </div>
  )
}
