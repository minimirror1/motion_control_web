import { describe, expect, it } from 'vitest'
import { formatCursorTime } from '../src/components/teach/TrajectoryChart'

describe('formatCursorTime', () => {
  it('shows seconds with two decimals', () => {
    expect(formatCursorTime(7.004)).toBe('7.00 s')
    expect(formatCursorTime(9.3149)).toBe('9.31 s')
    expect(formatCursorTime(0)).toBe('0.00 s')
  })
})
