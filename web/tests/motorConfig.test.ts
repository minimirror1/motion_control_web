import { describe, expect, it } from 'vitest'
import {
  findMotorConfig,
  parseMotorConfigResponse,
  type GetMotorConfigResponse,
} from '../src/lib/motorConfig'

describe('parseMotorConfigResponse', () => {
  it('zips parallel arrays by index and decodes controller_index', () => {
    const response: GetMotorConfigResponse = {
      success: true,
      message: 'ok',
      controller_index: [0, 1],
      lower: [-180, -90],
      upper: [180, 90],
      speed: [700, 350],
      gear_ratio: [1, 2],
      rated_effort: [0.6, 1.2],
      motor_type: ['dynamixel', 'dynamixel'],
    }

    expect(parseMotorConfigResponse(response)).toEqual([
      {
        controllerIndex: 0,
        lower: -180,
        upper: 180,
        speed: 700,
        gearRatio: 1,
        ratedEffort: 0.6,
        motorType: 'dynamixel',
      },
      {
        controllerIndex: 1,
        lower: -90,
        upper: 90,
        speed: 350,
        gearRatio: 2,
        ratedEffort: 1.2,
        motorType: 'dynamixel',
      },
    ])
  })

  it('decodes a base64-encoded controller_index (uint8[] over rosbridge)', () => {
    const response: GetMotorConfigResponse = {
      success: true,
      message: 'ok',
      controller_index: 'Ag==', // base64("\x02")
      lower: [-10],
      upper: [10],
      speed: [5],
      gear_ratio: [1],
      rated_effort: [1],
      motor_type: ['dynamixel'],
    }

    expect(parseMotorConfigResponse(response)[0].controllerIndex).toBe(2)
  })
})

describe('findMotorConfig', () => {
  const entries = [
    { controllerIndex: 0, lower: -1, upper: 1, speed: 1, gearRatio: 1, ratedEffort: 1, motorType: 'a' },
    { controllerIndex: 1, lower: -1, upper: 1, speed: 1, gearRatio: 1, ratedEffort: 1, motorType: 'b' },
  ]

  it('finds the entry matching the controller index', () => {
    expect(findMotorConfig(entries, 1)?.motorType).toBe('b')
  })

  it('returns undefined when no entry matches', () => {
    expect(findMotorConfig(entries, 9)).toBeUndefined()
  })

  it('returns undefined when entries is null', () => {
    expect(findMotorConfig(null, 0)).toBeUndefined()
  })
})
