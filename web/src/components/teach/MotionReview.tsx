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

function Warning({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p data-testid={testId} className="text-xs text-amber-400">
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
  const speeds = peakSpeeds(data)

  return (
    <div data-testid="teach-motion-review" className="mt-3">
      <TrajectoryChart
        data={toWaveformData(data)}
        labels={data.controllerIndices.map((index) => `J${index}`)}
        visible={visible}
        height={200}
        testId="teach-preview-chart"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {data.controllerIndices.map((index, series) => (
          <button
            key={index}
            type="button"
            data-testid={`teach-series-toggle-${index}`}
            aria-pressed={visible[series] ?? true}
            onClick={() =>
              setVisible((current) =>
                current.map((show, i) => (i === series ? !show : show)),
              )
            }
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              visible[series] ?? true
                ? 'bg-slate-700 text-slate-100'
                : 'bg-slate-900 text-slate-500'
            }`}
          >
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: seriesColor(series) }}
            />
            J{index}
          </button>
        ))}
      </div>
      <p data-testid="teach-preview-summary" className="mt-2 text-xs text-slate-400">
        {data.duration > 0
          ? `${data.duration.toFixed(1)}초 · `
          : '시간 행 없음 · '}
        {data.controllerIndices.length}축 · {formatCount(data.totalSamples)} 샘플 ·
        최대 속도 {Math.max(...speeds.map((speed) => speed.peak), 0).toFixed(2)}/s
      </p>
      <div className="mt-2 space-y-1">
        {jumps.length > 0 && (
          <Warning testId="teach-start-jump-warning">
            재생 시작 시 급이동:{' '}
            {jumps
              .slice(0, 3)
              .map((jump) => `J${jump.controllerIndex} ${jump.delta.toFixed(3)}`)
              .join(', ')}
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
            샘플 간격이 고르지 않습니다 (최대 {sampling.spread.toFixed(1)}배). 재생은
            시간 축을 무시하고 균일 간격으로 재현하므로 티칭한 속도와 달라집니다.
          </Warning>
        )}
      </div>
    </div>
  )
}
