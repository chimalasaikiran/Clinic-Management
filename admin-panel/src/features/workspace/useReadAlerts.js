import { useState } from 'react'

// Which alerts the person has already seen, remembered in this browser. An alert is a live count of open work, so
// "read" means "seen at this size": it turns unread again only when more items (or more urgent ones) appear.

const load = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? {}
  } catch {
    return {}
  }
}
const save = (key, seen) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(seen))
  } catch {
    // storage blocked: alerts count as read until the page changes
  }
}

const sizeOf = (item) => ({ count: item.count, urgent: item.urgent ?? 0 })

export function isUnread(item, seen) {
  const last = seen[item.id]
  return !last || item.count > last.count || (item.urgent ?? 0) > last.urgent
}

// Follows work down as it is handled, so that 5 → 3 → 4 reports the new one; finished kinds are forgotten.
export function settle(seen, items) {
  const next = {}
  for (const item of items) {
    const last = seen[item.id]
    if (last) next[item.id] = { count: Math.min(last.count, item.count), urgent: Math.min(last.urgent, item.urgent ?? 0) }
  }
  return next
}

// `items` is null until the alerts for this `key` have loaded.
export function useReadAlerts(key, items) {
  const [state, setState] = useState(() => ({ key, items: null, seen: load(key) }))

  // Adjusted while rendering, so the badge never shows a stale count first.
  if (state.key !== key || state.items !== items) {
    const stored = state.key === key ? state.seen : load(key)
    const seen = items ? settle(stored, items) : stored
    if (items) save(key, seen)
    setState({ key, items, seen })
  }

  const markAllRead = () => {
    if (!items) return
    const seen = Object.fromEntries(items.map((item) => [item.id, sizeOf(item)]))
    save(key, seen)
    setState((current) => ({ ...current, seen }))
  }

  return { unread: new Set((items ?? []).filter((item) => isUnread(item, state.seen)).map((item) => item.id)), markAllRead }
}
