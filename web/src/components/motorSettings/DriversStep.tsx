import { createEmptyDriver, nextId, type Driver, type DriverType, type Slave } from '../../lib/motorManagerConfig'

const DRIVER_TYPES: DriverType[] = ['dynamixel', 'minas', 'zeroerr', 'cubemars']

const NUMERIC_FIELDS: (keyof Driver)[] = [
  'pulse_per_revolution',
  'zero_offset',
  'gear_ratio',
  'rated_effort',
  'unit_effort',
  'lower',
  'upper',
  'speed',
  'acceleration',
  'deceleration',
  'profile_velocity',
  'profile_acceleration',
  'profile_deceleration',
  'profile_position_value',
  'profile_velocity_value',
  'profile_effort_value',
]

const FIELD_LABELS: Record<string, string> = {
  pulse_per_revolution: '펄스/회전',
  zero_offset: '제로 오프셋',
  gear_ratio: '감속비',
  rated_effort: '정격 토크',
  unit_effort: '토크 단위',
  lower: '하한(도)',
  upper: '상한(도)',
  speed: '속도',
  acceleration: '가속도',
  deceleration: '감속도',
  profile_velocity: '프로파일 속도',
  profile_acceleration: '프로파일 가속도',
  profile_deceleration: '프로파일 감속도',
  profile_position_value: '위치 프로파일 값',
  profile_velocity_value: '속도 프로파일 값',
  profile_effort_value: '토크 프로파일 값',
}

interface DriversStepProps {
  drivers: Driver[]
  slaves: Slave[]
  onChange: (drivers: Driver[]) => void
  onPrev: () => void
  onNext: () => void
}

export function DriversStep({ drivers, slaves, onChange, onPrev, onNext }: DriversStepProps) {
  const referencedIds = new Set(slaves.map((slave) => slave.driver_id))

  const handleAdd = () => {
    onChange([...drivers, createEmptyDriver('dynamixel', nextId(drivers))])
  }

  const handleRemove = (id: number) => {
    onChange(drivers.filter((driver) => driver.id !== id))
  }

  const handleFieldChange = (id: number, field: keyof Driver, value: string | number) => {
    onChange(drivers.map((driver) => (driver.id === id ? { ...driver, [field]: value } : driver)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">드라이버 프로필</h3>
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
          return (
            <div
              key={driver.id}
              data-testid={`driver-card-${driver.id}`}
              className="rounded-md border border-slate-700 bg-slate-800 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">드라이버 #{driver.id}</span>
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
                {NUMERIC_FIELDS.map((field) => (
                  <label key={field} className="block text-[11px] text-slate-300">
                    {FIELD_LABELS[field]}
                    <input
                      type="number"
                      value={driver[field] as number}
                      onChange={(event) =>
                        handleFieldChange(driver.id, field, Number(event.target.value))
                      }
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    />
                  </label>
                ))}
              </div>
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
