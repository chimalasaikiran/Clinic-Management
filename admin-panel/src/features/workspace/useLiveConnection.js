import { useCallback, useEffect, useRef } from 'react'
import { workspaceApi } from './api'

export const LIVE_TOPICS = ['appointments', 'notifications', 'requests']

// One event stream for the whole workspace (a browser allows only a few open connections per server), shared by
// every screen that subscribes. Events name what changed; screens reload it through the normal API.
export function useLiveConnection(orgId) {
  const listeners = useRef(new Set())

  useEffect(() => {
    const source = orgId ? workspaceApi.stream(orgId) : null
    if (!source) return undefined
    let opened = false
    const tell = (topic) => {
      for (const listener of listeners.current) if (topic === null || listener.topics.includes(topic)) listener.notify()
    }
    // The server says "ready" on every connection. After the first, something may have been missed in between.
    source.addEventListener('ready', () => {
      if (opened) tell(null)
      opened = true
    })
    for (const topic of LIVE_TOPICS) source.addEventListener(topic, () => tell(topic))
    return () => source.close()
  }, [orgId])

  return useCallback((topics, notify) => {
    const listener = { topics, notify }
    listeners.current.add(listener)
    return () => listeners.current.delete(listener)
  }, [])
}
