import { useSearchParams } from 'react-router-dom'

// Register filters kept in the address so opening a record and coming back restores the same view.
export function useRegisterFilters(defaults = {}) {
  const [params, setParams] = useSearchParams()
  const get = (key) => params.get(key) ?? defaults[key] ?? ''
  const change = (key, value) => {
    const next = new URLSearchParams(params)
    if (value && value !== (defaults[key] ?? '')) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const reset = () => setParams({}, { replace: true })
  const search = params.toString() ? `?${params.toString()}` : ''
  return { get, change, reset, search }
}
