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
  /**
   * Normalized playback position (0 at the first sample, 1 at the last).
   * This is drawn independently of uPlot's mouse cursor so the operator can
   * keep seeing playback progress while inspecting the chart.
   */
  playbackProgress?: number | null
  height?: number
  testId?: string
}

export function TrajectoryChart({
  data,
  labels,
  visible,
  playbackProgress,
  height = 180,
  testId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<uPlot | null>(null)
  const dataRef = useRef(data)
  const playbackProgressRef = useRef<number | null>(playbackProgress ?? null)
  dataRef.current = data
  playbackProgressRef.current = playbackProgress ?? null
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
        plugins: [
          {
            hooks: {
              draw: [
                (currentPlot) => {
                  const progress = playbackProgressRef.current
                  const time = dataRef.current[0]
                  if (progress === null || time.length === 0) {
                    return
                  }

                  // Playback advances through sample indices uniformly. Convert
                  // that index back to the displayed time axis, which may have
                  // non-uniform recorded timestamps.
                  const sampleIndex = Math.min(
                    time.length - 1,
                    Math.max(0, progress) * (time.length - 1),
                  )
                  const lowerIndex = Math.floor(sampleIndex)
                  const upperIndex = Math.min(lowerIndex + 1, time.length - 1)
                  const ratio = sampleIndex - lowerIndex
                  const value =
                    time[lowerIndex] + (time[upperIndex] - time[lowerIndex]) * ratio
                  const x = currentPlot.valToPos(value, 'x', true)
                  const { ctx, bbox } = currentPlot

                  ctx.save()
                  ctx.strokeStyle = '#f8fafc'
                  ctx.globalAlpha = 0.9
                  ctx.lineWidth = 1.5
                  ctx.setLineDash([5, 4])
                  ctx.beginPath()
                  ctx.moveTo(x, bbox.top)
                  ctx.lineTo(x, bbox.top + bbox.height)
                  ctx.stroke()
                  ctx.restore()
                },
              ],
            },
          },
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
    // The plugin reads the latest ref values. Reusing the already-built paths
    // keeps live playback updates inexpensive.
    plotRef.current?.redraw(false, false)
  }, [playbackProgress])

  useEffect(() => {
    const plot = plotRef.current
    if (!plot || !visible) {
      return
    }
    visible.forEach((show, i) => plot.setSeries(i + 1, { show }))
  }, [visible])

  return <div ref={containerRef} data-testid={testId} className="w-full" />
}
