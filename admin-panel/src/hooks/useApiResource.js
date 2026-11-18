import { useCallback, useEffect, useRef, useState } from 'react'

// Loads data from the API whenever `key` changes: { data, error, loading, reload }. While a new request runs,
// the previous data stays visible (with loading = true). A response for an outdated key is ignored, so fast
// typing in a search box cannot show stale results.
export function useApiResource(load, key) {
  const loader = useRef(load)
  useEffect(() => {
    loader.current = load
  })

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ token: null, data: null, error: null })
  const token = `${key}#${attempt}`

  useEffect(() => {
    let current = true
    loader.current().then(
      (data) => current && setResult({ token, data, error: null }),
      (error) => current && setResult((previous) => ({ token, data: previous.data, error })),
    )
    return () => {
      current = false
    }
  }, [token])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  return { data: result.data, error: result.token === token ? result.error : null, loading: result.token !== token, reload }
}
