import type { RobotState } from '../store/connectionStore'

// motion_control_msgs/RobotState constants.
export const ROBOT_STATE = {
  HOMING: 0,
  STOPPED: 1,
  OPERATING: 2,
  INVALID: 3,
} as const

const STATE_LABELS: Record<number, string> = {
  [ROBOT_STATE.HOMING]: '홈 복귀 중',
  [ROBOT_STATE.STOPPED]: '정지',
  [ROBOT_STATE.OPERATING]: '동작 중',
  [ROBOT_STATE.INVALID]: '오류',
}

export function robotStateLabel(state: number | null): string {
  if (state === null) {
    return '상태 대기 중'
  }
  return STATE_LABELS[state] ?? `알 수 없음 (${state})`
}

export interface SelectedRobot {
  state: number | null
  progress: number | null
}

// `selected_robot_index` carries a robot_index value, not a position in the
// parallel arrays - see robot_manager_node.py.
export function selectedRobot(robotState: RobotState | null): SelectedRobot {
  if (!robotState) {
    return { state: null, progress: null }
  }
  const position = robotState.robot_index.indexOf(robotState.selected_robot_index)
  if (position < 0) {
    return { state: null, progress: null }
  }
  return {
    state: robotState.state[position] ?? null,
    progress: robotState.progress[position] ?? null,
  }
}

// robot_manager_node refuses reload_config unless every robot is stopped, so the
// UI gates saves on the same condition instead of surfacing a late failure.
export function allRobotsStopped(robotState: RobotState | null): boolean {
  if (!robotState || robotState.state.length === 0) {
    return false
  }
  return robotState.state.every((state) => state === ROBOT_STATE.STOPPED)
}

export function isAnyRobotOperating(robotState: RobotState | null): boolean {
  return (robotState?.state ?? []).some(
    (state) => state === ROBOT_STATE.OPERATING || state === ROBOT_STATE.HOMING,
  )
}
