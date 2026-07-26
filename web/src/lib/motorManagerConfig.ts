import { dump, load } from 'js-yaml'

export type MasterType = 'serial' | 'ethercat' | 'canopen' | 'socketcan'
export type DriverType = 'dynamixel' | 'minas' | 'zeroerr' | 'cubemars'

export interface Slave {
  controller_index: number
  driver_id: number
  profile_mode: 0 | 1 | 2
  bus_id?: number // serial
  alias?: number // ethercat
  position?: number // ethercat
  vendor_id?: number // ethercat
  product_id?: number // ethercat
  can_id?: number // canopen | socketcan
}

export interface Master {
  id: number
  type: MasterType
  number_of_slaves: number
  slaves: Slave[]
  serial_port?: string // serial
  serial_baudrate?: number // serial
  ethercat_master_index?: number // ethercat
  can_interface_index?: number // canopen | socketcan
  can_bitrate?: number // canopen | socketcan
}

export interface Driver {
  id: number
  type: DriverType
  pulse_per_revolution: number
  zero_offset: number
  gear_ratio: number
  rated_effort: number
  unit_effort: number
  lower: number
  upper: number
  speed: number
  acceleration: number
  deceleration: number
  profile_velocity: number
  profile_acceleration: number
  profile_deceleration: number
  profile_position_value: number
  profile_velocity_value: number
  profile_effort_value: number
  param_file: string
}

export interface MotorManagerConfig {
  period: number
  masters: Master[]
  drivers: Driver[]
}

export const MASTER_TRANSPORT_FIELDS: Record<MasterType, (keyof Master)[]> = {
  serial: ['serial_port', 'serial_baudrate'],
  ethercat: ['ethercat_master_index'],
  canopen: ['can_interface_index', 'can_bitrate'],
  socketcan: ['can_interface_index', 'can_bitrate'],
}

export const SLAVE_TRANSPORT_FIELDS: Record<MasterType, (keyof Slave)[]> = {
  serial: ['bus_id'],
  ethercat: ['alias', 'position', 'vendor_id', 'product_id'],
  canopen: ['can_id'],
  socketcan: ['can_id'],
}

export function parseMotorManagerYaml(yamlText: string): MotorManagerConfig {
  let parsed: unknown
  try {
    parsed = load(yamlText)
  } catch (error) {
    throw new Error(
      `YAML 파싱 실패: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('YAML 최상위는 매핑(mapping)이어야 합니다.')
  }
  const doc = parsed as Record<string, unknown>
  if (!Array.isArray(doc.masters)) {
    throw new Error("최상위 'masters' 목록이 없습니다.")
  }
  if (!Array.isArray(doc.drivers)) {
    throw new Error("최상위 'drivers' 목록이 없습니다.")
  }

  return {
    period: typeof doc.period === 'number' ? doc.period : 1_000_000,
    masters: doc.masters as Master[],
    drivers: doc.drivers as Driver[],
  }
}

export function stringifyMotorManagerConfig(config: MotorManagerConfig): string {
  const normalized: MotorManagerConfig = {
    period: config.period,
    masters: config.masters.map((master) => ({
      ...master,
      number_of_slaves: master.slaves.length,
    })),
    drivers: config.drivers,
  }
  return dump(normalized, { noRefs: true, lineWidth: -1 })
}

export function nextValue(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, value), -1) + 1
}

export function nextId<T extends { id: number }>(items: T[]): number {
  return nextValue(items.map((item) => item.id))
}

export function createEmptyMaster(type: MasterType, id: number): Master {
  const base: Master = { id, type, number_of_slaves: 0, slaves: [] }
  switch (type) {
    case 'serial':
      return { ...base, serial_port: '/dev/ttyUSB0', serial_baudrate: 1_000_000 }
    case 'ethercat':
      return { ...base, ethercat_master_index: 0 }
    case 'canopen':
    case 'socketcan':
      return { ...base, can_interface_index: 0, can_bitrate: 1_000_000 }
  }
}

export function createEmptyDriver(type: DriverType, id: number): Driver {
  return {
    id,
    type,
    pulse_per_revolution: 4096,
    zero_offset: 0,
    gear_ratio: 1.0,
    rated_effort: 1.0,
    unit_effort: 1.0,
    lower: -180.0,
    upper: 180.0,
    speed: 0,
    acceleration: 0,
    deceleration: 0,
    profile_velocity: 0,
    profile_acceleration: 0,
    profile_deceleration: 0,
    profile_position_value: 0,
    profile_velocity_value: 0,
    profile_effort_value: 0,
    param_file: '',
  }
}

export function createEmptySlave(
  masterType: MasterType,
  controllerIndex: number,
  driverId: number,
): Slave {
  const base: Slave = { controller_index: controllerIndex, driver_id: driverId, profile_mode: 0 }
  switch (masterType) {
    case 'serial':
      return { ...base, bus_id: controllerIndex + 1 }
    case 'ethercat':
      return { ...base, alias: 0, position: controllerIndex, vendor_id: 0, product_id: 0 }
    case 'canopen':
    case 'socketcan':
      return { ...base, can_id: controllerIndex + 1 }
  }
}

export function validateMotorManagerConfig(config: MotorManagerConfig): string[] {
  const errors: string[] = []
  const master = config.masters[0]
  if (!master) {
    errors.push('마스터 설정이 없습니다.')
    return errors
  }
  if (master.slaves.length === 0) {
    errors.push('슬레이브(모터)가 하나 이상 필요합니다.')
  }

  const driverIds = new Set<number>()
  for (const driver of config.drivers) {
    if (driverIds.has(driver.id)) {
      errors.push(`드라이버 id가 중복됩니다: ${driver.id}`)
    }
    driverIds.add(driver.id)
  }

  const controllerIndices = new Set<number>()
  for (const slave of master.slaves) {
    if (controllerIndices.has(slave.controller_index)) {
      errors.push(`controller_index가 중복됩니다: ${slave.controller_index}`)
    }
    controllerIndices.add(slave.controller_index)
    if (!driverIds.has(slave.driver_id)) {
      errors.push(
        `슬레이브(controller_index=${slave.controller_index})가 존재하지 않는 driver_id를 참조합니다: ${slave.driver_id}`,
      )
    }
  }

  return errors
}
