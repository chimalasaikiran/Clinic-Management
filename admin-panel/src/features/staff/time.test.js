import { describe, expect, it } from 'vitest'
import { formatLedgerDate, to12Hour, to24Hour } from './time'

describe('attendance time helpers', () => {
  it('converts to and from 24-hour input values', () => {
    expect(to24Hour('08:52 AM')).toBe('08:52')
    expect(to24Hour('12:05 PM')).toBe('12:05')
    expect(to24Hour('12:30 AM')).toBe('00:30')
    expect(to24Hour('09:22 PM')).toBe('21:22')
    expect(to12Hour('08:52')).toBe('08:52 AM')
    expect(to12Hour('00:30')).toBe('12:30 AM')
    expect(to12Hour('21:22')).toBe('09:22 PM')
  })

  it('returns an empty string for values it cannot parse', () => {
    expect(to24Hour('—')).toBe('')
    expect(to12Hour('')).toBe('')
  })

  it('formats ledger dates', () => {
    expect(formatLedgerDate('2026-10-16')).toBe('16 Oct 2026')
  })
})
