import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {},
  Topic: class {},
  Service: class {},
}))

const { MotorSettingsPage } = await import('../src/components/motorSettings/MotorSettingsPage')
const { useConnectionStore } = await import('../src/store/connectionStore')

const ACTIVE_YAML =
  'period: 1000000\n' +
  'masters:\n' +
  '  - id: 0\n' +
  '    type: serial\n' +
  '    number_of_slaves: 1\n' +
  '    serial_port: /dev/ttyUSB0\n' +
  '    serial_baudrate: 1000000\n' +
  '    slaves:\n' +
  '      - controller_index: 0\n' +
  '        driver_id: 0\n' +
  '        bus_id: 1\n' +
  '        profile_mode: 0\n' +
  'drivers:\n' +
  '  - id: 0\n' +
  '    type: dynamixel\n' +
  '    pulse_per_revolution: 4096\n' +
  '    zero_offset: 0\n' +
  '    gear_ratio: 1.0\n' +
  '    rated_effort: 1.0\n' +
  '    unit_effort: 1.0\n' +
  '    lower: -180.0\n' +
  '    upper: 180.0\n' +
  '    speed: 100.0\n' +
  '    acceleration: 1.0\n' +
  '    deceleration: 1.0\n' +
  '    profile_velocity: 1.0\n' +
  '    profile_acceleration: 1.0\n' +
  '    profile_deceleration: 1.0\n' +
  '    profile_position_value: 3\n' +
  '    profile_velocity_value: 1\n' +
  '    profile_effort_value: 0\n' +
  '    param_file: package://motor_manager/hardware/dynamixel/param/xm430.yaml\n'

type CallService = <TRequest extends object, TResponse>(
  name: string,
  serviceType: string,
  request: TRequest,
) => Promise<TResponse>

function mockCallService(): CallService & Mock {
  return vi.fn((name: string, _type: string, request: unknown) => {
    if (name === 'motion_control_web/list_motor_templates') {
      return Promise.resolve({
        success: true,
        message: 'ok',
        templates: ['example_serial_dynamixel.yaml'],
      })
    }
    if (name === 'motion_control_web/get_motor_config_yaml') {
      const source = (request as { source: string }).source
      return Promise.resolve({
        success: true,
        message: 'ok',
        yaml_text: ACTIVE_YAML,
        source_path: source === 'active' || source === '' ? 'active_motor_manager.yaml' : source,
      })
    }
    if (name === 'motion_control_web/set_motor_config_yaml') {
      return Promise.resolve({ success: true, message: 'ok' })
    }
    return Promise.reject(new Error(`unexpected service: ${name}`))
  }) as unknown as CallService & Mock
}

describe('MotorSettingsPage', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      ros: null,
      robotState: null,
      motorStatus: null,
      motorConfig: null,
      controlCommandTopic: null,
      callService: vi.fn(() => Promise.reject(new Error('not connected'))),
    })
  })

  it('shows a connect prompt while disconnected', () => {
    render(<MotorSettingsPage />)
    expect(screen.getByText('ROS 연결 후 사용할 수 있습니다.')).toBeInTheDocument()
  })

  it('loads the active config and template list once connected', async () => {
    const callService = mockCallService()
    useConnectionStore.setState({ connected: true, callService })
    render(<MotorSettingsPage />)

    await waitFor(() =>
      expect(screen.getByTestId('active-config-summary')).toHaveTextContent('마스터 #0'),
    )
    expect(
      screen.getByTestId('start-from-template-example_serial_dynamixel.yaml'),
    ).toBeInTheDocument()
  })

  it('walks through the wizard from a template and saves, showing the restart-required message', async () => {
    const callService = mockCallService()
    useConnectionStore.setState({ connected: true, callService })
    render(<MotorSettingsPage />)

    await waitFor(() =>
      expect(
        screen.getByTestId('start-from-template-example_serial_dynamixel.yaml'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('start-from-template-example_serial_dynamixel.yaml'))

    await waitFor(() => expect(screen.getByText('마스터 설정')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => expect(screen.getByText('드라이버 프로필')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => expect(screen.getByText('슬레이브(모터)')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => expect(screen.getByText('검토 및 저장')).toBeInTheDocument())
    expect(screen.queryByTestId('review-errors')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() =>
      expect(screen.getByTestId('save-success')).toHaveTextContent('재시작 필요'),
    )
    expect(callService).toHaveBeenCalledWith(
      'motion_control_web/set_motor_config_yaml',
      'motion_control_msgs/srv/SetMotorConfigYaml',
      expect.objectContaining({ yaml_text: expect.any(String) }),
    )
  })

  it('shows the save error message and stays on the review step on failure', async () => {
    const callService = vi.fn((name: string, _type: string, request: unknown) => {
      if (name === 'motion_control_web/list_motor_templates') {
        return Promise.resolve({ success: true, message: 'ok', templates: [] })
      }
      if (name === 'motion_control_web/get_motor_config_yaml') {
        void request
        return Promise.resolve({
          success: true,
          message: 'ok',
          yaml_text: ACTIVE_YAML,
          source_path: 'active_motor_manager.yaml',
        })
      }
      if (name === 'motion_control_web/set_motor_config_yaml') {
        return Promise.resolve({ success: false, message: '검증 실패: 예시 오류' })
      }
      return Promise.reject(new Error(`unexpected service: ${name}`))
    }) as unknown as CallService & Mock
    useConnectionStore.setState({ connected: true, callService })
    render(<MotorSettingsPage />)

    await waitFor(() => expect(screen.getByTestId('start-from-active')).toBeEnabled())
    fireEvent.click(screen.getByTestId('start-from-active'))

    await waitFor(() => expect(screen.getByText('마스터 설정')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(screen.getByText('드라이버 프로필')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(screen.getByText('슬레이브(모터)')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(screen.getByText('검토 및 저장')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() =>
      expect(screen.getByTestId('save-error')).toHaveTextContent('검증 실패: 예시 오류'),
    )
    expect(screen.getByText('검토 및 저장')).toBeInTheDocument()
  })
})
