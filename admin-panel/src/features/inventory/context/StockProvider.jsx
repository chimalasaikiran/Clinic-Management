import { useCallback, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { INITIAL_STATE, supplyReducer } from '../supplyReducer'
import { StockContext } from './stockContext'

// Holds the stock, purchasing and pharmacy records in memory so a step in one screen (approve a request, dispatch,
// receive, dispense) shows up in the next. It is replaced by API calls once a backend exists.
export default function StockProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE)
  const latest = useRef(state)

  const run = useCallback((type, payload) => {
    const outcome = supplyReducer(latest.current, { type, payload })
    latest.current = outcome.state
    setState(outcome.state)
    return outcome.result
  }, [])

  const value = useMemo(() => ({ state, run }), [state, run])

  return <StockContext.Provider value={value}>{children ?? <Outlet />}</StockContext.Provider>
}
