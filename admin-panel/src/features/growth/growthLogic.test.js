import { describe, expect, it } from 'vitest'
import { SEED_CONTENT, SEED_ESCALATIONS, SEED_REVIEWS } from './data/seed'
import { contentRows, monthGrid, privacyFindings, renderTemplate, reviewMetrics, reviewRows, shiftMonth, templateVariables, unknownVariables, validateCampaign, validateContent, validateSegment, validateWorkflow } from './growthLogic'

describe('validation', () => {
  it('checks a campaign for a positive budget, ordered dates and an https landing page', () => {
    const valid = { name: 'Campaign', objective: 'Objective', budget: '48000', start: '2026-11-01', end: '2026-11-30', cta: 'Enquire', landing: 'https://example.com/page' }
    expect(validateCampaign(valid)).toEqual({})
    expect(validateCampaign({ ...valid, budget: '0' }).budget).toBeDefined()
    expect(validateCampaign({ ...valid, end: '2026-10-01' }).end).toMatch('before the start')
    expect(validateCampaign({ ...valid, landing: 'http://example.com' }).landing).toBeDefined()
  })

  it('needs at least one lifecycle stage for a segment and a title and future date for content', () => {
    expect(validateSegment({ name: 'Segment', purpose: 'Purpose', lifecycle: [] }).lifecycle).toBeDefined()
    expect(validateSegment({ name: 'Segment', purpose: 'Purpose', lifecycle: ['New'] })).toEqual({})
    const content = { ...SEED_CONTENT[0] }
    expect(validateContent(content)).toEqual({})
    expect(validateContent({ ...content, date: '2026-10-01' }).date).toMatch('past')
    expect(validateContent({ ...content, alt: ' ' }).alt).toBeDefined()
    expect(validateWorkflow({ name: '', trigger: '' })).toEqual({ name: expect.any(String), trigger: expect.any(String) })
  })
})

describe('message templates and privacy', () => {
  const body = 'Hello {{preferred_name}}, see you on {{appointment_date}} {{ appointment_time }} {{secret}}'

  it('finds the variables used and flags the ones that are not allowed', () => {
    expect(templateVariables(body)).toEqual(['preferred_name', 'appointment_date', 'appointment_time', 'secret'])
    expect(unknownVariables(body)).toEqual(['secret'])
  })

  it('substitutes known values and leaves unknown tokens visible', () => {
    expect(renderTemplate(body, { preferred_name: 'Sam', appointment_date: '27 Oct', appointment_time: '10:00' })).toBe('Hello Sam, see you on 27 Oct 10:00 {{secret}}')
  })

  it('flags phone numbers, emails and clinical wording in a public reply', () => {
    expect(privacyFindings('Call 9876543210')).toBe(1)
    expect(privacyFindings('Write to me@example.com about your diagnosis')).toBe(2)
    expect(privacyFindings('Thank you for the feedback. Please contact the clinic.')).toBe(0)
  })
})

describe('reviews', () => {
  it('averages the sample ratings and counts each star', () => {
    const metrics = reviewMetrics(SEED_REVIEWS)
    expect(metrics.total).toBe(4)
    expect(metrics.average).toBe(3.5)
    expect(metrics.distribution.map((entry) => entry.count)).toEqual([1, 1, 1, 1, 0])
    expect(reviewMetrics([])).toMatchObject({ total: 0, average: null })
  })

  it('filters by rating, response and escalation, newest first', () => {
    expect(reviewRows(SEED_REVIEWS, {}).map((review) => review.id)).toEqual(['REV-DEMO104', 'REV-DEMO103', 'REV-DEMO102', 'REV-DEMO101'])
    expect(reviewRows(SEED_REVIEWS, { rating: '5' }).map((review) => review.id)).toEqual(['REV-DEMO103'])
    expect(reviewRows(SEED_REVIEWS, { escalated: 'Escalated', escalations: SEED_ESCALATIONS }).map((review) => review.id)).toEqual(['REV-DEMO102'])
    expect(reviewRows(SEED_REVIEWS, { response: 'Draft · approval required' }).map((review) => review.id)).toEqual(['REV-DEMO104'])
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

  it('filters content by channel and status in date order', () => {
    expect(contentRows(SEED_CONTENT, {}).map((item) => item.id)).toEqual(['CNT3102', 'CNT3103', 'CNT3104', 'CNT3101', 'CNT3105'])
    expect(contentRows(SEED_CONTENT, { status: 'Failed' }).map((item) => item.id)).toEqual(['CNT3104'])
    expect(contentRows(SEED_CONTENT, { channel: 'Instagram' }).map((item) => item.id)).toEqual(['CNT3103', 'CNT3101', 'CNT3105'])
  })
})
