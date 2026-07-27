import type { GetMotionDataResponse } from './motionData'
import { useConnectionStore } from '../store/connectionStore'

const TEACH_NODE = '/motion_control_teach_node'
const ROBOT_NODE = '/robot_manager_node'

export interface TriggerResponse {
  success: boolean
  message: string
}

export interface StartRecordingResponse extends TriggerResponse {
  file_name: string
}

export interface StopRecordingResponse extends TriggerResponse {
  file_name: string
  duration: number
}

export interface ListMotionFilesResponse extends TriggerResponse {
  files: string[]
  active_file: string
}

function call<TRequest extends object, TResponse>(
  name: string,
  serviceType: string,
  request: TRequest,
): Promise<TResponse> {
  return useConnectionStore.getState().callService(name, serviceType, request)
}

export function torqueOff(): Promise<TriggerResponse> {
  return call(`${TEACH_NODE}/torque_off`, 'std_srvs/srv/Trigger', {})
}

export function torqueOn(): Promise<TriggerResponse> {
  return call(`${TEACH_NODE}/torque_on`, 'std_srvs/srv/Trigger', {})
}

export function startRecording(fileName: string): Promise<StartRecordingResponse> {
  return call(
    `${TEACH_NODE}/start_recording`,
    'motion_control_msgs/srv/StartRecording',
    { file_name: fileName },
  )
}

export function stopRecording(): Promise<StopRecordingResponse> {
  return call(
    `${TEACH_NODE}/stop_recording`,
    'motion_control_msgs/srv/StopRecording',
    {},
  )
}

export function listMotionFiles(): Promise<ListMotionFilesResponse> {
  return call(
    `${TEACH_NODE}/list_motion_files`,
    'motion_control_msgs/srv/ListMotionFiles',
    {},
  )
}

export function setActiveMotion(fileName: string): Promise<TriggerResponse> {
  return call(
    `${TEACH_NODE}/set_active_motion`,
    'motion_control_msgs/srv/SetActiveMotion',
    { file_name: fileName },
  )
}

export interface RenameMotionFileResponse extends TriggerResponse {
  resolved_name: string
}

export function getMotionData(
  fileName: string,
  maxSamples: number,
): Promise<GetMotionDataResponse> {
  return call(`${TEACH_NODE}/get_motion_data`, 'motion_control_msgs/srv/GetMotionData', {
    file_name: fileName,
    max_samples: maxSamples,
  })
}

export function deleteMotionFile(fileName: string): Promise<TriggerResponse> {
  return call(
    `${TEACH_NODE}/delete_motion_file`,
    'motion_control_msgs/srv/DeleteMotionFile',
    { file_name: fileName },
  )
}

export function renameMotionFile(
  fileName: string,
  newName: string,
): Promise<RenameMotionFileResponse> {
  return call(
    `${TEACH_NODE}/rename_motion_file`,
    'motion_control_msgs/srv/RenameMotionFile',
    { file_name: fileName, new_name: newName },
  )
}

export function setMoveDuration(duration: number): Promise<TriggerResponse> {
  return call(
    `${TEACH_NODE}/set_move_duration`,
    'motion_control_msgs/srv/SetMoveDuration',
    { duration },
  )
}

export function reloadConfig(): Promise<TriggerResponse> {
  return call(`${ROBOT_NODE}/reload_config`, 'std_srvs/srv/Trigger', {})
}
