import { describe, expect, it } from 'vitest'
import { ageFrom, amountInWords, daysBetween, formatDate, formatINR, formatLongDate, formatTime, initialsOf, nextId } from './format'

describe('date and time formatting', () => {
  it('formats ISO dates for the ledger and for headings', () => {
    expect(formatDate('2026-10-12')).toBe('12 Oct 2026')
    expect(formatLongDate('2026-10-12')).toBe('Mon, 12 Oct 2026')
  })

  it('converts 24-hour times to 12-hour labels', () => {
    expect(formatTime('10:30')).toBe('10:30 AM')
    expect(formatTime('16:00')).toBe('04:00 PM')
    expect(formatTime('00:05')).toBe('12:05 AM')
  })

  it('counts days between two dates', () => {
    expect(daysBetween('2026-10-12', '2026-10-22')).toBe(10)
  })
})

describe('ageFrom', () => {
  it('counts completed years only', () => {
    expect(ageFrom('1992-04-18', '2026-10-12')).toBe(34)
    expect(ageFrom('1992-10-13', '2026-10-12')).toBe(33)
  })
})

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(62500)).toBe('₹62,500')
    expect(formatINR(500000)).toBe('₹5,00,000')
    expect(formatINR(5453.6, 2)).toBe('₹5,453.60')
  })
})

describe('identifiers', () => {
  it('builds initials without honorifics', () => {
    expect(initialsOf('Dr. Rahul Mehta')).toBe('RM')
    expect(initialsOf('Ananya Sharma')).toBe('AS')
  })

  it('continues a numbered sequence', () => {
    expect(nextId('INV-2026-', ['INV-2026-084', 'INV-2026-071'])).toBe('INV-2026-085')
    expect(nextId('REF-', [])).toBe('REF-001')
  })
})

describe('amountInWords', () => {
  it('spells rupee amounts with lakh and crore units', () => {
    expect(amountInWords(7000)).toBe('Indian Rupees Seven Thousand Only')
    expect(amountInWords(45250)).toBe('Indian Rupees Forty Five Thousand Two Hundred Fifty Only')
    expect(amountInWords(500000)).toBe('Indian Rupees Five Lakh Only')
    expect(amountInWords(0)).toBe('Indian Rupees Zero Only')
  })
})
