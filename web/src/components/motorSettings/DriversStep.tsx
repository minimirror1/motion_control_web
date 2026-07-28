import { useState } from 'react'
import { createEmptyDriver, nextId, type Driver, type DriverType, type Slave } from '../../lib/motorManagerConfig'

const DRIVER_TYPES: DriverType[] = ['dynamixel', 'minas', 'zeroerr', 'cubemars']

type NumericDriverField = Exclude<keyof Driver, 'id' | 'type' | 'param_file'>

interface FieldSpec {
  key: NumericDriverField
  label: string
  unit?: string
}

interface FieldSection {
  title: string
  fields: FieldSpec[]
}

const FIELD_SECTIONS: FieldSection[] = [
  {
    title: '기구 스펙',
    fields: [
      { key: 'pulse_per_revolution', label: '펄스/회전', unit: 'pulse/rev' },
      { key: 'zero_offset', label: '제로 오프셋' },
      { key: 'gear_ratio', label: '감속비' },
      { key: 'rated_effort', label: '정격 토크', unit: 'N·m' },
      { key: 'unit_effort', label: '토크 단위' },
    ],
  },
  {
    title: '동작 범위',
    fields: [
      { key: 'lower', label: '하한', unit: '도' },
      { key: 'upper', label: '상한', unit: '도' },
      { key: 'speed', label: '속도', unit: 'deg/s' },
      { key: 'acceleration', label: '가속도', unit: 'deg/s²' },
      { key: 'deceleration', label: '감속도', unit: 'deg/s²' },
    ],
  },
  {
    title: '프로파일 값',
    fields: [
      { key: 'profile_velocity', label: '프로파일 속도', unit: 'deg/s' },
      { key: 'profile_acceleration', label: '프로파일 가속도', unit: 'deg/s²' },
      { key: 'profile_deceleration', label: '프로파일 감속도', unit: 'deg/s²' },
      { key: 'profile_position_value', label: '위치 프로파일 값' },
      { key: 'profile_velocity_value', label: '속도 프로파일 값' },
      { key: 'profile_effort_value', label: '토크 프로파일 값' },
    ],
  },
]

interface DriversStepProps {
  drivers: Driver[]
  baselineDrivers: Driver[]
  slaves: Slave[]
  onChange: (drivers: Driver[]) => void
  onPrev: () => void
  onNext: () => void
}

export function DriversStep({
  drivers,
  baselineDrivers,
  slaves,
  onChange,
  onPrev,
  onNext,
}: DriversStepProps) {
  const referencedIds = new Set(slaves.map((slave) => slave.driver_id))
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const handleAdd = () => {
    onChange([...drivers, createEmptyDriver('dynamixel', nextId(drivers))])
  }

  const handleDuplicate = (id: number) => {
    const index = drivers.findIndex((driver) => driver.id === id)
    if (index < 0) return
    const copy: Driver = { ...drivers[index], id: nextId(drivers) }
    const next = drivers.slice()
    next.splice(index + 1, 0, copy)
    onChange(next)
  }

  const handleRemove = (id: number) => {
    onChange(drivers.filter((driver) => driver.id !== id))
  }

  const handleFieldChange = (id: number, field: keyof Driver, value: string | number) => {
    onChange(drivers.map((driver) => (driver.id === id ? { ...driver, [field]: value } : driver)))
  }

  const toggleCollapsed = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium text-slate-200">드라이버 프로필</h3>
          <span className="text-xs text-slate-400">총 {drivers.length}개</span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          data-testid="add-driver"
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          드라이버 추가
        </button>
      </div>

      {drivers.length === 0 && <p className="text-xs text-slate-400">드라이버가 없습니다.</p>}

      <div className="space-y-3">
        {drivers.map((driver) => {
          const inUse = referencedIds.has(driver.id)
          const baseline = baselineDrivers.find((candidate) => candidate.id === driver.id)
          const expanded = !collapsed.has(driver.id)

          return (
            <div
              key={driver.id}
              data-testid={`driver-card-${driver.id}`}
              className="rounded-md border border-slate-700 bg-slate-800"
            >
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(driver.id)}
                    data-testid={`toggle-driver-${driver.id}`}
                    aria-label={expanded ? '접기' : '펼치기'}
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 text-[10px] text-slate-300 transition hover:bg-slate-700"
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <span className="text-xs font-semibold text-slate-200">드라이버 #{driver.id}</span>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    {driver.type}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(driver.id)}
                    data-testid={`duplicate-driver-${driver.id}`}
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-700"
                  >
                    복제
                  </button>
                  <button
                    type="button"
                    disabled={inUse}
                    title={inUse ? '이 드라이버를 참조하는 슬레이브가 있습니다' : undefined}
                    onClick={() => handleRemove(driver.id)}
                    data-testid={`remove-driver-${driver.id}`}
                    className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {!expanded && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-3 pl-10">
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400">
                    범위 {driver.lower}° ~ {driver.upper}°
                  </span>
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400">
                    속도 {driver.speed} deg/s
                  </span>
                </div>
              )}

              {expanded && (
                <div className="space-y-3 px-3 pb-3">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                      기본 정보
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="block text-[11px] text-slate-300">
                        타입
                        <select
                          value={driver.type}
                          onChange={(event) => handleFieldChange(driver.id, 'type', event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                        >
                          {DRIVER_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="col-span-2 block text-[11px] text-slate-300">
                        param_file
                        <input
                          type="text"
                          value={driver.param_file}
                          onChange={(event) => handleFieldChange(driver.id, 'param_file', event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                        />
                      </label>
                    </div>
                  </div>

                  {FIELD_SECTIONS.map((section) => (
                    <div key={section.title} className="border-t border-slate-700 pt-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                        {section.title}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {section.fields.map((fieldSpec) => {
                          const value = driver[fieldSpec.key] as number
                          const prevValue = baseline ? (baseline[fieldSpec.key] as number) : undefined
                          const isModified = baseline !== undefined && prevValue !== value

                          return (
                            <label key={fieldSpec.key} className="block text-[11px] text-slate-300">
                              <span className="flex items-baseline gap-1">
                                <span>{fieldSpec.label}</span>
                                {fieldSpec.unit && (
                                  <span className="text-slate-500">({fieldSpec.unit})</span>
                                )}
                                {isModified && (
                                  <span className="ml-auto rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">
                                    수정됨
                                  </span>
                                )}
                              </span>
                              <input
                                type="number"
                                value={value}
                                onChange={(event) =>
                                  handleFieldChange(driver.id, fieldSpec.key, Number(event.target.value))
                                }
                                className={`mt-1 w-full rounded-md border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 ${
                                  isModified ? 'border-blue-500' : 'border-slate-700'
                                }`}
                              />
                              {isModified && (
                                <span className="mt-0.5 block text-[10px] text-slate-500">
                                  이전 값: {prevValue}
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-600"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
        >
          다음
        </button>
      </div>
    </div>
  )
}
