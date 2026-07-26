import { ConnectionStatus } from './components/ConnectionStatus'
import { ControlPanel } from './components/ControlPanel'
import { MotorCardGrid } from './components/MotorCardGrid'
import { TeachPanel } from './components/TeachPanel'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <main className="w-full max-w-5xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">motion_control_web</h1>
        <ConnectionStatus />
        <MotorCardGrid />
        <ControlPanel />
        <TeachPanel />
      </main>
    </div>
  )
}

export default App
