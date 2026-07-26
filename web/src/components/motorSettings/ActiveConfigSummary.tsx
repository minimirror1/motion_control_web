import type { MotorManagerConfig } from '../../lib/motorManagerConfig'

interface ActiveConfigSummaryProps {
  config: MotorManagerConfig | null
  error: string | null
}

export function ActiveConfigSummary({ config, error }: ActiveConfigSummaryProps) {
  return (
    <div
      data-testid="active-config-summary"
      className="rounded-lg border border-slate-700 bg-slate-900 p-4"
    >
      <h2 className="mb-2 text-sm font-medium text-slate-200">
        현재 활성 설정 (active_motor_manager.yaml)
      </h2>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && !config && <p className="text-xs text-slate-400">불러오는 중...</p>}
      {config && (
        <div className="space-y-3 text-xs text-slate-300">
          {config.masters.map((master) => (
            <div key={master.id}>
              <p className="text-slate-200">
                마스터 #{master.id} · {master.type} · 슬레이브 {master.slaves.length}개
              </p>
              <table className="mt-1 w-full text-left text-[11px]">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pr-2">controller_index</th>
                    <th className="pr-2">driver_id</th>
                    <th className="pr-2">profile_mode</th>
                  </tr>
                </thead>
                <tbody>
                  {master.slaves.map((slave) => (
                    <tr key={slave.controller_index}>
                      <td className="pr-2">{slave.controller_index}</td>
                      <td className="pr-2">{slave.driver_id}</td>
                      <td className="pr-2">{slave.profile_mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <table className="w-full text-left text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="pr-2">driver id</th>
                <th className="pr-2">type</th>
                <th className="pr-2">lower</th>
                <th className="pr-2">upper</th>
                <th className="pr-2">gear_ratio</th>
                <th className="pr-2">rated_effort</th>
              </tr>
            </thead>
            <tbody>
              {config.drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="pr-2">{driver.id}</td>
                  <td className="pr-2">{driver.type}</td>
                  <td className="pr-2">{driver.lower}</td>
                  <td className="pr-2">{driver.upper}</td>
                  <td className="pr-2">{driver.gear_ratio}</td>
                  <td className="pr-2">{driver.rated_effort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
