import { useMemo, useState } from 'react'
import { sanitizeMotionFileName } from '../../lib/motionFileName'
import {
  deleteMotionFile,
  renameMotionFile,
  setActiveMotion,
} from '../../lib/teachServices'
import { useConnectionStore } from '../../store/connectionStore'
import type { TeachAction, TeachState } from './teachState'
import { LOCALE } from './teachUi'

interface Props {
  state: TeachState
  dispatch: (action: TeachAction) => void
  run: (action: () => Promise<void>) => Promise<void>
  configLocked: boolean
  refreshFiles: () => Promise<void>
  reloadAfterChange: () => Promise<string>
}

export function MotionLibrary({
  state,
  dispatch,
  run,
  configLocked,
  refreshFiles,
  reloadAfterChange,
}: Props) {
  const connected = useConnectionStore((store) => store.connected)
  const [query, setQuery] = useState('')
  // list_motion_files returns names only - no mtime - so descending name order is
  // the closest thing to "newest first" for the auto teach_<date>_<time> names.
  const [descending, setDescending] = useState(false)
  const { files, activeFile, selectedFile, busy } = state

  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? files.filter((name) => name.toLowerCase().includes(needle))
      : files
    const sorted = [...filtered].sort((a, b) => a.localeCompare(b, LOCALE))
    return descending ? sorted.reverse() : sorted
  }, [files, query, descending])

  const handleApply = (name: string) =>
    run(async () => {
      const response = await setActiveMotion(name)
      if (!response.success) {
        dispatch({ type: 'feedback', message: response.message })
        return
      }
      const suffix = await reloadAfterChange()
      dispatch({ type: 'feedback', message: `적용됨: ${name}${suffix}` })
      await refreshFiles()
    })

  const handleDelete = (name: string) =>
    run(async () => {
      if (!window.confirm(`${name} 을(를) 삭제할까요? 되돌릴 수 없습니다.`)) {
        return
      }
      const response = await deleteMotionFile(name)
      dispatch({ type: 'feedback', message: response.message })
      if (response.success) {
        await refreshFiles()
      }
    })

  const handleRename = (name: string) =>
    run(async () => {
      const input = window.prompt('새 이름', name)
      if (input === null) {
        return
      }
      const { name: preview, error } = sanitizeMotionFileName(input)
      if (!preview) {
        dispatch({ type: 'feedback', message: error ?? '이름이 올바르지 않습니다.' })
        return
      }
      const response = await renameMotionFile(name, input)
      dispatch({ type: 'feedback', message: response.message })
      if (response.success) {
        await refreshFiles()
      }
    })

  const rowClass = (name: string) =>
    `flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs text-slate-200 ${
      name === selectedFile ? 'bg-slate-700 ring-1 ring-sky-500' : 'bg-slate-800'
    }`

  const iconButtonClass =
    'shrink-0 rounded bg-slate-600 px-2 py-1 font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400'

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-slate-200">모션 라이브러리</h2>
        <button
          type="button"
          disabled={!connected || busy}
          onClick={() => run(refreshFiles)}
          className="rounded-md bg-slate-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          목록 새로고침
        </button>
      </div>
      <div className="mb-2 flex gap-2">
        <input
          type="search"
          data-testid="teach-file-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="파일 검색"
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500"
        />
        <button
          type="button"
          data-testid="teach-file-sort"
          onClick={() => setDescending((value) => !value)}
          className="shrink-0 rounded-md bg-slate-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-slate-500"
        >
          이름 {descending ? '↓' : '↑'}
        </button>
      </div>
      <ul data-testid="teach-file-list" className="space-y-1">
        {visibleFiles.map((name) => (
          <li key={name} className={rowClass(name)}>
            <button
              type="button"
              data-testid={`teach-file-select-${name}`}
              onClick={() => dispatch({ type: 'select_file', file: name })}
              className="min-w-0 flex-1 truncate text-left hover:text-sky-300"
            >
              {name}
            </button>
            {name === activeFile ? (
              <span className="shrink-0 rounded bg-emerald-950 px-2 py-1 font-semibold text-emerald-300">
                사용 중
              </span>
            ) : (
              <>
                <button
                  type="button"
                  data-testid={`teach-file-rename-${name}`}
                  disabled={!connected || busy}
                  onClick={() => handleRename(name)}
                  className={iconButtonClass}
                >
                  이름
                </button>
                <button
                  type="button"
                  data-testid={`teach-file-delete-${name}`}
                  disabled={!connected || busy}
                  onClick={() => handleDelete(name)}
                  className="shrink-0 rounded bg-red-700 px-2 py-1 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  삭제
                </button>
                <button
                  type="button"
                  data-testid={`teach-file-apply-${name}`}
                  disabled={!connected || busy || configLocked}
                  onClick={() => handleApply(name)}
                  className="shrink-0 rounded bg-blue-600 px-2 py-1 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  적용
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
