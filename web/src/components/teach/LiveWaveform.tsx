import type { RecordingStats, WaveformData } from '../../lib/recordingBuffer'
import { seriesColor, TrajectoryChart } from './TrajectoryChart'

interface Props {
  stats: RecordingStats
  data: WaveformData
}

export function LiveWaveform({ stats, data }: Props) {
  const { controllerIndices, min, max } = stats

  if (controllerIndices.length === 0) {
    return (
      <p data-testid="teach-live-waveform-empty" className="text-xs text-slate-500">
        모터 상태 수신 대기 중…
      </p>
    )
  }

  return (
    <div data-testid="teach-live-waveform">
      <TrajectoryChart
        data={data}
        labels={controllerIndices.map((index) => `J${index}`)}
        height={160}
        testId="teach-live-waveform-chart"
      />
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {controllerIndices.map((index, series) => (
          <li
            key={index}
            data-testid={`teach-live-range-${index}`}
            className="text-xs tabular-nums text-slate-400"
          >
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: seriesColor(series) }}
            />
            J{index} {(max[series] - min[series]).toFixed(3)}
          </li>
        ))}
      </ul>
    </div>
  )
}
