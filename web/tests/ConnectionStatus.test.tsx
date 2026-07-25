import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class MockRos {
  on() {}
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

const { ConnectionStatus } = await import('../src/components/ConnectionStatus')
const { useConnectionStore } = await import('../src/store/connectionStore')

describe('ConnectionStatus', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      controlCommandTopic: null,
    })
  })

  it('renders a disconnected status by default', () => {
    render(<ConnectionStatus />)
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected')
  })
})
