import { describe, expect, it } from 'vitest'
import { privacyFindings as findingsInWords } from './contentView'
import { monthGrid, privacyFindings, renderTemplate, shiftMonth, templateVariables } from './growthLogic'

describe('message templates and privacy', () => {
  const body = 'Hello {{preferred_name}}, see you on {{appointment_date}} {{ appointment_time }} {{secret}}'

  it('finds the variables used, in order', () => {
    expect(templateVariables(body)).toEqual(['preferred_name', 'appointment_date', 'appointment_time', 'secret'])
  })

  it('substitutes known values and leaves unknown tokens visible', () => {
    expect(renderTemplate(body, { preferred_name: 'Sam', appointment_date: '27 Oct', appointment_time: '10:00' })).toBe('Hello Sam, see you on 27 Oct 10:00 {{secret}}')
  })

  it('flags phone numbers, emails and clinical wording in public text', () => {
    expect(privacyFindings('Call 9876543210')).toBe(1)
    expect(privacyFindings('Write to me@example.com about your diagnosis')).toBe(2)
    expect(privacyFindings('Thank you for the feedback. Please contact the clinic.')).toBe(0)
    expect(findingsInWords('Call +91 98480 22110 about your treatment')).toEqual(['a phone number', 'clinical wording'])
  })
})

describe('content calendar', () => {
  it('builds Monday-first weeks that cover the whole month', () => {
    const weeks = monthGrid(2026, 9)
    expect(weeks[0][0]).toBe('2026-09-28')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks.flat()).toContain('2026-10-31')
    expect(weeks.at(-1).at(-1)).toBe('2026-11-01')
  })

  it('moves between months across a year boundary', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})
