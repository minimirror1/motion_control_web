import { useConnectionStore } from '../store/connectionStore'

const GATEWAY = 'motion_control_web'

export interface ListMotorTemplatesResponse {
  success: boolean
  message: string
  templates: string[]
}

export interface GetMotorConfigYamlResponse {
  success: boolean
  message: string
  yaml_text: string
  source_path: string
}

export interface SetMotorConfigYamlResponse {
  success: boolean
  message: string
}

function call<TRequest extends object, TResponse>(
  name: string,
  serviceType: string,
  request: TRequest,
): Promise<TResponse> {
  return useConnectionStore.getState().callService(name, serviceType, request)
}

export function listMotorTemplates(): Promise<ListMotorTemplatesResponse> {
  return call(
    `${GATEWAY}/list_motor_templates`,
    'motion_control_msgs/srv/ListMotorTemplates',
    {},
  )
}

export function getMotorConfigYaml(source: string): Promise<GetMotorConfigYamlResponse> {
  return call(
    `${GATEWAY}/get_motor_config_yaml`,
    'motion_control_msgs/srv/GetMotorConfigYaml',
    { source },
  )
}

export function setMotorConfigYaml(yamlText: string): Promise<SetMotorConfigYamlResponse> {
  return call(
    `${GATEWAY}/set_motor_config_yaml`,
    'motion_control_msgs/srv/SetMotorConfigYaml',
    { yaml_text: yamlText },
  )
}
