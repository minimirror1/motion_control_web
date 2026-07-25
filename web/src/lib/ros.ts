import { Ros } from 'roslib'

export const ROSBRIDGE_URL = import.meta.env.VITE_ROSBRIDGE_URL ?? 'ws://localhost:9090'

export function createRosConnection(
  onConnected: () => void,
  onDisconnected: () => void,
  onError: (event: unknown) => void,
): Ros {
  const ros = new Ros({ url: ROSBRIDGE_URL })
  ros.on('connection', onConnected)
  ros.on('close', onDisconnected)
  ros.on('error', onError)
  return ros
}
