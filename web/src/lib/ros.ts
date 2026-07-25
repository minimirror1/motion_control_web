import { Ros } from 'roslib'

// Falls back to whatever host/protocol the browser used to load this page
// (same-origin, just swapped to ws/wss on the rosbridge port) so the robot's
// LAN IP can change without needing a rebuild. VITE_ROSBRIDGE_URL still wins
// when set, e.g. `npm run dev` on a laptop pointed at the robot over LAN.
function defaultRosbridgeUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.hostname || 'localhost'
  return `${protocol}://${host}:9090`
}

export const ROSBRIDGE_URL = import.meta.env.VITE_ROSBRIDGE_URL ?? defaultRosbridgeUrl()

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
