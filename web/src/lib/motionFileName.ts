export interface SanitizedName {
  /** Name the node will actually use, or null when it would be rejected. */
  name: string | null
  error: string | null
}

function hasCsvExtension(name: string): boolean {
  return name.toLowerCase().endsWith('.csv')
}

function stem(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? name : name.slice(0, dot)
}

/**
 * Mirrors sanitize_file_name() in motion_control_teach_node.cpp so the operator
 * sees the resolved name (and any rejection) before calling start_recording.
 * Keep in sync with that function.
 */
export function sanitizeMotionFileName(raw: string): SanitizedName {
  const trimmed = raw.trim()

  if (trimmed.length === 0) {
    return { name: null, error: '파일 이름이 비어 있습니다.' }
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return { name: null, error: '경로 구분자는 사용할 수 없습니다.' }
  }
  if (trimmed.startsWith('.')) {
    return { name: null, error: "'.'으로 시작할 수 없습니다." }
  }

  // The node walks a std::string byte by byte, so one multi-byte character
  // becomes one underscore per UTF-8 byte, not one per code point.
  const encoder = new TextEncoder()
  let name = Array.from(trimmed, (char) =>
    /[A-Za-z0-9._-]/.test(char) ? char : '_'.repeat(encoder.encode(char).length),
  ).join('')
  if (!hasCsvExtension(name)) {
    name += '.csv'
  }
  if (stem(name).length === 0) {
    return { name: null, error: '치환 후 이름이 비었습니다.' }
  }
  return { name, error: null }
}

/**
 * Mirrors make_auto_file_name()'s minute-resolution form in host local time.
 * The node appends a seconds suffix on collision, so this is a preview only.
 */
export function autoMotionFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `teach_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}_${pad(now.getHours())}${pad(now.getMinutes())}.csv`
}
