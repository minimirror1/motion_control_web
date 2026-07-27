import { useEffect, useState } from 'react'
import { parseMotionData, type MotionData } from '../../lib/motionData'
import { getMotionData } from '../../lib/teachServices'
import { useConnectionStore } from '../../store/connectionStore'
import { errorText } from './teachUi'

// Enough to see the shape of a motion without shipping a 1 kHz recording over
// rosbridge as JSON.
const PREVIEW_MAX_SAMPLES = 2000

export interface MotionPreview {
  data: MotionData | null
  error: string | null
  loading: boolean
}

export function useMotionPreview(fileName: string, reloadKey = 0): MotionPreview {
  const connected = useConnectionStore((store) => store.connected)
  const [preview, setPreview] = useState<MotionPreview>({
    data: null,
    error: null,
    loading: false,
  })

  useEffect(() => {
    if (!connected || !fileName) {
      setPreview({ data: null, error: null, loading: false })
      return
    }

    let cancelled = false
    setPreview((current) => ({ ...current, loading: true }))
    getMotionData(fileName, PREVIEW_MAX_SAMPLES)
      .then((response) => {
        if (cancelled) {
          return
        }
        setPreview(
          response.success
            ? { data: parseMotionData(response), error: null, loading: false }
            : { data: null, error: response.message, loading: false },
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview({ data: null, error: errorText(error), loading: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [connected, fileName, reloadKey])

  return preview
}
