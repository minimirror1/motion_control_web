import { describe, expect, it } from 'vitest'
import { isMotorEnabled, positionGaugePercent } from '../src/lib/motorStatus'

describe('isMotorEnabled', () => {
  it('treats statusword 1 as enabled', () => {
    expect(isMotorEnabled(1)).toBe(true)
  })

  it('treats a CiA402 operation-enabled bit pattern as enabled', () => {
    expect(isMotorEnabled(0x0027)).toBe(true)
  })

  it('treats 0 as disabled', () => {
    expect(isMotorEnabled(0)).toBe(false)
  })
})

describe('positionGaugePercent', () => {
  it('maps a mid-range position to 50%', () => {
    expect(positionGaugePercent(0, -10, 10)).toBe(50)
  })

  it('clamps below the lower limit to 0%', () => {
    expect(positionGaugePercent(-20, -10, 10)).toBe(0)
  })

  it('clamps above the upper limit to 100%', () => {
    expect(positionGaugePercent(20, -10, 10)).toBe(100)
  })

  it('returns null for degenerate limits (upper <= lower)', () => {
    expect(positionGaugePercent(0, 10, 10)).toBeNull()
    expect(positionGaugePercent(0, 10, -10)).toBeNull()
  })
})
