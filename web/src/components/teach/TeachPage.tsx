import { useCallback, useEffect, useReducer } from 'react'
import { isAnyRobotOperating } from '../../lib/robotState'
import { listMotionFiles, reloadConfig } from '../../lib/teachServices'
import { useConnectionStore } from '../../store/connectionStore'
import { MotionLibrary } from './MotionLibrary'
import { PlaybackPanel } from './PlaybackPanel'
import { RecordStudio } from './RecordStudio'
import { SafetyStrip } from './SafetyStrip'
import { initialTeachState, teachReducer } from './teachState'
import { errorText } from './teachUi'

export function TeachPage() {
  const connected = useConnectionStore((store) => store.connected)
  const robotState = useConnectionStore((store) => store.robotState)
  const fetchMotorConfig = useConnectionStore((store) => store.fetchMotorConfig)
  const recordingStatus = useConnectionStore((store) => store.recordingStatus)
  const [state, dispatch] = useReducer(teachReducer, initialTeachState)

  useEffect(() => {
    if (recordingStatus) {
      dispatch({
        type: 'recording_status',
        active: recordingStatus.active,
        file: recordingStatus.file_name,
      })
    }
  }, [recordingStatus])

  // robot_manager_node refuses reload_config while a robot is moving. Block the
  // writes up front rather than letting them fail late. Unknown state (no
  // robot_manager running, e.g. mock_dev) stays permissive.
  const configLocked = isAnyRobotOperating(robotState)

  const refreshFiles = useCallback(async () => {
    const response = await listMotionFiles()
    if (response.success) {
      dispatch({
        type: 'files_loaded',
        files: response.files,
        activeFile: response.active_file,
      })
    } else {
      dispatch({ type: 'feedback', message: response.message })
    }
  }, [])

  useEffect(() => {
    if (!connected) {
      return
    }
    refreshFiles().catch((error) =>
      dispatch({ type: 'feedback', message: `서비스 호출 실패: ${errorText(error)}` }),
    )
    // Joint limits drive the readiness gate, so the teach tab cannot rely on the
    // dashboard having been visited first.
    fetchMotorConfig()
  }, [connected, refreshFiles, fetchMotorConfig])

  const run = useCallback(async (action: () => Promise<void>) => {
    dispatch({ type: 'busy', busy: true })
    try {
      await action()
    } catch (error) {
      dispatch({ type: 'feedback', message: `서비스 호출 실패: ${errorText(error)}` })
    } finally {
      dispatch({ type: 'busy', busy: false })
    }
  }, [])

  // robot_manager_node holds the robot YAML in memory, so every write to it must
  // be followed by a reload. Returns a suffix to append to the caller's message.
  const reloadAfterChange = useCallback(async () => {
    try {
      const reload = await reloadConfig()
      return reload.success ? ' · 설정 리로드 완료' : ` · ${reload.message}`
    } catch (error) {
      return ` · 리로드 실패: ${errorText(error)}`
    }
  }, [])

  return (
    <>
      <SafetyStrip />
      <p className="mt-2 text-xs text-slate-500">
        조이스틱도 같은 토크 요청 토픽에 쓰기 때문에, 여기서 설정한 토크 상태가 조이스틱
        조작으로 덮어써질 수 있습니다.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecordStudio
          state={state}
          dispatch={dispatch}
          run={run}
          refreshFiles={refreshFiles}
          reloadAfterChange={reloadAfterChange}
        />
        <MotionLibrary
          state={state}
          dispatch={dispatch}
          run={run}
          configLocked={configLocked}
          refreshFiles={refreshFiles}
          reloadAfterChange={reloadAfterChange}
        />
      </div>
      <PlaybackPanel
        state={state}
        dispatch={dispatch}
        run={run}
        reloadAfterChange={reloadAfterChange}
      />
      <p data-testid="teach-feedback" className="mt-3 min-h-5 text-xs text-slate-400">
        {connected
          ? state.feedback ?? '토크를 해제한 뒤 녹화를 시작하세요.'
          : 'ROS 연결 후 사용할 수 있습니다.'}
      </p>
    </>
  )
}
