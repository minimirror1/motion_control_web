export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Always pass an explicit locale: Intl throws on tags the environment can hand
// us (a C/POSIX desktop gives Chromium "en-US@posix"), and an uncaught throw in
// render blanks the whole page.
export const LOCALE = 'ko-KR'

export function formatCount(value: number): string {
  return value.toLocaleString(LOCALE)
}

export function buttonClass(className: string): string {
  return `rounded-md px-3 py-3 text-sm font-semibold text-white transition ${className} disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400`
}
