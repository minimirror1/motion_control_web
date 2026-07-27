import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
  Service: class {},
}))

const { SafetyStrip } = await import('../src/components/teach/SafetyStrip')
const { useConnectionStore } = await import('../src/store/connectionStore')

function motorStatus(statusword: number[], errorcode: number[]) {
  return {
    controller_index: statusword.map((_, i) => i),
    controlword: statusword.map(() => 0),
    statusword,
    errorcode,
    encoder: statusword.map(() => 0),
    position: statusword.map(() => 0),
    velocity: statusword.map(() => 0),
    effort: statusword.map(() => 0),
  }
}

describe('SafetyStrip', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      controlCommandTopic: null,
    })
  })

  it('reports disconnection and waits for status', () => {
    render(<SafetyStrip />)

    expect(screen.getByTestId('teach-safety-strip')).toHaveTextContent('연결: 끊김')
    expect(screen.getByTestId('teach-safety-strip')).toHaveTextContent(
      '토크: 상태 대기 중',
    )
    expect(screen.getByTestId('teach-emergency-stop')).toBeDisabled()
  })

  it('reports torque released when no motor is enabled', () => {
    useConnectionStore.setState({
      connected: true,
      motorStatus: motorStatus([0, 0, 0], [0, 0, 0]),
    })
    render(<SafetyStrip />)

    expect(screen.getByTestId('teach-safety-strip')).toHaveTextContent('토크: 해제 (3축)')
    expect(screen.getByTestId('teach-safety-strip')).not.toHaveTextContent('결함')
  })

  it('counts faulted motors', () => {
    useConnectionStore.setState({
      connected: true,
      motorStatus: motorStatus([0x0027, 0x0027], [0, 5]),
    })
    render(<SafetyStrip />)

    expect(screen.getByTestId('teach-safety-strip')).toHaveTextContent('토크: 전체 인가')
    expect(screen.getByTestId('teach-safety-strip')).toHaveTextContent('결함: 1축')
  })

  it('sends STOP_MOTION from the stop button', () => {
    const sendControlCommand = vi.fn(() => true)
    useConnectionStore.setState({ connected: true, sendControlCommand })
    render(<SafetyStrip />)

    fireEvent.click(screen.getByTestId('teach-emergency-stop'))

    expect(sendControlCommand).toHaveBeenCalledWith(3)
  })
})
