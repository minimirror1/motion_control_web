import { Ros, Service, Topic } from 'roslib'
import { create } from 'zustand'
import { createRosConnection } from '../lib/ros'
import { decodeByteArray } from '../lib/rosbridgeCodec'
import {
  parseMotorConfigResponse,
  type GetMotorConfigResponse,
  type MotorConfigEntry,
} from '../lib/motorConfig'

export interface RobotState {
  selected_robot_index: number
  robot_index: number[]
  state: number[]
  progress: number[]
}

export interface MotorStatus {
  controller_index: number[]
  controlword: number[]
  statusword: number[]
  errorcode: number[]
  encoder: number[]
  position: number[]
  velocity: number[]
  effort: number[]
}

// Wire shape from rosbridge: `state` (uint8[]) arrives base64-encoded, see
// lib/rosbridgeCodec.ts.
type RobotStateWireMessage = Omit<RobotState, 'state'> & { state: string | number[] }
type MotorStatusWireMessage = Omit<MotorStatus, 'controller_index'> & {
  controller_index: string | number[]
}

interface UInt8Message {
  data: number
}

export const CONTROL_COMMAND = {
  ENABLE_MOTORS: 1,
  PLAY_MOTION: 2,
  STOP_MOTION: 3,
  HOME: 4,
  DISABLE_MOTORS: 5,
} as const

export type ControlCommand =
  (typeof CONTROL_COMMAND)[keyof typeof CONTROL_COMMAND]

const SERVICE_CALL_TIMEOUT_MS = 10_000

interface ConnectionStore {
  connected: boolean
  ros: Ros | null
  robotState: RobotState | null
  motorStatus: MotorStatus | null
  motorConfig: MotorConfigEntry[] | null
  controlCommandTopic: Topic<UInt8Message> | null
  connect: () => void
  sendControlCommand: (command: ControlCommand) => boolean
  fetchMotorConfig: () => Promise<void>
  callService: <TRequest extends object, TResponse>(
    name: string,
    serviceType: string,
    request: TRequest,
  ) => Promise<TResponse>
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connected: false,
  ros: null,
  robotState: null,
  motorStatus: null,
  motorConfig: null,
  controlCommandTopic: null,
  connect: () => {
    if (get().ros) {
      return
    }

    const ros = createRosConnection(
      () => set({ connected: true }),
      () => set({ connected: false, motorStatus: null }),
      () => set({ connected: false, motorStatus: null }),
    )

    // motion_control/robot_state (motion_control_robot/robot_manager_node.py) is
    // published BEST_EFFORT/KEEP_LAST(1)/VOLATILE - if messages don't arrive,
    // check rosbridge's subscribe QoS options.
    const robotStateTopic = new Topic<RobotStateWireMessage>({
      ros,
      name: 'motion_control/robot_state',
      messageType: 'motion_control_msgs/RobotState',
    })
    robotStateTopic.subscribe((message) =>
      set({ robotState: { ...message, state: decodeByteArray(message.state) } }),
    )

    const motorStatusTopic = new Topic<MotorStatusWireMessage>({
      ros,
      name: 'motion_control/motor_status',
      messageType: 'motion_control_msgs/MotorStatus',
    })
    motorStatusTopic.subscribe((message) =>
      set({
        motorStatus: {
          controller_index: decodeByteArray(message.controller_index),
          controlword: message.controlword,
          statusword: message.statusword,
          errorcode: message.errorcode,
          encoder: message.encoder,
          position: message.position,
          velocity: message.velocity,
          effort: message.effort,
        },
      }),
    )

    const controlCommandTopic = new Topic<UInt8Message>({
      ros,
      name: 'motion_control_web/control_command',
      messageType: 'std_msgs/UInt8',
    })

    set({ ros, controlCommandTopic })
  },
  sendControlCommand: (command) => {
    const { connected, controlCommandTopic } = get()
    if (!connected || !controlCommandTopic) {
      return false
    }

    controlCommandTopic.publish({ data: command })
    return true
  },
  fetchMotorConfig: async () => {
    try {
      const response = await get().callService<object, GetMotorConfigResponse>(
        'motion_control_web/get_motor_config',
        'motion_control_msgs/srv/GetMotorConfig',
        {},
      )
      if (!response.success) {
        console.error(`get_motor_config failed: ${response.message}`)
        return
      }
      set({ motorConfig: parseMotorConfigResponse(response) })
    } catch (error) {
      console.error('fetchMotorConfig failed', error)
    }
  },
  callService: <TRequest extends object, TResponse>(
    name: string,
    serviceType: string,
    request: TRequest,
  ) => {
    const { connected, ros } = get()
    if (!connected || !ros) {
      return Promise.reject(new Error('ROS is not connected.'))
    }

    const service = new Service<TRequest, TResponse>({ ros, name, serviceType })
    return new Promise<TResponse>((resolve, reject) => {
      // rosbridge stays silent when the target node is down - fail on our own.
      const timeout = setTimeout(
        () => reject(new Error(`Service call timed out: ${name}`)),
        SERVICE_CALL_TIMEOUT_MS,
      )
      service.callService(
        request,
        (response) => {
          clearTimeout(timeout)
          resolve(response)
        },
        (error) => {
          clearTimeout(timeout)
          reject(new Error(error))
        },
      )
    })
  },
}))
