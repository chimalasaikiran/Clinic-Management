import { describe, expect, it } from 'vitest'
import { isUnread, settle } from './useReadAlerts'

describe('read alerts', () => {
  const seen = { waiting: { count: 5, urgent: 0 }, results: { count: 4, urgent: 1 } }

  it('is unread only for something new', () => {
    expect(isUnread({ id: 'refunds', count: 1 }, seen)).toBe(true)
    expect(isUnread({ id: 'waiting', count: 5 }, seen)).toBe(false)
    expect(isUnread({ id: 'waiting', count: 6 }, seen)).toBe(true)
    expect(isUnread({ id: 'results', count: 4, urgent: 2 }, seen)).toBe(true)
  })

  it('notices a new item after earlier ones were handled, and forgets finished kinds', () => {
    const after = settle(seen, [{ id: 'waiting', count: 3 }])
    expect(after).toEqual({ waiting: { count: 3, urgent: 0 } })
    expect(isUnread({ id: 'waiting', count: 4 }, after)).toBe(true)
    expect(isUnread({ id: 'results', count: 1 }, after)).toBe(true)
  })
})
