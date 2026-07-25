import { Ros, Topic } from 'roslib'
import { create } from 'zustand'
import { createRosConnection } from '../lib/ros'
import { decodeByteArray } from '../lib/rosbridgeCodec'

export interface RobotState {
  selected_robot_index: number
  robot_index: number[]
  state: number[]
  progress: number[]
}

// Wire shape from rosbridge: `state` (uint8[]) arrives base64-encoded, see
// lib/rosbridgeCodec.ts.
type RobotStateWireMessage = Omit<RobotState, 'state'> & { state: string | number[] }

interface ConnectionStore {
  connected: boolean
  ros: Ros | null
  robotState: RobotState | null
  connect: () => void
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connected: false,
  ros: null,
  robotState: null,
  connect: () => {
    if (get().ros) {
      return
    }

    const ros = createRosConnection(
      () => set({ connected: true }),
      () => set({ connected: false }),
      () => set({ connected: false }),
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

    set({ ros })
  },
}))
