import { jointLimits, jointsAtLimit } from './jointLimits'
import type { MotorConfigEntry } from './motorConfig'
import { isMotorEnabled } from './motorStatus'
import { isAnyRobotOperating } from './robotState'
import type { MotorStatus, RobotState } from '../store/connectionStore'

/** `warn` is advisory - only `fail` blocks recording. */
export type CheckLevel = 'ok' | 'warn' | 'fail'

export interface ReadinessCheck {
  id: string
  label: string
  level: CheckLevel
  detail: string
}

export interface ReadinessInput {
  connected: boolean
  robotState: RobotState | null
  motorStatus: MotorStatus | null
  motorConfig: MotorConfigEntry[] | null
}

export function readinessChecks({
  connected,
  robotState,
  motorStatus,
  motorConfig,
}: ReadinessInput): ReadinessCheck[] {
  const statusword = motorStatus?.statusword ?? []
  const enabled = statusword.filter(isMotorEnabled).length
  const faults = (motorStatus?.errorcode ?? []).filter((code) => code !== 0)
  const atLimit = jointsAtLimit(jointLimits(motorStatus, motorConfig))

  return [
    {
      id: 'connection',
      label: 'ROS 연결',
      level: connected ? 'ok' : 'fail',
      detail: connected ? '연결됨' : 'rosbridge에 연결되지 않았습니다.',
    },
    {
      id: 'robot-stopped',
      label: '로봇 정지',
      // No robot_manager on the graph (mock_dev) leaves this unknown rather than
      // blocking the operator.
      level: isAnyRobotOperating(robotState)
        ? 'fail'
        : robotState
          ? 'ok'
          : 'warn',
      detail: isAnyRobotOperating(robotState)
        ? '재생 중입니다. 먼저 정지하세요.'
        : robotState
          ? '정지 상태'
          : '로봇 상태를 수신하지 못했습니다.',
    },
    {
      id: 'motor-status',
      label: '모터 상태 수신',
      level: statusword.length > 0 ? 'ok' : 'fail',
      detail:
        statusword.length > 0
          ? `${statusword.length}축 수신 중`
          : 'motor_status가 도착하지 않았습니다.',
    },
    {
      id: 'torque-off',
      label: '토크 해제',
      level: statusword.length === 0 ? 'warn' : enabled === 0 ? 'ok' : 'warn',
      detail:
        statusword.length === 0
          ? '확인 불가'
          : enabled === 0
            ? '핸드 가이딩 가능'
            : `${enabled}축이 아직 인가되어 있어 손으로 움직일 수 없습니다.`,
    },
    {
      id: 'no-faults',
      label: '결함 없음',
      level: faults.length === 0 ? 'ok' : 'fail',
      detail:
        faults.length === 0 ? '정상' : `${faults.length}축에서 오류 코드가 보고됨`,
    },
    {
      id: 'joint-limits',
      label: '관절 한계 여유',
      level: atLimit.length === 0 ? 'ok' : 'warn',
      detail:
        atLimit.length === 0
          ? '여유 있음'
          : `한계 근처: ${atLimit.map((joint) => `J${joint.controllerIndex}`).join(', ')}`,
    },
  ]
}

export function isReadyToRecord(checks: ReadinessCheck[]): boolean {
  return checks.every((check) => check.level !== 'fail')
}
