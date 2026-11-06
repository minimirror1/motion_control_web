import { useConnectionStore } from '../store/connectionStore'

const SCHEDULE_NODE = '/schedule_node'

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

export const DAY_LABELS: Record<Day, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
}

export interface DaySchedule {
  enabled: boolean
  open: string
  close: string
}

export interface Range {
  min: number
  max: number
}

/** Mirrors motion_control_web/schedule_logic.py validate_config(). */
export interface ScheduleConfig {
  enabled: boolean
  week: Record<Day, DaySchedule>
  playlist: string[]
  motions_per_rest: Range
  rest_sec: Range
  overheat: { limit_c: number; resume_c: number; recheck_sec: number }
}

export type StepKind =
  | 'motion'
  | 'rest'
  | 'cooling'
  | 'closed'
  | 'disabled'
  | 'error'
  | 'open'
  | 'close'

/** One entry of the schedule timeline; times are robot-local ISO strings. */
export interface TimelineStep {
  kind: StepKind
  label: string
  detail: string
  start?: string | null
  end?: string
}

export interface MotionProgress {
  name: string
  /** 0..1 */
  progress: number
  elapsed_sec: number
  duration_sec: number
}

/** JSON published on motion_control_web/schedule_status by schedule_node. */
export interface ScheduleStatus {
  phase: string
  enabled: boolean
  open_now: boolean
  now: string
  timezone: string
  active_motion: string | null
  motions_left: number
  rest_remaining_sec: number | null
  overheated: boolean
  temperatures: number[]
  motor_ids: number[]
  last_log: { timestamp: string; event: string; temperatures: number[] } | null
  last_error: string
  motion?: MotionProgress | null
  timeline?: { past: TimelineStep[]; current: TimelineStep | null; future: TimelineStep[] }
}

export const PHASE_LABELS: Record<string, string> = {
  disabled: '스케줄 꺼짐',
  waiting: '상태 대기 중',
  closed: '영업시간 외 (토크 OFF)',
  enabling: '토크 켜는 중',
  selecting: '모션 준비 중',
  playing: '모션 재생 중',
  stopping: '모션 정지 중',
  disabling: '토크 끄는 중',
  resting: '휴게 중 (토크 OFF)',
  cooling: '과열 냉각 대기 (토크 OFF)',
  error: '오류 - 30초 후 재시도',
}

interface TriggerResponse {
  success: boolean
  message: string
}

function call<TResponse>(name: string, serviceType: string, request: object) {
  return useConnectionStore
    .getState()
    .callService<object, TResponse>(`${SCHEDULE_NODE}/${name}`, serviceType, request)
}

export async function getSchedule(): Promise<{ config: ScheduleConfig; timezone: string }> {
  const response = await call<
    TriggerResponse & { schedule_json: string; timezone: string }
  >('get_schedule', 'motion_control_msgs/srv/GetSchedule', {})
  if (!response.success) {
    throw new Error(response.message)
  }
  return { config: JSON.parse(response.schedule_json), timezone: response.timezone }
}

export async function setSchedule(config: ScheduleConfig): Promise<void> {
  const response = await call<TriggerResponse>(
    'set_schedule',
    'motion_control_msgs/srv/SetSchedule',
    { schedule_json: JSON.stringify(config) },
  )
  if (!response.success) {
    throw new Error(response.message)
  }
}

export async function listTemperatureLogs(): Promise<string[]> {
  const response = await call<TriggerResponse & { dates: string[] }>(
    'list_temperature_logs',
    'motion_control_msgs/srv/ListTemperatureLogs',
    {},
  )
  if (!response.success) {
    throw new Error(response.message)
  }
  return response.dates
}

export async function getTemperatureLog(date: string): Promise<string> {
  const response = await call<TriggerResponse & { csv_text: string }>(
    'get_temperature_log',
    'motion_control_msgs/srv/GetTemperatureLog',
    { date },
  )
  if (!response.success) {
    throw new Error(response.message)
  }
  return response.csv_text
}

export interface TemperatureSeries {
  motors: string[]
  /** Unix seconds per row. */
  time: number[]
  events: string[]
  /** values[motor][row] */
  values: number[][]
}

/** Parses the per-day CSV written by temperature_log.py. */
export function parseTemperatureCsv(text: string): TemperatureSeries {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) {
    return { motors: [], time: [], events: [], values: [] }
  }
  const motors = lines[0].split(',').slice(2)
  const series: TemperatureSeries = {
    motors,
    time: [],
    events: [],
    values: motors.map(() => []),
  }
  for (const line of lines.slice(1)) {
    const cells = line.split(',')
    const seconds = Date.parse(cells[0]) / 1000
    if (!Number.isFinite(seconds)) {
      continue
    }
    series.time.push(seconds)
    series.events.push(cells[1] ?? '')
    motors.forEach((_, i) => {
      const value = Number(cells[i + 2])
      series.values[i].push(Number.isFinite(value) ? value : NaN)
    })
  }
  return series
}
