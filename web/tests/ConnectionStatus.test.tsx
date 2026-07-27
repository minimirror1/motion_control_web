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
    expect(screen.getByTestId('connection-status')).toHaveAccessibleName('ROS 연결 끊김')
  })

  it('does not render the raw robot state payload', () => {
    useConnectionStore.setState({
      robotState: {
        selected_robot_index: 0,
        robot_index: [0],
        state: [1],
        progress: [0],
      },
    })

    render(<ConnectionStatus />)

    expect(screen.queryByTestId('robot-state')).not.toBeInTheDocument()
    expect(screen.queryByText(/selected_robot_index/)).not.toBeInTheDocument()
  })
})
