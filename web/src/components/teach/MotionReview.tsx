import { useEffect, useState } from 'react'
import {
  limitViolations,
  peakSpeeds,
  samplingReport,
  startJumps,
  toWaveformData,
  type MotionData,
} from '../../lib/motionData'
import { useConnectionStore } from '../../store/connectionStore'
import { seriesColor, TrajectoryChart } from './TrajectoryChart'
import { formatCount } from './teachUi'

// A first-sample gap larger than this is worth calling out before playback.
const START_JUMP_THRESHOLD = 0.05

/** One-line description of the loaded motion, shown in the panel header. */
export function motionSummary(data: MotionData): string {
  const peak = Math.max(...peakSpeeds(data).map((speed) => speed.peak), 0)
  const length = data.duration > 0 ? `${data.duration.toFixed(1)}초` : '시간 행 없음'
  return `${length} · ${data.controllerIndices.length}축 · ${formatCount(
    data.totalSamples,
  )} 샘플 · 최대 ${peak.toFixed(2)}/s`
}

function Warning({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p
      data-testid={testId}
      className="rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-300"
    >
      ⚠ {children}
    </p>
  )
}

export function MotionReview({ data }: { data: MotionData }) {
  const motorStatus = useConnectionStore((store) => store.motorStatus)
  const motorConfig = useConnectionStore((store) => store.motorConfig)
  const [visible, setVisible] = useState<boolean[]>([])

  useEffect(() => {
    setVisible(data.controllerIndices.map(() => true))
  }, [data])

  const jumps = startJumps(data, motorStatus).filter(
    (jump) => jump.delta > START_JUMP_THRESHOLD,
  )
  const violations = limitViolations(data, motorConfig)
  const sampling = samplingReport(data)

  return (
    <div data-testid="teach-motion-review" className="mt-3 space-y-2">
      {jumps.length > 0 && (
        <Warning testId="teach-start-jump-warning">
          재생 시작 시 급이동:{' '}
          {jumps
            .slice(0, 3)
            .map((jump) => `J${jump.controllerIndex} ${jump.delta.toFixed(3)}`)
            .join(', ')}{' '}
          — 먼저 &quot;홈 이동&quot;을 권장합니다
        </Warning>
      )}
      {violations.length > 0 && (
        <Warning testId="teach-limit-violation-warning">
          관절 한계 {violations.some((v) => v.status === 'over') ? '초과' : '근접'}:{' '}
          {violations.map((v) => `J${v.controllerIndex}`).join(', ')}
        </Warning>
      )}
      {sampling && !sampling.uniform && (
        <Warning testId="teach-sampling-warning">
          샘플 간격이 고르지 않습니다 (최대 {sampling.spread.toFixed(1)}배). 재생은 시간
          축을 무시하고 균일 간격으로 재현하므로 티칭한 속도와 달라집니다.
        </Warning>
      )}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            조인트 궤적
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            {data.controllerIndices.map((index, series) => {
              const shown = visible[series] ?? true
              return (
                <button
                  key={index}
                  type="button"
                  data-testid={`teach-series-toggle-${index}`}
                  aria-pressed={shown}
                  onClick={() =>
                    setVisible((current) =>
                      current.map((show, i) => (i === series ? !show : show)),
                    )
                  }
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                    shown ? '' : 'bg-slate-800 text-slate-500'
                  }`}
                  style={
                    shown
                      ? {
                          color: seriesColor(series),
                          // 0x26 ≈ 15% alpha, the tint the chips use behind the
                          // series colour.
                          backgroundColor: `${seriesColor(series)}26`,
                        }
                      : undefined
                  }
                >
                  J{index}
                </button>
              )
            })}
          </div>
        </div>
        <TrajectoryChart
          data={toWaveformData(data)}
          labels={data.controllerIndices.map((index) => `J${index}`)}
          visible={visible}
          height={260}
          testId="teach-preview-chart"
        />
      </div>
    </div>
  )
}
