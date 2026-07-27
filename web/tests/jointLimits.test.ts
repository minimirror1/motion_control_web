import { describe, expect, it } from 'vitest'
import { jointLimits, jointsAtLimit, limitStatus } from '../src/lib/jointLimits'

const status = {
  controller_index: [0, 1, 2],
  controlword: [0, 0, 0],
  statusword: [0, 0, 0],
  errorcode: [0, 0, 0],
  encoder: [0, 0, 0],
  position: [0.0, -0.98, 2.0],
  velocity: [0, 0, 0],
  effort: [0, 0, 0],
}

function config(controllerIndex: number, lower: number, upper: number) {
  return {
    controllerIndex,
    lower,
    upper,
    speed: 1,
    gearRatio: 1,
    ratedEffort: 1,
    motorType: 'test',
  }
}

describe('limitStatus', () => {
  it('classifies the middle of the range as ok', () => {
    expect(limitStatus(0, -1, 1)).toBe('ok')
  })

  it('classifies the 5% band at either end as near', () => {
    expect(limitStatus(-0.96, -1, 1)).toBe('near')
    expect(limitStatus(0.96, -1, 1)).toBe('near')
  })

  it('classifies positions outside the range as over', () => {
    expect(limitStatus(-1.5, -1, 1)).toBe('over')
    expect(limitStatus(1.5, -1, 1)).toBe('over')
  })

  it('returns unknown for degenerate limits', () => {
    expect(limitStatus(0, 1, 1)).toBe('unknown')
    expect(limitStatus(0, Number.NaN, 1)).toBe('unknown')
  })
})

describe('jointLimits', () => {
  it('joins status against config and flags the joints at risk', () => {
    const limits = jointLimits(status, [
      config(0, -1, 1),
      config(1, -1, 1),
      config(2, -1, 1),
    ])

    expect(limits.map((limit) => limit.status)).toEqual(['ok', 'near', 'over'])
    expect(limits[0].percent).toBe(50)
    expect(jointsAtLimit(limits).map((limit) => limit.controllerIndex)).toEqual([1, 2])
  })

  it('marks joints without config as unknown instead of dropping them', () => {
    const limits = jointLimits(status, [config(0, -1, 1)])

    expect(limits).toHaveLength(3)
    expect(limits[1]).toMatchObject({ status: 'unknown', percent: null, lower: null })
    expect(jointsAtLimit(limits)).toEqual([])
  })

  it('returns nothing without motor status', () => {
    expect(jointLimits(null, [config(0, -1, 1)])).toEqual([])
  })
})
