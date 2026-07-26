import { decodeByteArray } from './rosbridgeCodec'

export interface MotorConfigEntry {
  controllerIndex: number
  lower: number
  upper: number
  speed: number
  gearRatio: number
  ratedEffort: number
  motorType: string
}

// Wire shape from rosbridge for motion_control_msgs/srv/GetMotorConfig's
// response: controller_index is uint8[], base64-encoded like
// MotorStatus.controller_index (see rosbridgeCodec.ts) - everything else is a
// plain JSON array.
export interface GetMotorConfigResponse {
  success: boolean
  message: string
  controller_index: string | number[]
  lower: number[]
  upper: number[]
  speed: number[]
  gear_ratio: number[]
  rated_effort: number[]
  motor_type: string[]
}

export function parseMotorConfigResponse(
  response: GetMotorConfigResponse,
): MotorConfigEntry[] {
  return decodeByteArray(response.controller_index).map((controllerIndex, i) => ({
    controllerIndex,
    lower: response.lower[i],
    upper: response.upper[i],
    speed: response.speed[i],
    gearRatio: response.gear_ratio[i],
    ratedEffort: response.rated_effort[i],
    motorType: response.motor_type[i],
  }))
}

export function findMotorConfig(
  entries: MotorConfigEntry[] | null,
  controllerIndex: number,
): MotorConfigEntry | undefined {
  return entries?.find((entry) => entry.controllerIndex === controllerIndex)
}
