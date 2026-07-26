import { describe, expect, it } from 'vitest'
import {
  createEmptyDriver,
  createEmptyMaster,
  createEmptySlave,
  nextId,
  nextValue,
  parseMotorManagerYaml,
  stringifyMotorManagerConfig,
  validateMotorManagerConfig,
  type MotorManagerConfig,
} from '../src/lib/motorManagerConfig'

const SAMPLE_YAML = `
period: 1000000
masters:
  - id: 0
    type: serial
    number_of_slaves: 4
    serial_port: /dev/ttyUSB0
    serial_baudrate: 1000000
    slaves:
      - controller_index: 0
        driver_id: 0
        bus_id: 1
        profile_mode: 0
      - controller_index: 1
        driver_id: 1
        bus_id: 2
        profile_mode: 0
      - controller_index: 2
        driver_id: 1
        bus_id: 3
        profile_mode: 0
      - controller_index: 3
        driver_id: 1
        bus_id: 4
        profile_mode: 0
drivers:
  - id: 0
    type: dynamixel
    pulse_per_revolution: 4096
    zero_offset: 0
    gear_ratio: 1.0
    rated_effort: 0.6
    unit_effort: 1.0
    lower: -180.0
    upper: 180.0
    speed: 700.0
    acceleration: 1145.9
    deceleration: 1145.9
    profile_velocity: 350.2
    profile_acceleration: 1145.9
    profile_deceleration: 1145.9
    profile_position_value: 3
    profile_velocity_value: 1
    profile_effort_value: 0
    param_file: package://motor_manager/hardware/dynamixel/param/xc330_t181.yaml
  - id: 1
    type: dynamixel
    pulse_per_revolution: 4096
    zero_offset: 0
    gear_ratio: 1.0
    rated_effort: 1193.0
    unit_effort: 1.0
    lower: -180.0
    upper: 180.0
    speed: 343.8
    acceleration: 1145.9
    deceleration: 1145.9
    profile_velocity: 171.9
    profile_acceleration: 1145.9
    profile_deceleration: 1145.9
    profile_position_value: 3
    profile_velocity_value: 1
    profile_effort_value: 0
    param_file: package://motor_manager/hardware/dynamixel/param/xm430_w350.yaml
`

describe('parseMotorManagerYaml / stringifyMotorManagerConfig', () => {
  it('round-trips a multi-slave/multi-driver config', () => {
    const config = parseMotorManagerYaml(SAMPLE_YAML)
    expect(config.masters).toHaveLength(1)
    expect(config.masters[0].slaves).toHaveLength(4)
    expect(config.drivers).toHaveLength(2)

    const reparsed = parseMotorManagerYaml(stringifyMotorManagerConfig(config))
    expect(reparsed).toEqual(config)
  })

  it('throws when masters is missing', () => {
    expect(() => parseMotorManagerYaml('drivers: []\n')).toThrow(/masters/)
  })

  it('throws when drivers is missing', () => {
    expect(() => parseMotorManagerYaml('masters: []\n')).toThrow(/drivers/)
  })

  it('throws when the top level is not a mapping', () => {
    expect(() => parseMotorManagerYaml('- a\n- b\n')).toThrow(/매핑/)
  })

  it('recomputes number_of_slaves from the slaves array when stringifying', () => {
    const config = parseMotorManagerYaml(SAMPLE_YAML)
    config.masters[0].number_of_slaves = 999
    const yamlText = stringifyMotorManagerConfig(config)
    expect(parseMotorManagerYaml(yamlText).masters[0].number_of_slaves).toBe(4)
  })
})

describe('factory helpers', () => {
  it('nextValue returns 0 for an empty array and max+1 otherwise', () => {
    expect(nextValue([])).toBe(0)
    expect(nextValue([0, 2, 1])).toBe(3)
  })

  it('nextId derives from item.id', () => {
    expect(nextId([{ id: 0 }, { id: 5 }])).toBe(6)
  })

  it('createEmptyMaster/Driver/Slave produce a config that passes validation', () => {
    const master = createEmptyMaster('serial', 0)
    const driver = createEmptyDriver('dynamixel', 0)
    const slave = createEmptySlave('serial', 0, driver.id)
    const config: MotorManagerConfig = {
      period: 1_000_000,
      masters: [{ ...master, slaves: [slave], number_of_slaves: 1 }],
      drivers: [driver],
    }
    expect(validateMotorManagerConfig(config)).toEqual([])
  })
})

describe('validateMotorManagerConfig', () => {
  it('reports zero slaves, duplicate ids, and dangling driver_id references', () => {
    const config: MotorManagerConfig = {
      period: 1_000_000,
      masters: [
        {
          id: 0,
          type: 'serial',
          number_of_slaves: 2,
          slaves: [
            { controller_index: 0, driver_id: 0, profile_mode: 0 },
            { controller_index: 0, driver_id: 99, profile_mode: 0 },
          ],
        },
      ],
      drivers: [createEmptyDriver('dynamixel', 0), createEmptyDriver('dynamixel', 0)],
    }
    const errors = validateMotorManagerConfig(config)
    expect(errors.some((message) => message.includes('드라이버 id가 중복'))).toBe(true)
    expect(errors.some((message) => message.includes('controller_index가 중복'))).toBe(true)
    expect(errors.some((message) => message.includes('driver_id를 참조'))).toBe(true)
  })

  it('reports a missing master', () => {
    const config: MotorManagerConfig = { period: 1_000_000, masters: [], drivers: [] }
    expect(validateMotorManagerConfig(config)).toEqual(['마스터 설정이 없습니다.'])
  })
})
