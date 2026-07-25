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

vi.mock('roslib', () => ({
  Ros: MockRos,
  Topic: MockTopic,
}))

const {
  CONTROL_COMMAND,
  useConnectionStore,
} = await import('../src/store/connectionStore')

describe('connectionStore', () => {
  beforeEach(() => {
    MockTopic.published = []
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
})
