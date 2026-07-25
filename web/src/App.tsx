import { ConnectionStatus } from './components/ConnectionStatus'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-md">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">motion_control_web</h1>
        <ConnectionStatus />
      </div>
    </div>
  )
}

export default App
