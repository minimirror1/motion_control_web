export interface TeachState {
  files: string[]
  activeFile: string
  selectedFile: string | null
  recording: boolean
  recordingFile: string | null
  busy: boolean
  feedback: string | null
  /** Bumped to force the preview to re-fetch after the file changed on disk. */
  previewVersion: number
  /** The just-completed recording is fetched without preview downsampling. */
  previewFullResolution: boolean
}

export type TeachAction =
  | { type: 'files_loaded'; files: string[]; activeFile: string }
  | { type: 'select_file'; file: string | null }
  | { type: 'recording_started'; file: string }
  | { type: 'recording_stopped' }
  | { type: 'recording_completed'; file: string }
  | { type: 'recording_status'; active: boolean; file: string }
  | { type: 'busy'; busy: boolean }
  | { type: 'feedback'; message: string }

export const initialTeachState: TeachState = {
  files: [],
  activeFile: '',
  selectedFile: null,
  recording: false,
  recordingFile: null,
  busy: false,
  feedback: null,
  previewVersion: 0,
  previewFullResolution: false,
}

export function teachReducer(state: TeachState, action: TeachAction): TeachState {
  switch (action.type) {
    case 'files_loaded': {
      // Drop a selection whose file disappeared (deleted or renamed elsewhere).
      const selectedFile =
        state.selectedFile && action.files.includes(state.selectedFile)
          ? state.selectedFile
          : null
      // A completed recording already triggered its one full-resolution fetch.
      // Refreshing the file list must not issue the same request a second time.
      const keepCompletedPreview =
        state.previewFullResolution && selectedFile === state.selectedFile
      return {
        ...state,
        files: action.files,
        activeFile: action.activeFile,
        selectedFile,
        previewVersion: keepCompletedPreview
          ? state.previewVersion
          : state.previewVersion + 1,
        previewFullResolution: selectedFile ? state.previewFullResolution : false,
      }
    }
    case 'select_file':
      return { ...state, selectedFile: action.file, previewFullResolution: false }
    case 'recording_started':
      return { ...state, recording: true, recordingFile: action.file }
    case 'recording_stopped':
      return { ...state, recording: false, recordingFile: null }
    case 'recording_completed':
      return {
        ...state,
        recording: false,
        recordingFile: null,
        selectedFile: action.file,
        previewVersion: state.previewVersion + 1,
        previewFullResolution: true,
      }
    // The node is the source of truth, so a page reload (or a second tab) picks
    // up a recording this client never started.
    case 'recording_status':
      if (state.recording === action.active) {
        return state
      }
      return {
        ...state,
        recording: action.active,
        recordingFile: action.active ? action.file : null,
      }
    case 'busy':
      return { ...state, busy: action.busy }
    case 'feedback':
      return { ...state, feedback: action.message }
  }
}
