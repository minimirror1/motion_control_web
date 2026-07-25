// rosbridge_library base64-encodes byte-typed ROS array fields (uint8[],
// int8[], char[]) instead of sending them as plain JSON number arrays -
// verified against motion_control_msgs/RobotState.state (uint8[]) on the
// wire. Anything else added here that reads a uint8[]/int8[] field (e.g.
// MotorStatus.number_of_target_interfaces, controller_index) needs the same
// decode.
export function decodeByteArray(value: string | number[]): number[] {
  if (Array.isArray(value)) {
    return value
  }
  const binary = atob(value)
  return Array.from(binary, (char) => char.charCodeAt(0))
}
