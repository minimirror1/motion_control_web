import { describe, expect, it } from 'vitest'
import { RecordingBuffer } from '../src/lib/recordingBuffer'

describe('RecordingBuffer', () => {
  it('records elapsed seconds relative to reset and tracks per-joint range', () => {
    const buffer = new RecordingBuffer(10)
    buffer.reset(1000)
    buffer.push(1000, [0, 1], [0.0, 5.0])
    buffer.push(1500, [0, 1], [2.0, 3.0])
    buffer.push(2000, [0, 1], [-1.0, 4.0])

    expect(buffer.data()).toEqual([
      [0, 0.5, 1],
      [0, 2, -1],
      [5, 3, 4],
    ])
    const stats = buffer.stats(2000)
    expect(stats.controllerIndices).toEqual([0, 1])
    expect(stats.min).toEqual([-1, 3])
    expect(stats.max).toEqual([2, 5])
    expect(stats.totalSamples).toBe(3)
    expect(stats.elapsed).toBe(1)
    expect(stats.rate).toBe(3)
  })

  it('keeps the most recent samples once capacity is exceeded', () => {
    const buffer = new RecordingBuffer(3)
    buffer.reset(0)
    for (let i = 0; i < 5; i += 1) {
      buffer.push(i * 1000, [0], [i])
    }

    expect(buffer.data()).toEqual([
      [2, 3, 4],
      [2, 3, 4],
    ])
    // The counter keeps tracking the full recording, not just the window.
    expect(buffer.stats(4000).totalSamples).toBe(5)
  })

  it('carries the previous value forward when a controller drops out', () => {
    const buffer = new RecordingBuffer(10)
    buffer.reset(0)
    buffer.push(0, [0, 1], [1.0, 2.0])
    buffer.push(1000, [0], [1.5])

    expect(buffer.data()).toEqual([
      [0, 1],
      [1, 1.5],
      [2, 2],
    ])
  })

  it('locks the series layout to the first sample', () => {
    const buffer = new RecordingBuffer(10)
    buffer.reset(0)
    buffer.push(0, [0], [1.0])
    buffer.push(1000, [0, 5], [1.5, 9.0])

    expect(buffer.stats(1000).controllerIndices).toEqual([0])
    expect(buffer.data()).toEqual([
      [0, 1],
      [1, 1.5],
    ])
  })

  it('ignores empty messages and reports an empty snapshot', () => {
    const buffer = new RecordingBuffer(10)
    buffer.reset(0)
    buffer.push(0, [], [])

    expect(buffer.data()).toEqual([[]])
    const stats = buffer.stats(0)
    expect(stats.totalSamples).toBe(0)
    expect(stats.rate).toBeNull()
  })

  it('clears everything on reset', () => {
    const buffer = new RecordingBuffer(10)
    buffer.reset(0)
    buffer.push(0, [0], [1.0])
    buffer.reset(500)

    expect(buffer.data()).toEqual([[]])
    expect(buffer.stats(1500)).toMatchObject({
      elapsed: 1,
      totalSamples: 0,
      controllerIndices: [],
    })
  })
})
