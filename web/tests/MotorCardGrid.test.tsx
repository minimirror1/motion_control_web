import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
  Service: class {},
}))

const { MotorCardGrid } = await import('../src/components/MotorCardGrid')
const { useConnectionStore } = await import('../src/store/connectionStore')

describe('MotorCardGrid', () => {
  const fetchMotorConfig = vi.fn(() => Promise.resolve())

  beforeEach(() => {
    fetchMotorConfig.mockClear()
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      motorConfig: null,
      controlCommandTopic: null,
      fetchMotorConfig,
    })
  })

  it('shows a disconnected message and does not fetch config while disconnected', () => {
    render(<MotorCardGrid />)

    expect(screen.getByText('ROS 연결 후 표시됩니다.')).toBeInTheDocument()
    expect(fetchMotorConfig).not.toHaveBeenCalled()
  })

  it('fetches motor config once on mount when already connected', () => {
    useConnectionStore.setState({ connected: true })
    render(<MotorCardGrid />)

    expect(fetchMotorConfig).toHaveBeenCalledTimes(1)
  })

  it('renders one card per controller_index in motorStatus', () => {
    useConnectionStore.setState({
      connected: true,
      motorStatus: {
        controller_index: [0, 1, 2],
        controlword: [0, 0, 0],
        statusword: [1, 0, 0],
        errorcode: [0, 0, 0],
        encoder: [0, 0, 0],
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        effort: [0, 0, 0],
      },
    })
    render(<MotorCardGrid />)

    expect(screen.getByTestId('motor-card-0')).toBeInTheDocument()
    expect(screen.getByTestId('motor-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('motor-card-2')).toBeInTheDocument()
  })

  it('refetches motor config when the refresh button is clicked', () => {
    useConnectionStore.setState({ connected: true })
    render(<MotorCardGrid />)
    fetchMotorConfig.mockClear()

    screen.getByRole('button', { name: '설정값 새로고침' }).click()

    expect(fetchMotorConfig).toHaveBeenCalledTimes(1)
  })
})
