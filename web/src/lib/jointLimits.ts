import { findMotorConfig, type MotorConfigEntry } from './motorConfig'
import { positionGaugePercent } from './motorStatus'
import type { MotorStatus } from '../store/connectionStore'

export type LimitStatus = 'unknown' | 'ok' | 'near' | 'over'

export interface JointLimit {
  controllerIndex: number
  position: number
  lower: number | null
  upper: number | null
  percent: number | null
  status: LimitStatus
}

/** Fraction of the travel range at each end that counts as "near the limit". */
export const NEAR_LIMIT_MARGIN = 0.05

export function limitStatus(
  position: number,
  lower: number,
  upper: number,
  margin = NEAR_LIMIT_MARGIN,
): LimitStatus {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
    return 'unknown'
  }
  if (position < lower || position > upper) {
    return 'over'
  }
  const band = (upper - lower) * margin
  return position - lower <= band || upper - position <= band ? 'near' : 'ok'
}

export function jointLimits(
  motorStatus: MotorStatus | null,
  motorConfig: MotorConfigEntry[] | null,
): JointLimit[] {
  if (!motorStatus) {
    return []
  }
  return motorStatus.controller_index.map((controllerIndex, i) => {
    const position = motorStatus.position[i] ?? 0
    const config = findMotorConfig(motorConfig, controllerIndex)
    if (!config) {
      return {
        controllerIndex,
        position,
        lower: null,
        upper: null,
        percent: null,
        status: 'unknown' as const,
      }
    }
    return {
      controllerIndex,
      position,
      lower: config.lower,
      upper: config.upper,
      percent: positionGaugePercent(position, config.lower, config.upper),
      status: limitStatus(position, config.lower, config.upper),
    }
  })
}

export function jointsAtLimit(limits: JointLimit[]): JointLimit[] {
  return limits.filter((limit) => limit.status === 'near' || limit.status === 'over')
}
