import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event?: unknown) => void

class MockRos {
  private handlers: Record<string, Handler[]> = {}
  on(event: string, cb: Handler) {
    this.handlers[event] = this.handlers[event] ?? []
    this.handlers[event].push(cb)
  }
  emit(event: string) {
    ;(this.handlers[event] ?? []).forEach((cb) => cb())
  }
  close() {}
}

class MockTopic {
  subscribe() {}
  unsubscribe() {}
  publish() {}
}

class MockService {
  static instances: Array<{
    options: { name: string; serviceType: string }
    request: unknown
    respond: ((response: unknown) => void) | null
  }> = []

  private record: (typeof MockService.instances)[number]

  constructor(options: { name: string; serviceType: string }) {
    this.record = { options, request: null, respond: null }
    MockService.instances.push(this.record)
  }

  callService(request: unknown, callback: (response: unknown) => void) {
    this.record.request = request
    this.record.respond = callback
  }
}

vi.mock('roslib', () => ({
  Ros: MockRos,
  Topic: MockTopic,
  Service: MockService,
}))

const { useConnectionStore } = await import('../src/store/connectionStore')
const { listMotorTemplates, getMotorConfigYaml, setMotorConfigYaml } = await import(
  '../src/lib/motorSettingsServices'
)

describe('motorSettingsServices', () => {
  beforeEach(() => {
    MockService.instances = []
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      motorConfig: null,
      controlCommandTopic: null,
    })
    useConnectionStore.getState().connect()
    const ros = useConnectionStore.getState().ros as unknown as MockRos
    ros.emit('connection')
  })

  it('listMotorTemplates calls the expected service and resolves', async () => {
    const pending = listMotorTemplates()

    expect(MockService.instances[0].options).toEqual({
      ros: useConnectionStore.getState().ros,
      name: 'motion_control_web/list_motor_templates',
      serviceType: 'motion_control_msgs/srv/ListMotorTemplates',
    })
    const response = { success: true, message: 'ok', templates: ['example_a.yaml'] }
    MockService.instances[0].respond?.(response)
    await expect(pending).resolves.toEqual(response)
  })

  it('getMotorConfigYaml sends the source and calls the expected service', async () => {
    const pending = getMotorConfigYaml('active')

    expect(MockService.instances[0].options).toEqual({
      ros: useConnectionStore.getState().ros,
      name: 'motion_control_web/get_motor_config_yaml',
      serviceType: 'motion_control_msgs/srv/GetMotorConfigYaml',
    })
    expect(MockService.instances[0].request).toEqual({ source: 'active' })
    const response = {
      success: true,
      message: 'ok',
      yaml_text: 'masters: []\ndrivers: []\n',
      source_path: 'active_motor_manager.yaml',
    }
    MockService.instances[0].respond?.(response)
    await expect(pending).resolves.toEqual(response)
  })

  it('setMotorConfigYaml sends yaml_text and calls the expected service', async () => {
    const pending = setMotorConfigYaml('masters: []\ndrivers: []\n')

    expect(MockService.instances[0].options).toEqual({
      ros: useConnectionStore.getState().ros,
      name: 'motion_control_web/set_motor_config_yaml',
      serviceType: 'motion_control_msgs/srv/SetMotorConfigYaml',
    })
    expect(MockService.instances[0].request).toEqual({ yaml_text: 'masters: []\ndrivers: []\n' })
    const response = { success: true, message: 'ok' }
    MockService.instances[0].respond?.(response)
    await expect(pending).resolves.toEqual(response)
  })
})
