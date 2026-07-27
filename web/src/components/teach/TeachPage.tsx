import { useCallback, useEffect, useReducer } from 'react'
import { isAnyRobotOperating } from '../../lib/robotState'
import { isReadyToRecord, readinessChecks } from '../../lib/teachReadiness'
import { listMotionFiles, reloadConfig } from '../../lib/teachServices'
import { useConnectionStore } from '../../store/connectionStore'
import { MotionLibrary } from './MotionLibrary'
import { PlaybackPanel } from './PlaybackPanel'
import { PrepPanel } from './PrepPanel'
import { RecordStudio } from './RecordStudio'
import { SafetyStrip } from './SafetyStrip'
import { initialTeachState, teachReducer } from './teachState'
import { errorText } from './teachUi'
import { stepStates, WorkflowSteps } from './WorkflowSteps'

export function TeachPage() {
  const connected = useConnectionStore((store) => store.connected)
  const robotState = useConnectionStore((store) => store.robotState)
  const motorStatus = useConnectionStore((store) => store.motorStatus)
  const motorConfig = useConnectionStore((store) => store.motorConfig)
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

  const checks = readinessChecks({ connected, robotState, motorStatus, motorConfig })
  const ready = isReadyToRecord(checks)
  const steps = stepStates(
    ready,
    state.recording,
    Boolean(state.selectedFile ?? state.activeFile),
  )

  return (
    <>
      <SafetyStrip />
      <WorkflowSteps states={steps} />
      {/* 준비 · 녹화·재생 · 보관함, in the order the operator works through them.
          Stacks below xl, where three columns stop fitting. */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <PrepPanel checks={checks} busy={state.busy} dispatch={dispatch} run={run} />
        <div className="flex min-w-0 flex-col gap-3">
          <RecordStudio
            state={state}
            ready={ready}
            dispatch={dispatch}
            run={run}
            refreshFiles={refreshFiles}
            reloadAfterChange={reloadAfterChange}
          />
          <PlaybackPanel
            state={state}
            dispatch={dispatch}
            run={run}
            reloadAfterChange={reloadAfterChange}
          />
        </div>
        <MotionLibrary
          state={state}
          dispatch={dispatch}
          run={run}
          configLocked={configLocked}
          refreshFiles={refreshFiles}
          reloadAfterChange={reloadAfterChange}
        />
      </div>
      <p data-testid="teach-feedback" className="mt-3 min-h-5 text-xs text-slate-400">
        {connected
          ? state.feedback ?? '토크를 해제한 뒤 녹화를 시작하세요.'
          : 'ROS 연결 후 사용할 수 있습니다.'}
      </p>
    </>
  )
}
