import { useEffect, useReducer } from 'react'
import {
  getMotorConfigYaml,
  listMotorTemplates,
  setMotorConfigYaml,
} from '../../lib/motorSettingsServices'
import {
  parseMotorManagerYaml,
  stringifyMotorManagerConfig,
  type Driver,
  type Master,
  type MotorManagerConfig,
  type Slave,
} from '../../lib/motorManagerConfig'
import { useConnectionStore } from '../../store/connectionStore'
import { ActiveConfigSummary } from './ActiveConfigSummary'
import { TemplatePicker } from './TemplatePicker'
import { MasterStep } from './MasterStep'
import { DriversStep } from './DriversStep'
import { SlavesStep } from './SlavesStep'
import { ReviewStep } from './ReviewStep'

type Step = 1 | 2 | 3 | 4 | 5

interface WizardState {
  step: Step
  templates: string[]
  activeConfig: MotorManagerConfig | null
  loadError: string | null
  draft: MotorManagerConfig | null
  saving: boolean
  saveMessage: string | null
  saveError: string | null
}

type Action =
  | { type: 'LOADED_ACTIVE'; config: MotorManagerConfig }
  | { type: 'LOAD_FAILED'; message: string }
  | { type: 'LOADED_TEMPLATES'; templates: string[] }
  | { type: 'START_DRAFT'; config: MotorManagerConfig }
  | { type: 'SET_MASTER'; master: Master }
  | { type: 'SET_DRIVERS'; drivers: Driver[] }
  | { type: 'SET_SLAVES'; slaves: Slave[] }
  | { type: 'GOTO_STEP'; step: Step }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; message: string }
  | { type: 'SAVE_FAILURE'; message: string }
  | { type: 'RESET' }

const initialState: WizardState = {
  step: 1,
  templates: [],
  activeConfig: null,
  loadError: null,
  draft: null,
  saving: false,
  saveMessage: null,
  saveError: null,
}

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'LOADED_ACTIVE':
      return { ...state, activeConfig: action.config, loadError: null }
    case 'LOAD_FAILED':
      return { ...state, loadError: action.message }
    case 'LOADED_TEMPLATES':
      return { ...state, templates: action.templates }
    case 'START_DRAFT':
      return { ...state, draft: action.config, step: 2, saveMessage: null, saveError: null }
    case 'SET_MASTER':
      if (!state.draft) return state
      return { ...state, draft: { ...state.draft, masters: [action.master] } }
    case 'SET_DRIVERS':
      if (!state.draft) return state
      return { ...state, draft: { ...state.draft, drivers: action.drivers } }
    case 'SET_SLAVES': {
      if (!state.draft) return state
      const master = state.draft.masters[0]
      if (!master) return state
      const updatedMaster = {
        ...master,
        slaves: action.slaves,
        number_of_slaves: action.slaves.length,
      }
      return { ...state, draft: { ...state.draft, masters: [updatedMaster] } }
    }
    case 'GOTO_STEP':
      return { ...state, step: action.step }
    case 'SAVE_START':
      return { ...state, saving: true, saveMessage: null, saveError: null }
    case 'SAVE_SUCCESS':
      return { ...state, saving: false, saveMessage: action.message, saveError: null }
    case 'SAVE_FAILURE':
      return { ...state, saving: false, saveError: action.message }
    case 'RESET':
      return { ...initialState, templates: state.templates, activeConfig: state.activeConfig }
    default:
      return state
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function MotorSettingsPage() {
  const connected = useConnectionStore((state) => state.connected)
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!connected) {
      return
    }
    listMotorTemplates()
      .then((response) => {
        if (response.success) {
          dispatch({ type: 'LOADED_TEMPLATES', templates: response.templates })
        }
      })
      .catch(() => {})

    getMotorConfigYaml('active')
      .then((response) => {
        if (!response.success) {
          dispatch({ type: 'LOAD_FAILED', message: response.message })
          return
        }
        try {
          dispatch({ type: 'LOADED_ACTIVE', config: parseMotorManagerYaml(response.yaml_text) })
        } catch (error) {
          dispatch({ type: 'LOAD_FAILED', message: errorText(error) })
        }
      })
      .catch((error) => dispatch({ type: 'LOAD_FAILED', message: errorText(error) }))
  }, [connected])

  const handleStartFromActive = () => {
    if (state.activeConfig) {
      dispatch({ type: 'START_DRAFT', config: structuredClone(state.activeConfig) })
    }
  }

  const handleStartFromTemplate = async (name: string) => {
    const response = await getMotorConfigYaml(name)
    if (!response.success) {
      dispatch({ type: 'LOAD_FAILED', message: response.message })
      return
    }
    try {
      dispatch({ type: 'START_DRAFT', config: parseMotorManagerYaml(response.yaml_text) })
    } catch (error) {
      dispatch({ type: 'LOAD_FAILED', message: errorText(error) })
    }
  }

  const handleSave = async () => {
    if (!state.draft) {
      return
    }
    dispatch({ type: 'SAVE_START' })
    try {
      const response = await setMotorConfigYaml(stringifyMotorManagerConfig(state.draft))
      if (response.success) {
        dispatch({
          type: 'SAVE_SUCCESS',
          message: '저장되었습니다. 변경 사항을 적용하려면 motor_manager_node 재시작 필요.',
        })
      } else {
        dispatch({ type: 'SAVE_FAILURE', message: response.message })
      }
    } catch (error) {
      dispatch({ type: 'SAVE_FAILURE', message: errorText(error) })
    }
  }

  if (!connected) {
    return <p className="text-xs text-slate-400">ROS 연결 후 사용할 수 있습니다.</p>
  }

  return (
    <section className="space-y-4">
      <ActiveConfigSummary config={state.activeConfig} error={state.loadError} />

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-200">모터 설정 마법사</h2>
          <span className="text-xs text-slate-400">{state.step} / 5 단계</span>
        </div>

        {state.step === 1 && (
          <TemplatePicker
            templates={state.templates}
            hasActiveConfig={state.activeConfig !== null}
            onStartFromActive={handleStartFromActive}
            onStartFromTemplate={handleStartFromTemplate}
          />
        )}

        {state.step === 2 && state.draft && state.draft.masters[0] && (
          <MasterStep
            master={state.draft.masters[0]}
            onChange={(master) => dispatch({ type: 'SET_MASTER', master })}
            onPrev={() => dispatch({ type: 'GOTO_STEP', step: 1 })}
            onNext={() => dispatch({ type: 'GOTO_STEP', step: 3 })}
          />
        )}

        {state.step === 3 && state.draft && (
          <DriversStep
            drivers={state.draft.drivers}
            slaves={state.draft.masters[0]?.slaves ?? []}
            onChange={(drivers) => dispatch({ type: 'SET_DRIVERS', drivers })}
            onPrev={() => dispatch({ type: 'GOTO_STEP', step: 2 })}
            onNext={() => dispatch({ type: 'GOTO_STEP', step: 4 })}
          />
        )}

        {state.step === 4 && state.draft && state.draft.masters[0] && (
          <SlavesStep
            masterType={state.draft.masters[0].type}
            slaves={state.draft.masters[0].slaves}
            drivers={state.draft.drivers}
            onChange={(slaves) => dispatch({ type: 'SET_SLAVES', slaves })}
            onPrev={() => dispatch({ type: 'GOTO_STEP', step: 3 })}
            onNext={() => dispatch({ type: 'GOTO_STEP', step: 5 })}
          />
        )}

        {state.step === 5 && state.draft && (
          <ReviewStep
            config={state.draft}
            saving={state.saving}
            saveMessage={state.saveMessage}
            saveError={state.saveError}
            onPrev={() => dispatch({ type: 'GOTO_STEP', step: 4 })}
            onSave={handleSave}
            onReset={() => dispatch({ type: 'RESET' })}
          />
        )}
      </div>
    </section>
  )
}
