export function isMotorEnabled(statusword: number): boolean {
  return statusword === 1 || (statusword & 0x006f) === 0x0027
}

// null when config isn't loaded yet or limits are degenerate (upper <= lower) -
// caller renders the gauge track without a needle in that case.
export function positionGaugePercent(
  position: number,
  lower: number,
  upper: number,
): number | null {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
    return null
  }
  const ratio = (position - lower) / (upper - lower)
  return Math.min(100, Math.max(0, ratio * 100))
}
