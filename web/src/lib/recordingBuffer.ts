export interface RecordingStats {
  elapsed: number
  totalSamples: number
  /** Samples per second over the whole recording, null until two samples land. */
  rate: number | null
  controllerIndices: number[]
  min: number[]
  max: number[]
}

/** uPlot AlignedData: [xs, ...series]. */
export type WaveformData = [number[], ...number[][]]

/**
 * Ring buffer for the low-resolution browser waveform. The ROS node records the
 * full stream independently; this buffer only keeps the latest display samples.
 */
export class RecordingBuffer {
  private xs: number[] = []
  private ys: number[][] = []
  private head = 0
  private size = 0
  private startMs = 0
  private started = false

  controllerIndices: number[] = []
  totalSamples = 0
  min: number[] = []
  max: number[] = []

  constructor(private readonly capacity: number) {}

  reset(nowMs: number): void {
    this.xs = []
    this.ys = []
    this.head = 0
    this.size = 0
    this.startMs = nowMs
    this.started = true
    this.controllerIndices = []
    this.totalSamples = 0
    this.min = []
    this.max = []
  }

  push(nowMs: number, controllerIndex: number[], position: number[]): void {
    // Lock the series layout to the first sample - a controller appearing later
    // would silently shift every existing column.
    if (this.controllerIndices.length === 0) {
      if (controllerIndex.length === 0) {
        return
      }
      this.controllerIndices = [...controllerIndex]
      this.ys = controllerIndex.map(() => [])
      this.min = controllerIndex.map(() => Number.POSITIVE_INFINITY)
      this.max = controllerIndex.map(() => Number.NEGATIVE_INFINITY)
    }

    const t = (nowMs - this.startMs) / 1000
    this.xs[this.head] = t
    this.controllerIndices.forEach((index, series) => {
      const source = controllerIndex.indexOf(index)
      // Carry the previous value forward when a controller drops out of a
      // message, matching what the recorder writes to the CSV.
      const value =
        source >= 0 ? position[source] : this.ys[series][this.previousHead()] ?? 0
      this.ys[series][this.head] = value
      if (value < this.min[series]) {
        this.min[series] = value
      }
      if (value > this.max[series]) {
        this.max[series] = value
      }
    })

    this.head = (this.head + 1) % this.capacity
    this.size = Math.min(this.size + 1, this.capacity)
    this.totalSamples += 1
  }

  private previousHead(): number {
    return (this.head + this.capacity - 1) % this.capacity
  }

  /** Buffered samples in chronological order. */
  data(): WaveformData {
    const order: number[] = []
    const first = this.size < this.capacity ? 0 : this.head
    for (let i = 0; i < this.size; i += 1) {
      order.push((first + i) % this.capacity)
    }
    return [
      order.map((i) => this.xs[i]),
      ...this.ys.map((series) => order.map((i) => series[i])),
    ]
  }

  stats(nowMs: number): RecordingStats {
    const elapsed = this.started ? (nowMs - this.startMs) / 1000 : 0
    return {
      elapsed,
      totalSamples: this.totalSamples,
      rate: this.totalSamples > 1 && elapsed > 0 ? this.totalSamples / elapsed : null,
      controllerIndices: this.controllerIndices,
      min: this.min,
      max: this.max,
    }
  }
}
