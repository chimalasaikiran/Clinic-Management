import { useEffect, useRef } from 'react'

// Calls `tick` every `ms` while the tab is visible, and again when it comes back into view, so figures on screen
// stay current without polling from a background tab.
export function useVisibleInterval(tick, ms) {
  const callback = useRef(tick)
  useEffect(() => {
    callback.current = tick
  })

  useEffect(() => {
    const visible = () => document.visibilityState !== 'hidden'
    const timer = window.setInterval(() => {
      if (visible()) callback.current()
    }, ms)
    const onVisible = () => {
      if (visible()) callback.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms])
}
