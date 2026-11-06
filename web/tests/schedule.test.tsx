import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('roslib', () => ({
  Ros: class {
    on() {}
    close() {}
  },
  Topic: class {
    subscribe() {}
    unsubscribe() {}
    publish() {}
  },
  Service: class {},
}))

const { default: App } = await import('../src/App')
const { ControlPanel } = await import('../src/components/ControlPanel')
const { SchedulePage } = await import('../src/components/schedule/SchedulePage')
const { parseTemperatureCsv } = await import('../src/lib/scheduleServices')
const { useConnectionStore } = await import('../src/store/connectionStore')

const CONFIG = {
  enabled: false,
  week: Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
      d,
      { enabled: true, open: '10:00', close: '22:00' },
    ]),
  ),
  playlist: ['a.csv'],
  motions_per_rest: { min: 1, max: 3 },
  rest_sec: { min: 10, max: 10 },
  overheat: { limit_c: 70, resume_c: 60, recheck_sec: 20 },
}

function status(enabled: boolean) {
  return {
    phase: enabled ? 'resting' : 'disabled',
    enabled,
    open_now: true,
    now: '2026-11-05T10:00:00-05:00',
    timezone: 'America/New_York',
    active_motion: 'a.csv',
    motions_left: 2,
    rest_remaining_sec: enabled ? 4.2 : null,
    overheated: false,
    temperatures: [34, 32],
    motor_ids: [0, 1],
    last_log: null,
    last_error: '',
  }
}

describe('parseTemperatureCsv', () => {
  it('parses rows into per-motor series', () => {
    const series = parseTemperatureCsv(
      'timestamp,event,motor0,motor1\n' +
        '2026-11-05T04:28:55-05:00,rest,36,32\r\n' +
        '2026-11-05T04:29:14-05:00,overheat_recheck,35,31\n',
    )
    expect(series.motors).toEqual(['motor0', 'motor1'])
    expect(series.events).toEqual(['rest', 'overheat_recheck'])
    expect(series.values).toEqual([
      [36, 35],
      [32, 31],
    ])
    expect(series.time[1] - series.time[0]).toBe(19)
  })

  it('handles an empty file', () => {
    expect(parseTemperatureCsv('').time).toEqual([])
  })
})

describe('schedule UI', () => {
  const callService = vi.fn()

  beforeEach(() => {
    callService.mockReset()
    callService.mockImplementation((name: string, _type: string, request: object) => {
      if (name.endsWith('/get_schedule')) {
        return Promise.resolve({
          success: true,
          message: '',
          schedule_json: JSON.stringify(CONFIG),
          timezone: 'America/New_York',
        })
      }
      if (name.endsWith('/list_motion_files')) {
        return Promise.resolve({ success: true, message: '', files: ['a.csv', 'b.csv'], active_file: 'a.csv' })
      }
      if (name.endsWith('/set_schedule')) {
        return Promise.resolve({ success: true, message: 'schedule saved', request })
      }
      return Promise.reject(new Error(`unexpected ${name}`))
    })
    useConnectionStore.setState({
      connected: true,
      ros: null,
      robotState: null,
      motorStatus: null,
      scheduleStatus: status(false),
      controlCommandTopic: null,
      callService,
    })
  })

  const savedConfigs = () =>
    callService.mock.calls
      .filter(([name]) => String(name).endsWith('/set_schedule'))
      .map(([, , request]) => JSON.parse((request as { schedule_json: string }).schedule_json))

  it('turns the schedule on with the saved settings, not unsaved edits', async () => {
    render(<SchedulePage />)
    await screen.findByTestId('schedule-save')

    fireEvent.click(screen.getByTestId('schedule-day-mon'))
    fireEvent.click(screen.getByTestId('schedule-toggle'))

    await waitFor(() => expect(savedConfigs()).toHaveLength(1))
    expect(savedConfigs()[0].enabled).toBe(true)
    expect(savedConfigs()[0].week.mon.enabled).toBe(true)
  })

  it('saves edited rest range and playlist while keeping the switch state', async () => {
    render(<SchedulePage />)
    await screen.findByTestId('schedule-save')

    fireEvent.change(screen.getByTestId('schedule-rest-min'), { target: { value: '30' } })
    fireEvent.change(screen.getByTestId('schedule-rest-max'), { target: { value: '60' } })
    fireEvent.change(screen.getByTestId('schedule-add-file'), { target: { value: 'b.csv' } })
    fireEvent.click(screen.getByTestId('schedule-add'))
    fireEvent.click(screen.getByTestId('schedule-save'))

    await waitFor(() => expect(savedConfigs()).toHaveLength(1))
    expect(savedConfigs()[0]).toMatchObject({
      enabled: false,
      rest_sec: { min: 30, max: 60 },
      playlist: ['a.csv', 'b.csv'],
    })
    expect(await screen.findByTestId('schedule-message')).toHaveTextContent('저장')
  })

  it('locks manual control while the schedule is on', () => {
    useConnectionStore.setState({ scheduleStatus: status(true) })
    render(<ControlPanel />)
    expect(screen.getByRole('button', { name: '모션 재생' })).toBeDisabled()
    expect(screen.getByTestId('control-feedback')).toHaveTextContent('스케줄 동작 중')
  })

  it('replaces the teach page with a notice while the schedule is on', () => {
    useConnectionStore.setState({ connected: false, scheduleStatus: status(true) })
    render(<App />)
    fireEvent.click(screen.getByTestId('app-tab-teach'))
    expect(screen.getByTestId('schedule-lock')).toBeInTheDocument()

    act(() => useConnectionStore.setState({ scheduleStatus: status(false) }))
    expect(screen.queryByTestId('schedule-lock')).not.toBeInTheDocument()
  })
})
