import { useEffect, useRef } from 'react'
import { useWorkspace } from './useWorkspace'

// One change often arrives as several events; they are gathered into a single reload.
export const LIVE_SETTLE_MS = 250

// Calls `refresh` when the server says something under one of `topics` changed, and after the live connection
// comes back, so a screen that is open keeps up with the patient app and with colleagues.
export function useLiveRefresh(topics, refresh) {
  const { subscribeLive } = useWorkspace()
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  })

  const key = topics.join(',')
  useEffect(() => {
    let timer = null
    const unsubscribe = subscribeLive(key.split(','), () => {
      if (timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        latest.current()
      }, LIVE_SETTLE_MS)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [key, subscribeLive])
}
