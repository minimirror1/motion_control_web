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
  static published: unknown[] = []
  subscribe() {}
  unsubscribe() {}
  publish(message: unknown) {
    MockTopic.published.push(message)
  }
}

class MockService {
  static instances: Array<{
    options: { name: string; serviceType: string }
    respond: ((response: unknown) => void) | null
    fail: ((error: string) => void) | null
  }> = []

  private record: (typeof MockService.instances)[number]

  constructor(options: { name: string; serviceType: string }) {
    this.record = { options, respond: null, fail: null }
    MockService.instances.push(this.record)
  }

  callService(
    _request: unknown,
    callback: (response: unknown) => void,
    failedCallback?: (error: string) => void,
  ) {
    this.record.respond = callback
    this.record.fail = failedCallback ?? null
  }
}

vi.mock('roslib', () => ({
  Ros: MockRos,
  Topic: MockTopic,
  Service: MockService,
}))

const {
  CONTROL_COMMAND,
  useConnectionStore,
} = await import('../src/store/connectionStore')

describe('connectionStore', () => {
  beforeEach(() => {
    MockTopic.published = []
    MockService.instances = []
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      controlCommandTopic: null,
    })
  })

  it('starts disconnected', () => {
    expect(useConnectionStore.getState().connected).toBe(false)
  })

  it('becomes connected once the underlying ros "connection" event fires', () => {
    useConnectionStore.getState().connect()
    const ros = useConnectionStore.getState().ros as unknown as MockRos
    ros.emit('connection')
    expect(useConnectionStore.getState().connected).toBe(true)
  })

  it('becomes disconnected once the underlying ros "close" event fires', () => {
    useConnectionStore.getState().connect()
    const ros = useConnectionStore.getState().ros as unknown as MockRos
    ros.emit('connection')
    ros.emit('close')
    expect(useConnectionStore.getState().connected).toBe(false)
  })

  it('publishes an allowlisted control command while connected', () => {
    useConnectionStore.getState().connect()
    const ros = useConnectionStore.getState().ros as unknown as MockRos
    ros.emit('connection')

    const sent = useConnectionStore
      .getState()
      .sendControlCommand(CONTROL_COMMAND.STOP_MOTION)

    expect(sent).toBe(true)
    expect(MockTopic.published).toEqual([{ data: 3 }])
  })

  it('rejects a service call while disconnected', async () => {
    await expect(
      useConnectionStore
        .getState()
        .callService('/x/trigger', 'std_srvs/srv/Trigger', {}),
    ).rejects.toThrow('ROS is not connected.')
    expect(MockService.instances).toHaveLength(0)
  })

  it('constructs the service with the given name and type and resolves', async () => {
    useConnectionStore.getState().connect()
    const ros = useConnectionStore.getState().ros as unknown as MockRos
    ros.emit('connection')

    const pending = useConnectionStore
      .getState()
      .callService('/teach/start_recording', 'motion_control_msgs/srv/StartRecording', {
        file_name: 'a',
      })

    expect(MockService.instances).toHaveLength(1)
    expect(MockService.instances[0].options).toEqual({
      ros: useConnectionStore.getState().ros,
      name: '/teach/start_recording',
      serviceType: 'motion_control_msgs/srv/StartRecording',
    })

    MockService.instances[0].respond?.({ success: true, message: 'ok' })
    await expect(pending).resolves.toEqual({ success: true, message: 'ok' })
  })

  it('rejects when the rosbridge failedCallback fires', async () => {
    useConnectionStore.getState().connect()
    const ros = useConnectionStore.getState().ros as unknown as MockRos
    ros.emit('connection')

    const pending = useConnectionStore
      .getState()
      .callService('/x/trigger', 'std_srvs/srv/Trigger', {})

    MockService.instances[0].fail?.('service unavailable')
    await expect(pending).rejects.toThrow('service unavailable')
  })
})
