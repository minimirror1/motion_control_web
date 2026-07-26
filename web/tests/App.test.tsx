import { fireEvent, render, screen } from '@testing-library/react'
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
  Service: class {},
}))

const { default: App } = await import('../src/App')
const { useConnectionStore } = await import('../src/store/connectionStore')

describe('App', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      motorConfig: null,
      controlCommandTopic: null,
    })
  })

  it('defaults to the dashboard tab', () => {
    render(<App />)

    expect(screen.getByTestId('connection-status')).toBeInTheDocument()
    expect(screen.getByText('모터 상태')).toBeInTheDocument()
    expect(screen.queryByText('모터 설정 마법사')).not.toBeInTheDocument()
  })

  it('switches to the motor settings tab while keeping ConnectionStatus visible', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('app-tab-motor-settings'))

    expect(screen.getByTestId('connection-status')).toBeInTheDocument()
    expect(screen.queryByText('모터 상태')).not.toBeInTheDocument()
    expect(screen.getByText('ROS 연결 후 사용할 수 있습니다.')).toBeInTheDocument()
  })
})
