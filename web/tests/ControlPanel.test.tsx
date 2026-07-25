import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
}))

const { ControlPanel } = await import('../src/components/ControlPanel')
const {
  CONTROL_COMMAND,
  useConnectionStore,
} = await import('../src/store/connectionStore')

describe('ControlPanel', () => {
  const sendControlCommand = vi.fn(() => true)

  beforeEach(() => {
    sendControlCommand.mockClear()
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      controlCommandTopic: null,
      sendControlCommand,
    })
  })

  it('disables all commands while disconnected', () => {
    render(<ControlPanel />)

    expect(screen.getByRole('button', { name: '모터 활성화' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '모션 재생' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '중지' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Home' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '모터 비활성화' })).toBeDisabled()
    expect(screen.getByTestId('motor-power-state')).toHaveTextContent(
      '모터: 확인 불가',
    )
  })

  it.each([
    ['모터 활성화', CONTROL_COMMAND.ENABLE_MOTORS],
    ['모션 재생', CONTROL_COMMAND.PLAY_MOTION],
    ['중지', CONTROL_COMMAND.STOP_MOTION],
    ['Home', CONTROL_COMMAND.HOME],
    ['모터 비활성화', CONTROL_COMMAND.DISABLE_MOTORS],
  ])('publishes the %s command', (label, command) => {
    useConnectionStore.setState({ connected: true })
    render(<ControlPanel />)

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(sendControlCommand).toHaveBeenCalledWith(command)
    expect(screen.getByTestId('control-feedback')).toHaveTextContent(
      `${label} 명령 전송됨`,
    )
  })

  it('shows enabled, disabled, and mixed motor states', () => {
    useConnectionStore.setState({
      connected: true,
      motorStatus: {
        controller_index: [0, 1, 2],
        statusword: [5687, 1, 0],
      },
    })
    render(<ControlPanel />)

    expect(screen.getByTestId('motor-power-state')).toHaveTextContent(
      '모터: 일부 활성 (2/3)',
    )
    expect(screen.getByTestId('motor-power-details')).toHaveTextContent(
      'Motor 0: 활성',
    )
    expect(screen.getByTestId('motor-power-details')).toHaveTextContent(
      'Motor 2: 비활성',
    )
  })
})
