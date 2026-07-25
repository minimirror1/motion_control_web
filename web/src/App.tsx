import { ConnectionStatus } from './components/ConnectionStatus'
import { ControlPanel } from './components/ControlPanel'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <main className="w-full max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">motion_control_web</h1>
        <ConnectionStatus />
        <ControlPanel />
      </main>
    </div>
  )
}

export default App
