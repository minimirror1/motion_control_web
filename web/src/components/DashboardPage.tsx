import { ControlPanel } from './ControlPanel'
import { MotorCardGrid } from './MotorCardGrid'
import { TeachPanel } from './TeachPanel'

export function DashboardPage() {
  return (
    <>
      <MotorCardGrid />
      <ControlPanel />
      <TeachPanel />
    </>
  )
}
