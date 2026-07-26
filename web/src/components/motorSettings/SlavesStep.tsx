import {
  createEmptySlave,
  nextValue,
  SLAVE_TRANSPORT_FIELDS,
  type Driver,
  type MasterType,
  type Slave,
} from '../../lib/motorManagerConfig'

const FIELD_LABELS: Record<string, string> = {
  bus_id: 'bus_id',
  alias: 'alias',
  position: 'position',
  vendor_id: 'vendor_id',
  product_id: 'product_id',
  can_id: 'can_id',
}

const PROFILE_MODE_LABELS: Record<number, string> = {
  0: 'Position',
  1: 'Velocity',
  2: 'Effort',
}

interface SlavesStepProps {
  masterType: MasterType
  slaves: Slave[]
  drivers: Driver[]
  onChange: (slaves: Slave[]) => void
  onPrev: () => void
  onNext: () => void
}

export function SlavesStep({
  masterType,
  slaves,
  drivers,
  onChange,
  onPrev,
  onNext,
}: SlavesStepProps) {
  const transportFields = SLAVE_TRANSPORT_FIELDS[masterType]

  const handleAdd = () => {
    const controllerIndex = nextValue(slaves.map((slave) => slave.controller_index))
    const driverId = drivers[0]?.id ?? 0
    onChange([...slaves, createEmptySlave(masterType, controllerIndex, driverId)])
  }

  const handleRemove = (controllerIndex: number) => {
    onChange(slaves.filter((slave) => slave.controller_index !== controllerIndex))
  }

  const handleFieldChange = (controllerIndex: number, field: keyof Slave, value: number) => {
    onChange(
      slaves.map((slave) =>
        slave.controller_index === controllerIndex ? { ...slave, [field]: value } : slave,
      ),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">슬레이브(모터)</h3>
        <button
          type="button"
          disabled={drivers.length === 0}
          onClick={handleAdd}
          data-testid="add-slave"
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          슬레이브 추가
        </button>
      </div>

      {drivers.length === 0 && (
        <p className="text-xs text-amber-400">먼저 드라이버 프로필을 하나 이상 추가하세요.</p>
      )}
      {slaves.length === 0 && <p className="text-xs text-slate-400">슬레이브가 없습니다.</p>}

      <div className="space-y-2">
        {slaves.map((slave) => (
          <div
            key={slave.controller_index}
            data-testid={`slave-row-${slave.controller_index}`}
            className="grid grid-cols-2 gap-2 rounded-md border border-slate-700 bg-slate-800 p-3 sm:grid-cols-4"
          >
            <label className="block text-[11px] text-slate-300">
              controller_index
              <input
                type="number"
                value={slave.controller_index}
                onChange={(event) =>
                  handleFieldChange(
                    slave.controller_index,
                    'controller_index',
                    Number(event.target.value),
                  )
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              />
            </label>
            <label className="block text-[11px] text-slate-300">
              driver_id
              <select
                value={slave.driver_id}
                onChange={(event) =>
                  handleFieldChange(slave.controller_index, 'driver_id', Number(event.target.value))
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    #{driver.id} ({driver.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-slate-300">
              profile_mode
              <select
                value={slave.profile_mode}
                onChange={(event) =>
                  handleFieldChange(
                    slave.controller_index,
                    'profile_mode',
                    Number(event.target.value),
                  )
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                {Object.entries(PROFILE_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {transportFields.map((field) => (
              <label key={String(field)} className="block text-[11px] text-slate-300">
                {FIELD_LABELS[field as string] ?? String(field)}
                <input
                  type="number"
                  value={(slave[field] as number | undefined) ?? 0}
                  onChange={(event) =>
                    handleFieldChange(slave.controller_index, field, Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => handleRemove(slave.controller_index)}
              data-testid={`remove-slave-${slave.controller_index}`}
              className="col-span-2 mt-1 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-red-500 sm:col-span-1"
            >
              삭제
            </button>
          </div>
        ))}
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
