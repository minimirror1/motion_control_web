import { useEffect, useRef } from 'react'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  // Space and Enter already activate focused buttons and edit text fields -
  // don't fire the shortcut on top of the browser's own handling.
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
  )
}

/** Binds a document-level shortcut, skipping keystrokes aimed at a control. */
export function useHotkey(key: string, handler: () => void, enabled: boolean): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== key || event.repeat || isTypingTarget(event.target)) {
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      event.preventDefault()
      handlerRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [key, enabled])
}
