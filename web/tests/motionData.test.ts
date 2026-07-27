import { describe, expect, it } from 'vitest'
import {
  limitViolations,
  parseMotionData,
  peakSpeeds,
  samplingReport,
  startJumps,
  toWaveformData,
} from '../src/lib/motionData'

const response = {
  success: true,
  message: '',
  time: [0, 1, 2],
  // uint8[] arrives base64-encoded from rosbridge.
  controller_index: btoa('\x00\x01'),
  // Controller-major: J0 then J1.
  positions: [0.0, 0.5, 1.0, 2.0, 2.0, 2.0],
  total_samples: 1000,
  duration: 2,
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

describe('parseMotionData', () => {
  it('splits the controller-major position array into per-joint tracks', () => {
    const data = parseMotionData(response)

    expect(data.controllerIndices).toEqual([0, 1])
    expect(data.series).toEqual([
      [0.0, 0.5, 1.0],
      [2.0, 2.0, 2.0],
    ])
    expect(data.totalSamples).toBe(1000)
    expect(data.duration).toBe(2)
  })

  it('produces uPlot-shaped data', () => {
    expect(toWaveformData(parseMotionData(response))).toEqual([
      [0, 1, 2],
      [0.0, 0.5, 1.0],
      [2.0, 2.0, 2.0],
    ])
  })
})

describe('startJumps', () => {
  const motorStatus = {
    controller_index: [0, 1],
    controlword: [0, 0],
    statusword: [0, 0],
    errorcode: [0, 0],
    encoder: [0, 0],
    position: [0.0, 0.5],
    velocity: [0, 0],
    effort: [0, 0],
  }

  it('compares the first sample against the live position, largest gap first', () => {
    expect(startJumps(parseMotionData(response), motorStatus)).toEqual([
      { controllerIndex: 1, target: 2, current: 0.5, delta: 1.5 },
      { controllerIndex: 0, target: 0, current: 0, delta: 0 },
    ])
  })

  it('returns nothing without live feedback', () => {
    expect(startJumps(parseMotionData(response), null)).toEqual([])
  })
})

describe('limitViolations', () => {
  it('flags joints whose recorded range leaves the configured limits', () => {
    const violations = limitViolations(parseMotionData(response), [
      config(0, -2, 2),
      config(1, -1, 1),
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ controllerIndex: 1, status: 'over', max: 2 })
  })

  it('flags a joint that only grazes its limit as near', () => {
    // J0 peaks at exactly 1.0, which lands inside the 5% band of [-1, 1].
    const violations = limitViolations(parseMotionData(response), [config(0, -1, 1)])

    expect(violations).toEqual([
      { controllerIndex: 0, min: 0, max: 1, lower: -1, upper: 1, status: 'near' },
    ])
  })

  it('reports nothing when every joint stays inside its limits', () => {
    expect(
      limitViolations(parseMotionData(response), [config(0, -10, 10), config(1, -10, 10)]),
    ).toEqual([])
  })

  it('skips joints with no config rather than guessing', () => {
    expect(limitViolations(parseMotionData(response), null)).toEqual([])
  })
})

describe('peakSpeeds', () => {
  it('differentiates against the recorded time axis', () => {
    expect(peakSpeeds(parseMotionData(response))).toEqual([
      { controllerIndex: 0, peak: 0.5 },
      { controllerIndex: 1, peak: 0 },
    ])
  })
})

describe('samplingReport', () => {
  it('accepts an evenly sampled recording', () => {
    const report = samplingReport(parseMotionData(response))
    expect(report).toMatchObject({ minInterval: 1, maxInterval: 1, spread: 1, uniform: true })
  })

  it('flags a recording whose gaps vary by more than the tolerance', () => {
    const report = samplingReport(
      parseMotionData({ ...response, time: [0, 0.1, 5], duration: 5 }),
    )
    expect(report).toMatchObject({ minInterval: 0.1, maxInterval: 4.9, uniform: false })
    expect(report?.spread).toBeCloseTo(49, 5)
  })

  // Without a time row playback speed is already undefined, so there is nothing
  // to warn about.
  it('returns null when the file has no time row', () => {
    expect(samplingReport(parseMotionData({ ...response, duration: 0 }))).toBeNull()
  })
})
