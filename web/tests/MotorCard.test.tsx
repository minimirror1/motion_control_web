import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MotorCard } from '../src/components/MotorCard'

const baseProps = {
  controllerIndex: 0,
  statusword: 0,
  errorcode: 0,
  position: 0,
  velocity: 1.5,
  effort: 0.5,
}

describe('MotorCard', () => {
  it('renders an enabled background when the motor is enabled', () => {
    render(<MotorCard {...baseProps} statusword={1} />)

    const card = screen.getByTestId('motor-card-0')
    expect(card.className).toContain('bg-emerald-950')
    expect(screen.getByText('활성')).toBeInTheDocument()
  })

  it('renders a disabled background when the motor is disabled', () => {
    render(<MotorCard {...baseProps} statusword={0} />)

    const card = screen.getByTestId('motor-card-0')
    expect(card.className).toContain('bg-slate-800')
    expect(screen.getByText('비활성')).toBeInTheDocument()
  })

  it('shows a fault ring and badge independent of the enabled background', () => {
    render(<MotorCard {...baseProps} statusword={1} errorcode={5} />)

    const card = screen.getByTestId('motor-card-0')
    expect(card.className).toContain('bg-emerald-950')
    expect(card.className).toContain('ring-red-500')
    expect(screen.getByTestId('motor-card-0-fault')).toHaveTextContent('폴트 5')
  })

  it('positions the gauge needle within the configured limits', () => {
    render(
      <MotorCard
        {...baseProps}
        position={0}
        config={{
          controllerIndex: 0,
          lower: -10,
          upper: 10,
          speed: 1,
          gearRatio: 1,
          ratedEffort: 1,
          motorType: 'dynamixel',
        }}
      />,
    )

    const needle = screen.getByTestId('motor-card-0-gauge')
    expect(needle.style.left).toBe('50%')
  })

  it('falls back gracefully with no gauge/static info when config is missing', () => {
    render(<MotorCard {...baseProps} />)

    expect(screen.queryByTestId('motor-card-0-gauge')).not.toBeInTheDocument()
    expect(screen.getByText('설정값 로딩 중...')).toBeInTheDocument()
  })

  it('shows static config info when provided', () => {
    render(
      <MotorCard
        {...baseProps}
        config={{
          controllerIndex: 0,
          lower: -10,
          upper: 10,
          speed: 1,
          gearRatio: 2,
          ratedEffort: 0.6,
          motorType: 'dynamixel',
        }}
      />,
    )

    expect(screen.getByText(/dynamixel/)).toBeInTheDocument()
    expect(screen.getByText(/감속비 2/)).toBeInTheDocument()
  })
})
