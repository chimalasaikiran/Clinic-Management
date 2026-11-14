import { useCallback, useState } from 'react'

const read = (key, fallback) => {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

// Form state that survives leaving the page: every change is written to localStorage (when it is available)
// and picked up again next time. `clear` drops the draft once the form has been submitted.
export function useDraft(key, initial) {
  const [stored] = useState(() => read(key, null))
  const [value, setValue] = useState(() => stored?.value ?? initial)
  const [savedAt, setSavedAt] = useState(stored?.savedAt ?? null)

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next
        const stamp = new Date().toTimeString().slice(0, 8)
        try {
          window.localStorage.setItem(key, JSON.stringify({ value: resolved, savedAt: stamp }))
        } catch {
          // storage unavailable (private window, blocked site data): the form still works, it just is not remembered
        }
        setSavedAt(stamp)
        return resolved
      })
    },
    [key],
  )

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // nothing stored, nothing to clear
    }
  }, [key])

  return { value, setValue: update, savedAt, restored: Boolean(stored), clear }
}
