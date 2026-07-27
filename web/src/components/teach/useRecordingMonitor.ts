import { useEffect, useRef, useState } from 'react'
import {
  RecordingBuffer,
  type RecordingStats,
  type WaveformData,
} from '../../lib/recordingBuffer'
import { useConnectionStore } from '../../store/connectionStore'

const CAPACITY = 3000
// rosbridge throttles motor_status to roughly 20 Hz for the browser. Redraw at
// the same cadence so the live waveform stays lightweight without hiding
// samples that already reached the client.
const REDRAW_INTERVAL_MS = 50

const EMPTY: { stats: RecordingStats; data: WaveformData } = {
  stats: {
    elapsed: 0,
    totalSamples: 0,
    rate: null,
    controllerIndices: [],
    min: [],
    max: [],
  },
  data: [[]],
}

/**
 * Accumulates motor_status into a ring buffer while recording. Subscribes to the
 * store outside React so feedback does not trigger a render for every message;
 * the snapshot is published at the browser's low-resolution display rate.
 */
export function useRecordingMonitor(recording: boolean) {
  const bufferRef = useRef(new RecordingBuffer(CAPACITY))
  const [snapshot, setSnapshot] = useState(EMPTY)

  useEffect(() => {
    if (!recording) {
      setSnapshot(EMPTY)
      return
    }

    const buffer = bufferRef.current
    buffer.reset(performance.now())

    const unsubscribe = useConnectionStore.subscribe((state, previous) => {
      const status = state.motorStatus
      if (status && status !== previous.motorStatus) {
        buffer.push(performance.now(), status.controller_index, status.position)
      }
    })
    const timer = setInterval(
      () => setSnapshot({ stats: buffer.stats(performance.now()), data: buffer.data() }),
      REDRAW_INTERVAL_MS,
    )

    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [recording])

  return snapshot
}
