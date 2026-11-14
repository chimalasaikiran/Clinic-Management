import { useContext } from 'react'
import { StockContext } from './stockContext'

// `state` holds every stock and pharmacy collection; `run(type, payload)` applies one operation and returns its result.
export function useStock() {
  const value = useContext(StockContext)
  if (!value) throw new Error('useStock must be used inside <StockProvider>')
  return value
}
