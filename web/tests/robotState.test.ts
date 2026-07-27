import { describe, expect, it } from 'vitest'
import {
  allRobotsStopped,
  isAnyRobotOperating,
  robotStateLabel,
  ROBOT_STATE,
  selectedRobot,
} from '../src/lib/robotState'

const twoRobots = {
  selected_robot_index: 7,
  robot_index: [3, 7],
  state: [ROBOT_STATE.STOPPED, ROBOT_STATE.OPERATING],
  progress: [0.0, 0.42],
}

describe('robotStateLabel', () => {
  it('decodes every RobotState constant', () => {
    expect(robotStateLabel(ROBOT_STATE.HOMING)).toBe('홈 복귀 중')
    expect(robotStateLabel(ROBOT_STATE.STOPPED)).toBe('정지')
    expect(robotStateLabel(ROBOT_STATE.OPERATING)).toBe('동작 중')
    expect(robotStateLabel(ROBOT_STATE.INVALID)).toBe('오류')
  })

  it('falls back for null and unknown values', () => {
    expect(robotStateLabel(null)).toBe('상태 대기 중')
    expect(robotStateLabel(9)).toBe('알 수 없음 (9)')
  })
})

describe('selectedRobot', () => {
  it('resolves selected_robot_index as a robot_index value, not a position', () => {
    expect(selectedRobot(twoRobots)).toEqual({
      state: ROBOT_STATE.OPERATING,
      progress: 0.42,
    })
  })

  it('returns nulls when there is no state or the selection is missing', () => {
    expect(selectedRobot(null)).toEqual({ state: null, progress: null })
    expect(selectedRobot({ ...twoRobots, selected_robot_index: 99 })).toEqual({
      state: null,
      progress: null,
    })
  })
})

describe('allRobotsStopped', () => {
  it('is true only when every robot reports STOPPED', () => {
    expect(allRobotsStopped({ ...twoRobots, state: [1, 1] })).toBe(true)
    expect(allRobotsStopped(twoRobots)).toBe(false)
  })

  it('is false when the state is unknown or empty', () => {
    expect(allRobotsStopped(null)).toBe(false)
    expect(allRobotsStopped({ ...twoRobots, state: [] })).toBe(false)
  })
})

describe('isAnyRobotOperating', () => {
  it('counts HOMING as moving', () => {
    expect(isAnyRobotOperating({ ...twoRobots, state: [1, ROBOT_STATE.HOMING] })).toBe(
      true,
    )
    expect(isAnyRobotOperating({ ...twoRobots, state: [1, 1] })).toBe(false)
  })

  // No robot_manager running (mock_dev) must not lock the UI.
  it('is false when there is no robot state at all', () => {
    expect(isAnyRobotOperating(null)).toBe(false)
  })
})
