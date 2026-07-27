import { useState } from 'react'
import { ConnectionStatus } from './components/ConnectionStatus'
import { DashboardPage } from './components/DashboardPage'
import { MotorSettingsPage } from './components/motorSettings/MotorSettingsPage'
import { TeachPage } from './components/teach/TeachPage'

type Tab = 'dashboard' | 'teach' | 'motor-settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'teach', label: '모션 티칭' },
  { id: 'motor-settings', label: '모터 설정' },
]

const PAGES: Record<Tab, () => JSX.Element> = {
  dashboard: DashboardPage,
  teach: TeachPage,
  'motor-settings': MotorSettingsPage,
}

function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const Page = PAGES[tab]

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <main className="mx-auto w-full max-w-5xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">motion_control_web</h1>
        <ConnectionStatus />
        <nav className="mt-4 flex gap-2 border-b border-slate-800" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-testid={`app-tab-${id}`}
              onClick={() => setTab(id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
                tab === id
                  ? 'bg-slate-900 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-4">
          <Page />
        </div>
      </main>
    </div>
  )
}

export default App
