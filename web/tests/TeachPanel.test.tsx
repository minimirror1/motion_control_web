import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
  Service: class {},
}))

const { TeachPanel } = await import('../src/components/TeachPanel')
const { useConnectionStore } = await import('../src/store/connectionStore')

const TEACH_NODE = '/motion_control_teach_node'
const ROBOT_NODE = '/robot_manager_node'

type ServiceResponses = Record<string, unknown>

type CallService = <TRequest extends object, TResponse>(
  name: string,
  serviceType: string,
  request: TRequest,
) => Promise<TResponse>

function mockServices(responses: ServiceResponses): CallService & Mock {
  return vi.fn((name: string) => {
    if (name in responses) {
      return Promise.resolve(responses[name])
    }
    return Promise.reject(new Error(`unexpected service: ${name}`))
  }) as unknown as CallService & Mock
}

const listResponse = {
  success: true,
  message: '2 motion file(s).',
  files: ['chicken_motion.csv', 'teach_20260725_2130.csv'],
  active_file: 'chicken_motion.csv',
}

describe('TeachPanel', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      controlCommandTopic: null,
      callService: vi.fn(() => Promise.reject(new Error('not connected'))),
    })
  })

  it('disables all controls while disconnected', () => {
    render(<TeachPanel />)

    expect(screen.getByRole('button', { name: '토크 해제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '토크 온' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '녹화 시작' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '녹화 종료' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '목록 새로고침' })).toBeDisabled()
    expect(screen.getByTestId('teach-file-input')).toBeDisabled()
    expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
      'ROS 연결 후 사용할 수 있습니다.',
    )
  })

  it('loads the motion file list when connected and marks the active file', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
    })
    useConnectionStore.setState({ connected: true, callService })
    render(<TeachPanel />)

    await waitFor(() =>
      expect(screen.getByTestId('teach-file-list')).toHaveTextContent(
        'chicken_motion.csv',
      ),
    )
    expect(screen.getByText('사용 중')).toBeInTheDocument()
    expect(
      screen.getByTestId('teach-file-apply-teach_20260725_2130.csv'),
    ).toBeInTheDocument()
    expect(callService).toHaveBeenCalledWith(
      `${TEACH_NODE}/list_motion_files`,
      'motion_control_msgs/srv/ListMotionFiles',
      {},
    )
  })

  it('starts a recording with the typed file name', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/start_recording`]: {
        success: true,
        message: 'Recording started',
        file_name: 'my_motion.csv',
      },
    })
    useConnectionStore.setState({ connected: true, callService })
    render(<TeachPanel />)

    fireEvent.change(screen.getByTestId('teach-file-input'), {
      target: { value: 'my_motion' },
    })
    fireEvent.click(screen.getByRole('button', { name: '녹화 시작' }))

    await waitFor(() =>
      expect(screen.getByTestId('teach-recording-state')).toHaveTextContent(
        '녹화 중',
      ),
    )
    expect(callService).toHaveBeenCalledWith(
      `${TEACH_NODE}/start_recording`,
      'motion_control_msgs/srv/StartRecording',
      { file_name: 'my_motion' },
    )
    expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
      '녹화 시작: my_motion.csv',
    )
    expect(screen.getByRole('button', { name: '녹화 종료' })).toBeEnabled()
  })

  it('stops a recording, chains reload_config, and refreshes the list', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/start_recording`]: {
        success: true,
        message: '',
        file_name: 'teach_20260725_2200.csv',
      },
      [`${TEACH_NODE}/stop_recording`]: {
        success: true,
        message: '',
        file_name: 'teach_20260725_2200.csv',
        duration: 12.34,
      },
      [`${ROBOT_NODE}/reload_config`]: {
        success: true,
        message: 'Config reloaded',
      },
    })
    useConnectionStore.setState({ connected: true, callService })
    render(<TeachPanel />)

    fireEvent.click(screen.getByRole('button', { name: '녹화 시작' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '녹화 종료' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: '녹화 종료' }))

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
        '저장됨: teach_20260725_2200.csv (12.3초) · 설정 리로드 완료',
      ),
    )
    expect(callService).toHaveBeenCalledWith(
      `${ROBOT_NODE}/reload_config`,
      'std_srvs/srv/Trigger',
      {},
    )
    expect(screen.getByTestId('teach-recording-state')).toHaveTextContent('대기')
  })

  it('surfaces the reload refusal message verbatim after stopping', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/start_recording`]: {
        success: true,
        message: '',
        file_name: 'a.csv',
      },
      [`${TEACH_NODE}/stop_recording`]: {
        success: true,
        message: '',
        file_name: 'a.csv',
        duration: 1.0,
      },
      [`${ROBOT_NODE}/reload_config`]: {
        success: false,
        message: 'Robots must be stopped before reloading configuration.',
      },
    })
    useConnectionStore.setState({ connected: true, callService })
    render(<TeachPanel />)

    fireEvent.click(screen.getByRole('button', { name: '녹화 시작' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '녹화 종료' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: '녹화 종료' }))

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
        'Robots must be stopped before reloading configuration.',
      ),
    )
  })

  it('applies a non-active file and chains reload_config', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/set_active_motion`]: {
        success: true,
        message: 'Active motion set',
      },
      [`${ROBOT_NODE}/reload_config`]: {
        success: true,
        message: 'Config reloaded',
      },
    })
    useConnectionStore.setState({ connected: true, callService })
    render(<TeachPanel />)

    await waitFor(() =>
      expect(
        screen.getByTestId('teach-file-apply-teach_20260725_2130.csv'),
      ).toBeEnabled(),
    )
    fireEvent.click(
      screen.getByTestId('teach-file-apply-teach_20260725_2130.csv'),
    )

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
        '적용됨: teach_20260725_2130.csv · 설정 리로드 완료',
      ),
    )
    expect(callService).toHaveBeenCalledWith(
      `${TEACH_NODE}/set_active_motion`,
      'motion_control_msgs/srv/SetActiveMotion',
      { file_name: 'teach_20260725_2130.csv' },
    )
  })

  it('renders service failures in the feedback area', async () => {
    const callService = vi.fn(() =>
      Promise.reject(new Error('Service call timed out')),
    )
    useConnectionStore.setState({ connected: true, callService })
    render(<TeachPanel />)

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
        '서비스 호출 실패: Service call timed out',
      ),
    )
  })
})
