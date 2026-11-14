// Dynamixel Hardware Error Status bits (address 70). Mirrors
// describe_hardware_error() in schedule_logic.py.
const HARDWARE_ERROR_BITS: [number, string][] = [
  [0, '입력 전압 오류'],
  [2, '과열'],
  [3, '엔코더 오류'],
  [4, '전기 충격'],
  [5, '과부하'],
]

export function describeHardwareError(code: number): string {
  if (!code) return ''
  const names = HARDWARE_ERROR_BITS.filter(([bit]) => code & (1 << bit)).map(([, name]) => name)
  return names.length ? names.join(', ') : `오류 코드 ${code}`
}
