import { useState } from 'react'
import { ConnectionStatus } from './components/ConnectionStatus'
import { DashboardPage } from './components/DashboardPage'
import { MotorSettingsPage } from './components/motorSettings/MotorSettingsPage'
import { SchedulePage } from './components/schedule/SchedulePage'
import { TemperaturePage } from './components/schedule/TemperaturePage'
import { TeachPage } from './components/teach/TeachPage'
import { useConnectionStore } from './store/connectionStore'

type Tab = 'dashboard' | 'schedule' | 'temperature' | 'teach' | 'motor-settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'schedule', label: '스케줄' },
  { id: 'temperature', label: '온도 기록' },
  { id: 'teach', label: '모션 티칭' },
  { id: 'motor-settings', label: '모터 설정' },
]

const PAGES: Record<Tab, () => JSX.Element> = {
  dashboard: DashboardPage,
  schedule: SchedulePage,
  temperature: TemperaturePage,
  teach: TeachPage,
  'motor-settings': MotorSettingsPage,
}

function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const Page = PAGES[tab]
  // Teach and motor settings drive the motors directly; the schedule owns them
  // while it is ON.
  const scheduleActive = useConnectionStore((state) => state.scheduleStatus?.enabled ?? false)
  const locked = scheduleActive && (tab === 'teach' || tab === 'motor-settings')

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      {/* The teach workspace is a three-column layout; the other tabs stay at
          reading width. */}
      <main
        className={`mx-auto w-full ${tab === 'teach' ? 'max-w-[1600px]' : 'max-w-5xl'}`}
      >
        <header className="flex items-center gap-3 border-b border-slate-800">
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                data-testid={`app-tab-${id}`}
                onClick={() => setTab(id)}
                className={`shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  tab === id
                    ? 'bg-slate-900 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <ConnectionStatus />
          <h1 className="shrink-0 text-sm font-semibold text-slate-200">
            motion_control_web
          </h1>
        </header>
        <div className="mt-4">
          {locked ? (
            <div
              data-testid="schedule-lock"
              className="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-200"
            >
              스케줄이 켜져 있어 이 화면을 사용할 수 없습니다. 스케줄 탭에서 스케줄을 끈 뒤
              사용하세요.
              <button
                type="button"
                onClick={() => setTab('schedule')}
                className="ml-3 rounded-md bg-amber-700 px-3 py-1 text-white hover:bg-amber-600"
              >
                스케줄 탭으로
              </button>
            </div>
          ) : (
            <Page />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
