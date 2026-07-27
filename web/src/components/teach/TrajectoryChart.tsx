import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import type { WaveformData } from '../../lib/recordingBuffer'

// Slate-friendly, distinguishable at 1px stroke width. Cycles for >8 joints.
export const SERIES_COLORS = [
  '#38bdf8',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#f472b6',
  '#22d3ee',
  '#a3e635',
]

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

const AXIS_STYLE = {
  stroke: '#94a3b8',
  grid: { stroke: '#1e293b', width: 1 },
  ticks: { stroke: '#1e293b', width: 1 },
}

interface Props {
  data: WaveformData
  labels: string[]
  /** Series index -> visible. Hidden series stay in the data but are not drawn. */
  visible?: boolean[]
  height?: number
  testId?: string
}

export function TrajectoryChart({
  data,
  labels,
  visible,
  height = 180,
  testId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<uPlot | null>(null)
  // uPlot is destroyed and rebuilt only when the series layout changes; data and
  // visibility updates go through the imperative API to avoid canvas churn.
  const layoutKey = labels.join('|')

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const plot = new uPlot(
      {
        width: container.clientWidth || 600,
        height,
        legend: { show: false },
        cursor: { drag: { x: true, y: false } },
        scales: { x: { time: false } },
        axes: [AXIS_STYLE, AXIS_STYLE],
        series: [
          { label: 't' },
          ...labels.map((label, i) => ({
            label,
            stroke: seriesColor(i),
            width: 1.5,
          })),
        ],
      },
      data as uPlot.AlignedData,
      container,
    )
    plotRef.current = plot

    const observer = new ResizeObserver(() =>
      plot.setSize({ width: container.clientWidth || 600, height }),
    )
    observer.observe(container)

    return () => {
      observer.disconnect()
      plot.destroy()
      plotRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, height])

  useEffect(() => {
    plotRef.current?.setData(data as uPlot.AlignedData)
  }, [data])

  useEffect(() => {
    const plot = plotRef.current
    if (!plot || !visible) {
      return
    }
    visible.forEach((show, i) => plot.setSeries(i + 1, { show }))
  }, [visible])

  return <div ref={containerRef} data-testid={testId} className="w-full" />
}
