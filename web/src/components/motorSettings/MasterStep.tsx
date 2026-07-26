import {
  createEmptyMaster,
  MASTER_TRANSPORT_FIELDS,
  type Master,
  type MasterType,
} from '../../lib/motorManagerConfig'

const MASTER_TYPES: MasterType[] = ['serial', 'ethercat', 'canopen', 'socketcan']

const STRING_FIELDS = new Set<string>(['serial_port'])

const FIELD_LABELS: Record<string, string> = {
  serial_port: '시리얼 포트',
  serial_baudrate: '보드레이트',
  ethercat_master_index: 'EtherCAT 마스터 인덱스',
  can_interface_index: 'CAN 인터페이스 인덱스',
  can_bitrate: 'CAN 비트레이트',
}

interface MasterStepProps {
  master: Master
  onChange: (master: Master) => void
  onPrev: () => void
  onNext: () => void
}

export function MasterStep({ master, onChange, onPrev, onNext }: MasterStepProps) {
  const handleTypeChange = (type: MasterType) => {
    const fresh = createEmptyMaster(type, master.id)
    onChange({ ...fresh, slaves: master.slaves, number_of_slaves: master.slaves.length })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-200">마스터 설정</h3>
      <label className="block text-xs text-slate-300">
        타입
        <select
          value={master.type}
          onChange={(event) => handleTypeChange(event.target.value as MasterType)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          {MASTER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      {MASTER_TRANSPORT_FIELDS[master.type].map((field) => {
        const isString = STRING_FIELDS.has(field as string)
        return (
          <label key={String(field)} className="block text-xs text-slate-300">
            {FIELD_LABELS[field as string] ?? String(field)}
            <input
              type={isString ? 'text' : 'number'}
              value={(master[field] as string | number | undefined) ?? ''}
              onChange={(event) =>
                onChange({
                  ...master,
                  [field]: isString ? event.target.value : Number(event.target.value),
                })
              }
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
            />
          </label>
        )
      })}

      <p className="text-xs text-slate-500">슬레이브 수: {master.slaves.length}</p>

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
