import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JointLimitStrip } from '../src/components/teach/JointLimitStrip'

describe('JointLimitStrip', () => {
  it('overlays the sent target under feedback and separates both angle values', () => {
    render(
      <JointLimitStrip
        limits={[
          {
            controllerIndex: 0,
            position: 1.25,
            commandedPosition: 2.5,
            lower: -10,
            upper: 10,
            percent: 56.25,
            commandedPercent: 62.5,
            status: 'ok',
          },
        ]}
      />,
    )

    expect(screen.getByTestId('teach-joint-current-marker-0')).toHaveClass('z-10')
    expect(screen.getByTestId('teach-joint-command-marker-0')).toHaveClass('z-0')
    expect(screen.getByTestId('teach-joint-current-value-0')).toHaveTextContent('1.250°')
    expect(screen.getByTestId('teach-joint-command-value-0')).toHaveTextContent('2.500°')
  })
})
