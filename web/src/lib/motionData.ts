import { limitStatus, type LimitStatus } from './jointLimits'
import { findMotorConfig, type MotorConfigEntry } from './motorConfig'
import { decodeByteArray } from './rosbridgeCodec'
import type { WaveformData } from './recordingBuffer'
import type { MotorStatus } from '../store/connectionStore'

// Wire shape of motion_control_msgs/srv/GetMotionData's response.
export interface GetMotionDataResponse {
  success: boolean
  message: string
  time: number[]
  controller_index: string | number[]
  positions: number[]
  total_samples: number
  duration: number
}

export interface MotionData {
  time: number[]
  controllerIndices: number[]
  /** One position track per controller, aligned to `time`. */
  series: number[][]
  /** Sample count before the node downsampled. */
  totalSamples: number
  /** 0 when the CSV has no time row - `time` then holds sample indices. */
  duration: number
}

export function parseMotionData(response: GetMotionDataResponse): MotionData {
  const controllerIndices = decodeByteArray(response.controller_index)
  const sampleCount = response.time.length
  return {
    time: response.time,
    controllerIndices,
    series: controllerIndices.map((_, c) =>
      response.positions.slice(c * sampleCount, (c + 1) * sampleCount),
    ),
    totalSamples: response.total_samples,
    duration: response.duration,
  }
}

export function toWaveformData(data: MotionData): WaveformData {
  return [data.time, ...data.series]
}

export interface StartJump {
  controllerIndex: number
  target: number
  current: number
  delta: number
}

/**
 * Playback drives the arm to the motion's first sample. A large gap from where
 * it is now means a fast, unexpected move at the moment 재생 is pressed.
 */
export function startJumps(
  data: MotionData,
  motorStatus: MotorStatus | null,
): StartJump[] {
  if (!motorStatus) {
    return []
  }
  return data.controllerIndices
    .map((controllerIndex, c) => {
      const target = data.series[c]?.[0]
      const source = motorStatus.controller_index.indexOf(controllerIndex)
      if (target === undefined || source < 0) {
        return null
      }
      const current = motorStatus.position[source] ?? 0
      return { controllerIndex, target, current, delta: Math.abs(target - current) }
    })
    .filter((jump): jump is StartJump => jump !== null)
    .sort((a, b) => b.delta - a.delta)
}

export interface LimitViolation {
  controllerIndex: number
  min: number
  max: number
  lower: number
  upper: number
  status: Exclude<LimitStatus, 'unknown' | 'ok'>
}

/** Static check of the whole recording against the configured joint limits. */
export function limitViolations(
  data: MotionData,
  motorConfig: MotorConfigEntry[] | null,
): LimitViolation[] {
  return data.controllerIndices
    .map((controllerIndex, c) => {
      const track = data.series[c]
      const config = findMotorConfig(motorConfig, controllerIndex)
      if (!config || !track || track.length === 0) {
        return null
      }
      const min = Math.min(...track)
      const max = Math.max(...track)
      const statuses = [min, max].map((value) =>
        limitStatus(value, config.lower, config.upper),
      )
      const worst = statuses.includes('over')
        ? ('over' as const)
        : statuses.includes('near')
          ? ('near' as const)
          : null
      if (!worst) {
        return null
      }
      return {
        controllerIndex,
        min,
        max,
        lower: config.lower,
        upper: config.upper,
        status: worst,
      }
    })
    .filter((violation): violation is LimitViolation => violation !== null)
}

/** Largest |dx/dt| per controller, using the recorded time axis. */
export function peakSpeeds(data: MotionData): Array<{
  controllerIndex: number
  peak: number
}> {
  return data.controllerIndices.map((controllerIndex, c) => {
    const track = data.series[c] ?? []
    let peak = 0
    for (let i = 1; i < track.length; i += 1) {
      const dt = data.time[i] - data.time[i - 1]
      if (dt <= 0) {
        continue
      }
      peak = Math.max(peak, Math.abs(track[i] - track[i - 1]) / dt)
    }
    return { controllerIndex, peak }
  })
}

export interface SamplingReport {
  minInterval: number
  maxInterval: number
  /** maxInterval / minInterval; 1.0 is perfectly uniform. */
  spread: number
  uniform: boolean
}

/**
 * Playback discards the time row and replays columns at a uniform rate, so a
 * recording with uneven gaps will not play back at the speed it was taught.
 */
export function samplingReport(
  data: MotionData,
  tolerance = 3,
): SamplingReport | null {
  if (data.duration <= 0 || data.time.length < 3) {
    return null
  }
  const intervals: number[] = []
  for (let i = 1; i < data.time.length; i += 1) {
    intervals.push(data.time[i] - data.time[i - 1])
  }
  const minInterval = Math.min(...intervals)
  if (minInterval <= 0) {
    return null
  }
  const maxInterval = Math.max(...intervals)
  const spread = maxInterval / minInterval
  return { minInterval, maxInterval, spread, uniform: spread <= tolerance }
}
