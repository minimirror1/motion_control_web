import { describe, expect, it } from 'vitest'
import { decodeByteArray } from '../src/lib/rosbridgeCodec'

describe('decodeByteArray', () => {
  it('decodes a base64-encoded uint8[] as rosbridge sends it', () => {
    // RobotState.STATE_OPERATING = 2, base64("\x02") = "Ag=="
    expect(decodeByteArray('Ag==')).toEqual([2])
  })

  it('passes plain number arrays through unchanged', () => {
    expect(decodeByteArray([1, 2, 3])).toEqual([1, 2, 3])
  })
})
