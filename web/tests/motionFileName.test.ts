import { describe, expect, it } from 'vitest'
import { autoMotionFileName, sanitizeMotionFileName } from '../src/lib/motionFileName'

describe('sanitizeMotionFileName', () => {
  it('trims and appends the .csv extension', () => {
    expect(sanitizeMotionFileName('  my_motion  ')).toEqual({
      name: 'my_motion.csv',
      error: null,
    })
  })

  it('keeps an existing extension regardless of case', () => {
    expect(sanitizeMotionFileName('Wave.CSV').name).toBe('Wave.CSV')
  })

  // The node replaces per UTF-8 byte, so each Hangul syllable becomes 3 underscores.
  it('replaces characters outside [A-Za-z0-9._-] byte by byte', () => {
    expect(sanitizeMotionFileName('닭 춤 1').name).toBe('________1.csv')
  })

  it('rejects the cases the node rejects', () => {
    expect(sanitizeMotionFileName('   ').name).toBeNull()
    expect(sanitizeMotionFileName('a/b.csv').name).toBeNull()
    expect(sanitizeMotionFileName('a\\b.csv').name).toBeNull()
    expect(sanitizeMotionFileName('.hidden').name).toBeNull()
  })

  it('reports why a name was rejected, checking separators before the leading dot', () => {
    expect(sanitizeMotionFileName('a/b').error).toBe('경로 구분자는 사용할 수 없습니다.')
    expect(sanitizeMotionFileName('../escape.csv').error).toBe(
      '경로 구분자는 사용할 수 없습니다.',
    )
    expect(sanitizeMotionFileName('.hidden').error).toBe("'.'으로 시작할 수 없습니다.")
  })
})

describe('autoMotionFileName', () => {
  it('matches the node minute-resolution format in local time', () => {
    expect(autoMotionFileName(new Date(2026, 6, 26, 9, 5))).toBe(
      'teach_20260726_0905.csv',
    )
  })
})
