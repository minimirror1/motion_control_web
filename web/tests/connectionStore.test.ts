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

vi.mock('roslib', () => ({
  Ros: MockRos,
  Topic: MockTopic,
}))

const { useConnectionStore } = await import('../src/store/connectionStore')

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({ connected: false, ros: null, robotState: null })
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
})
