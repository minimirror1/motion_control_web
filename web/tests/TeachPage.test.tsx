import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
  Service: class {},
}))

const { TeachPage } = await import('../src/components/teach/TeachPage')
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

// Readiness gate inputs: robots stopped, feedback arriving, torque released, no
// faults. Without these the 녹화 시작 button stays blocked by design.
const readyState = {
  robotState: {
    selected_robot_index: 0,
    robot_index: [0],
    state: [1],
    progress: [0],
  },
  motorStatus: {
    controller_index: [0, 1],
    controlword: [0, 0],
    statusword: [0, 0],
    errorcode: [0, 0],
    encoder: [0, 0],
    position: [0, 0],
    velocity: [0, 0],
    effort: [0, 0],
  },
}

const listResponse = {
  success: true,
  message: '2 motion file(s).',
  files: ['chicken_motion.csv', 'teach_20260725_2130.csv'],
  active_file: 'chicken_motion.csv',
}

function startRecording() {
  fireEvent.click(screen.getByRole('button', { name: '녹화 시작' }))
  return waitFor(() =>
    expect(screen.getByRole('button', { name: '녹화 종료' })).toBeEnabled(),
  )
}

describe('TeachPage', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      motorConfig: null,
      recordingStatus: null,
      controlCommandTopic: null,
      callService: vi.fn(() => Promise.reject(new Error('not connected'))),
      fetchMotorConfig: vi.fn(() => Promise.resolve()),
    })
  })

  it('disables all controls while disconnected', () => {
    render(<TeachPage />)

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

  it('walks the workflow steps from 준비 to 확인·재생', async () => {
    useConnectionStore.setState({
      connected: true,
      callService: mockServices({ [`${TEACH_NODE}/list_motion_files`]: listResponse }),
      ...readyState,
      robotState: { ...readyState.robotState, state: [2] },
    })
    const { rerender } = render(<TeachPage />)

    // A moving robot fails the readiness gate, so 준비 is still the open step.
    expect(screen.getByTestId('teach-step-1')).toHaveAttribute('data-state', 'active')
    expect(screen.getByTestId('teach-step-2')).toHaveAttribute('data-state', 'todo')

    act(() => useConnectionStore.setState({ ...readyState }))
    rerender(<TeachPage />)

    // Ready, and the active file gives 확인·재생 something to work on.
    await waitFor(() =>
      expect(screen.getByTestId('teach-step-3')).toHaveAttribute('data-state', 'active'),
    )
    expect(screen.getByTestId('teach-step-1')).toHaveAttribute('data-state', 'done')
    expect(screen.getByTestId('teach-readiness-banner')).toHaveTextContent(
      '녹화 준비 완료',
    )
  })

  it('blocks recording while a robot is still moving', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
    })
    useConnectionStore.setState({
      connected: true,
      callService,
      ...readyState,
      robotState: { ...readyState.robotState, state: [2] },
    })
    render(<TeachPage />)

    expect(screen.getByTestId('teach-readiness-robot-stopped')).toHaveAttribute(
      'data-level',
      'fail',
    )
    expect(screen.getByRole('button', { name: '녹화 시작' })).toBeDisabled()
    // Applying a motion file also writes the robot YAML, so it is gated too.
    await waitFor(() =>
      expect(
        screen.getByTestId('teach-file-apply-teach_20260725_2130.csv'),
      ).toBeDisabled(),
    )
  })

  it('warns but does not block when torque is still applied', () => {
    useConnectionStore.setState({
      connected: true,
      callService: mockServices({ [`${TEACH_NODE}/list_motion_files`]: listResponse }),
      ...readyState,
      motorStatus: { ...readyState.motorStatus, statusword: [0x0027, 0x0027] },
    })
    render(<TeachPage />)

    expect(screen.getByTestId('teach-readiness-torque-off')).toHaveAttribute(
      'data-level',
      'warn',
    )
    expect(screen.getByRole('button', { name: '녹화 시작' })).toBeEnabled()
  })

  it('blocks recording when a motor reports a fault', () => {
    useConnectionStore.setState({
      connected: true,
      callService: mockServices({ [`${TEACH_NODE}/list_motion_files`]: listResponse }),
      ...readyState,
      motorStatus: { ...readyState.motorStatus, errorcode: [0, 5] },
    })
    render(<TeachPage />)

    expect(screen.getByTestId('teach-readiness-no-faults')).toHaveAttribute(
      'data-level',
      'fail',
    )
    expect(screen.getByRole('button', { name: '녹화 시작' })).toBeDisabled()
  })

  it('loads the motion file list when connected and marks the active file', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

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

  it('previews the resolved file name and blocks names the node would reject', () => {
    useConnectionStore.setState({
      connected: true,
      callService: mockServices({ [`${TEACH_NODE}/list_motion_files`]: listResponse }),
      ...readyState,
    })
    render(<TeachPage />)

    expect(screen.getByTestId('teach-file-name-preview')).toHaveTextContent(
      /^자동 생성: teach_\d{8}_\d{4}\.csv/,
    )

    fireEvent.change(screen.getByTestId('teach-file-input'), {
      target: { value: 'wave 1' },
    })
    expect(screen.getByTestId('teach-file-name-preview')).toHaveTextContent(
      '저장 이름: wave_1.csv',
    )
    expect(screen.getByRole('button', { name: '녹화 시작' })).toBeEnabled()

    fireEvent.change(screen.getByTestId('teach-file-input'), {
      target: { value: '../escape.csv' },
    })
    expect(screen.getByTestId('teach-file-name-preview')).toHaveTextContent(
      '경로 구분자는 사용할 수 없습니다.',
    )
    expect(screen.getByRole('button', { name: '녹화 시작' })).toBeDisabled()
  })

  it('filters the motion file list by the search box', async () => {
    useConnectionStore.setState({
      connected: true,
      callService: mockServices({ [`${TEACH_NODE}/list_motion_files`]: listResponse }),
      ...readyState,
    })
    render(<TeachPage />)

    await waitFor(() =>
      expect(screen.getByTestId('teach-file-list')).toHaveTextContent('chicken'),
    )
    fireEvent.change(screen.getByTestId('teach-file-search'), {
      target: { value: 'teach_' },
    })

    expect(screen.getByTestId('teach-file-list')).not.toHaveTextContent('chicken')
    expect(screen.getByTestId('teach-file-list')).toHaveTextContent(
      'teach_20260725_2130.csv',
    )
  })

  it('toggles recording with the Space shortcut', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/start_recording`]: {
        success: true,
        message: '',
        file_name: 'hotkey.csv',
      },
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

    fireEvent.keyDown(document.body, { key: ' ' })

    await waitFor(() =>
      expect(screen.getByTestId('teach-recording-state')).toHaveTextContent('녹화 중'),
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
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

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

  it('loads the completed recording once at full resolution', async () => {
    const completedFile = 'teach_20260725_2200.csv'
    const completedListResponse = {
      ...listResponse,
      files: [...listResponse.files, completedFile],
    }
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: completedListResponse,
      [`${TEACH_NODE}/start_recording`]: {
        success: true,
        message: '',
        file_name: completedFile,
      },
      [`${TEACH_NODE}/stop_recording`]: {
        success: true,
        message: '',
        file_name: completedFile,
        duration: 12.34,
      },
      [`${TEACH_NODE}/get_motion_data`]: {
        success: true,
        message: '',
        time: [0, 0.01, 0.02],
        controller_index: btoa('\x00\x01'),
        positions: [0, 0.1, 0.2, 1, 1.1, 1.2],
        total_samples: 3,
        duration: 0.02,
      },
      [`${ROBOT_NODE}/reload_config`]: {
        success: true,
        message: 'Config reloaded',
      },
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

    await startRecording()
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
    const completedPreviewCalls = callService.mock.calls.filter(
      ([name, , request]) =>
        name === `${TEACH_NODE}/get_motion_data` &&
        (request as { file_name?: string }).file_name === completedFile,
    )
    expect(completedPreviewCalls).toHaveLength(1)
    expect(completedPreviewCalls[0]).toEqual([
      `${TEACH_NODE}/get_motion_data`,
      'motion_control_msgs/srv/GetMotionData',
      { file_name: completedFile, max_samples: 0 },
    ])
    expect(screen.getByTestId('teach-active-file')).toHaveTextContent(
      `미리보기: ${completedFile}`,
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
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

    await startRecording()
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
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

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

  it('previews the active motion and warns about the start-position jump', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/get_motion_data`]: {
        success: true,
        message: '',
        time: [0, 1, 2],
        controller_index: btoa('\x00\x01'),
        positions: [5.0, 5.5, 6.0, 0.0, 0.0, 0.0],
        total_samples: 1000,
        duration: 2,
      },
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

    await waitFor(() =>
      expect(screen.getByTestId('teach-motion-review')).toBeInTheDocument(),
    )
    expect(callService).toHaveBeenCalledWith(
      `${TEACH_NODE}/get_motion_data`,
      'motion_control_msgs/srv/GetMotionData',
      { file_name: 'chicken_motion.csv', max_samples: 2000 },
    )
    expect(screen.getByTestId('teach-preview-summary')).toHaveTextContent(
      '2.0초 · 2축 · 1,000 샘플',
    )
    // J0 starts at 5.0 while the arm reports 0.0.
    expect(screen.getByTestId('teach-start-jump-warning')).toHaveTextContent('J0 5.000')
  })

  it('deletes a motion file after confirmation and refreshes the list', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
      [`${TEACH_NODE}/delete_motion_file`]: { success: true, message: 'Deleted a.csv' },
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TeachPage />)

    await waitFor(() =>
      expect(
        screen.getByTestId('teach-file-delete-teach_20260725_2130.csv'),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByTestId('teach-file-delete-teach_20260725_2130.csv'))

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent('Deleted a.csv'),
    )
    expect(confirm).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('does not call the delete service when the confirmation is dismissed', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TeachPage />)

    await waitFor(() =>
      expect(
        screen.getByTestId('teach-file-delete-teach_20260725_2130.csv'),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByTestId('teach-file-delete-teach_20260725_2130.csv'))

    expect(callService).not.toHaveBeenCalledWith(
      `${TEACH_NODE}/delete_motion_file`,
      expect.anything(),
      expect.anything(),
    )
    confirm.mockRestore()
  })

  it('rejects a rename the node would refuse without calling the service', async () => {
    const callService = mockServices({
      [`${TEACH_NODE}/list_motion_files`]: listResponse,
    })
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('bad/name.csv')
    render(<TeachPage />)

    await waitFor(() =>
      expect(
        screen.getByTestId('teach-file-rename-teach_20260725_2130.csv'),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByTestId('teach-file-rename-teach_20260725_2130.csv'))

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
        '경로 구분자는 사용할 수 없습니다.',
      ),
    )
    expect(callService).not.toHaveBeenCalledWith(
      `${TEACH_NODE}/rename_motion_file`,
      expect.anything(),
      expect.anything(),
    )
    prompt.mockRestore()
  })

  it('restores the recording state from recording_status after a reload', async () => {
    useConnectionStore.setState({
      connected: true,
      callService: mockServices({ [`${TEACH_NODE}/list_motion_files`]: listResponse }),
      ...readyState,
      recordingStatus: {
        active: true,
        elapsed: 4.2,
        file_name: 'in_flight.csv',
        sample_count: 4200,
      },
    })
    render(<TeachPage />)

    await waitFor(() =>
      expect(screen.getByTestId('teach-recording-state')).toHaveTextContent('녹화 중'),
    )
    expect(screen.getByRole('button', { name: '녹화 종료' })).toBeEnabled()
    // Counters come from the node, not this client's buffer, which started empty.
    expect(screen.getByTestId('teach-recording-hud')).toHaveTextContent(
      '00:04.2 · 4,200 샘플',
    )
  })

  it('renders service failures in the feedback area', async () => {
    const callService = vi.fn(() =>
      Promise.reject(new Error('Service call timed out')),
    )
    useConnectionStore.setState({ connected: true, callService, ...readyState })
    render(<TeachPage />)

    await waitFor(() =>
      expect(screen.getByTestId('teach-feedback')).toHaveTextContent(
        '서비스 호출 실패: Service call timed out',
      ),
    )
  })
})
