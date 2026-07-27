import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
  Service: class {},
}))

const { PlaybackPanel } = await import('../src/components/teach/PlaybackPanel')
const { initialTeachState } = await import('../src/components/teach/teachState')
const { useConnectionStore } = await import('../src/store/connectionStore')

const operating = {
  selected_robot_index: 0,
  robot_index: [0],
  state: [2],
  progress: [0.42],
}

const panelProps = {
  run: (action: () => Promise<void>) => action(),
  reloadAfterChange: () => Promise.resolve(''),
}

describe('PlaybackPanel', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      controlCommandTopic: null,
    })
  })

  it('disables the transport while disconnected and shows no progress', () => {
    render(<PlaybackPanel state={initialTeachState} dispatch={vi.fn()} {...panelProps} />)

    expect(screen.getByTestId('teach-transport-home')).toBeDisabled()
    expect(screen.getByTestId('teach-transport-move-to-start')).toBeDisabled()
    expect(screen.getByTestId('teach-transport-play')).toBeDisabled()
    expect(screen.getByTestId('teach-transport-stop')).toBeDisabled()
    expect(screen.getByTestId('teach-progress-value')).toHaveTextContent('—')
    expect(screen.getByTestId('teach-robot-state')).toHaveTextContent('상태 대기 중')
  })

  it('disables move-to-start while no motion is active, even when connected', () => {
    useConnectionStore.setState({ connected: true })
    render(<PlaybackPanel state={initialTeachState} dispatch={vi.fn()} {...panelProps} />)

    expect(screen.getByTestId('teach-transport-move-to-start')).toBeDisabled()
    expect(screen.getByTestId('teach-transport-home')).not.toBeDisabled()
  })

  it('enables move-to-start once a motion is active', async () => {
    useConnectionStore.setState({ connected: true })
    render(
      <PlaybackPanel
        state={{ ...initialTeachState, activeFile: 'demo.csv' }}
        dispatch={vi.fn()}
        {...panelProps}
      />,
    )
    // Flush the motion-preview fetch kicked off by a non-empty activeFile so
    // its state update lands inside act() instead of after the test ends.
    await act(async () => {})

    expect(screen.getByTestId('teach-transport-move-to-start')).not.toBeDisabled()
  })

  it('renders the selected robot progress and decoded state', () => {
    useConnectionStore.setState({ connected: true, robotState: operating })
    render(<PlaybackPanel state={initialTeachState} dispatch={vi.fn()} {...panelProps} />)

    expect(screen.getByTestId('teach-robot-state')).toHaveTextContent('동작 중')
    expect(screen.getByTestId('teach-progress-value')).toHaveTextContent('42%')
    expect(screen.getByTestId('teach-progress-bar')).toHaveStyle({ width: '42%' })
  })

  it('sends PLAY_MOTION and reports it through dispatch', () => {
    const sendControlCommand = vi.fn(() => true)
    const dispatch = vi.fn()
    useConnectionStore.setState({ connected: true, sendControlCommand })
    render(<PlaybackPanel state={initialTeachState} dispatch={dispatch} {...panelProps} />)

    fireEvent.click(screen.getByTestId('teach-transport-play'))

    expect(sendControlCommand).toHaveBeenCalledWith(2)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'feedback',
      message: '▶ 재생 명령 전송됨',
    })
  })

  it('locks the transport while a recording is in progress', () => {
    useConnectionStore.setState({ connected: true })
    render(
      <PlaybackPanel
        state={{ ...initialTeachState, recording: true }}
        dispatch={vi.fn()}
        {...panelProps}
      />,
    )

    expect(screen.getByTestId('teach-transport-play')).toBeDisabled()
  })
})
