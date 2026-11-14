import { useEffect, useRef, useState } from 'react'
import uPlot from 'uplot'
import { useConnectionStore } from '../../store/connectionStore'
import {
  getTemperatureLog,
  listTemperatureLogs,
  parseTemperatureCsv,
  type TemperatureSeries,
} from '../../lib/scheduleServices'
import { seriesColor } from '../teach/TrajectoryChart'

const AXIS_STYLE = {
  stroke: '#94a3b8',
  grid: { stroke: '#1e293b', width: 1 },
  ticks: { stroke: '#1e293b', width: 1 },
}

function TemperatureChart({
  series,
  timezone,
}: {
  series: TemperatureSeries
  timezone: string | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || series.time.length === 0) {
      return
    }
    const plot = new uPlot(
      {
        width: container.clientWidth || 600,
        height: 280,
        scales: { x: { time: true } },
        // Show the robot's (store's) local time, not the viewer's browser time.
        ...(timezone ? { tzDate: (ts: number) => uPlot.tzDate(new Date(ts * 1e3), timezone) } : {}),
        axes: [AXIS_STYLE, { ...AXIS_STYLE, label: '℃' }],
        series: [
          {},
          ...series.motors.map((motor, i) => ({
            label: motor,
            stroke: seriesColor(i),
            width: 1.5,
            points: { show: true, size: 4 },
          })),
        ],
      },
      [series.time, ...series.values] as uPlot.AlignedData,
      container,
    )
    const observer = new ResizeObserver(() =>
      plot.setSize({ width: container.clientWidth || 600, height: 280 }),
    )
    observer.observe(container)
    return () => {
      observer.disconnect()
      plot.destroy()
    }
  }, [series, timezone])

  return (
    <div
      ref={containerRef}
      data-testid="temperature-chart"
      className="w-full [&_.u-legend]:text-slate-300"
    />
  )
}

export function TemperaturePage() {
  const connected = useConnectionStore((state) => state.connected)
  const timezone = useConnectionStore((state) => state.scheduleStatus?.timezone ?? null)
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [series, setSeries] = useState<TemperatureSeries | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!connected) return
    listTemperatureLogs()
      .then((list) => {
        setDates(list)
        setDate((current) => current || list[0] || '')
      })
      .catch((e: Error) => setError(e.message))
  }, [connected])

  useEffect(() => {
    if (!connected || !date) return
    setError('')
    getTemperatureLog(date)
      .then((text) => setSeries(parseTemperatureCsv(text)))
      .catch((e: Error) => {
        setSeries(null)
        setError(e.message)
      })
  }, [connected, date])

  if (!connected) {
    return <p className="text-sm text-slate-400">ROS 연결 후 온도 기록을 볼 수 있습니다.</p>
  }

  const recheckCount = series?.events.filter((e) => e === 'overheat_recheck').length ?? 0

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-200">
          모터 온도 기록 (휴게 시작 시 측정{timezone ? `, ${timezone} 기준` : ''})
        </h2>
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="temperature-date"
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        >
          {dates.length === 0 && <option value="">기록 없음</option>}
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {series && series.time.length > 0 ? (
        <>
          <TemperatureChart series={series} timezone={timezone} />
          <p className="mt-3 text-xs text-slate-400" data-testid="temperature-summary">
            측정 {series.time.length}회 (과열 재측정 {recheckCount}회) · 최고 온도{' '}
            {series.motors
              .map((motor, i) => `${motor} ${Math.max(...series.values[i].filter(Number.isFinite))}℃`)
              .join(' · ')}
          </p>
        </>
      ) : (
        !error && <p className="text-sm text-slate-400">선택한 날짜의 기록이 없습니다.</p>
      )}
    </section>
  )
}
