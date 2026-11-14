import { describe, expect, it } from 'vitest'
import { SEED_CONTENT, SEED_ESCALATIONS, SEED_LEADS, SEED_REVIEWS } from './data/seed'
import { contentRows, dueState, leadRows, leadSummary, monthGrid, pipelineCounts, privacyFindings, renderTemplate, reviewMetrics, reviewRows, shiftMonth, templateVariables, unknownVariables, validateCampaign, validateContent, validateInteraction, validateLead, validateSegment, validateWorkflow } from './growthLogic'

describe('lead follow-ups', () => {
  it('marks a follow-up overdue, due today or upcoming against the sample day', () => {
    const [overdue, today] = SEED_LEADS
    expect(dueState(overdue)).toBe('Overdue')
    expect(dueState(today)).toBe('Due today')
    expect(dueState({ stage: 'New', due: { date: '2026-10-30', time: '09:00' } })).toBe('Upcoming')
  })

  it('ignores the follow-up of a converted or closed lead', () => {
    expect(dueState({ ...SEED_LEADS[0], stage: 'Converted' })).toBe('None')
    expect(dueState({ ...SEED_LEADS[0], stage: 'Closed' })).toBe('None')
    expect(dueState({ ...SEED_LEADS[0], due: null })).toBe('None')
  })

  it('sorts by the next follow-up and filters by stage, owner and due state', () => {
    expect(leadRows(SEED_LEADS, {}).map((lead) => lead.id)).toEqual(['LD1048', 'LD1049', 'LD1050'])
    expect(leadRows(SEED_LEADS, { stage: 'Qualified' }).map((lead) => lead.id)).toEqual(['LD1048'])
    expect(leadRows(SEED_LEADS, { owner: 'Priya Nair' }).map((lead) => lead.id)).toEqual(['LD1049'])
    expect(leadRows(SEED_LEADS, { due: 'Due today' }).map((lead) => lead.id)).toEqual(['LD1049', 'LD1050'])
    expect(leadRows(SEED_LEADS, { query: 'dental' }).map((lead) => lead.id)).toEqual(['LD1049'])
    expect(leadRows(SEED_LEADS, { sort: 'name' }).map((lead) => lead.name)).toEqual(['Ananya Rao', 'Kavya Iyer', 'Rohan Mehta'])
  })

  it('summarises the pipeline from the lead records', () => {
    expect(leadSummary(SEED_LEADS)).toEqual({ new: 1, followUpsDue: 3, overdue: 1, qualified: 1, converted: 0 })
    expect(pipelineCounts(SEED_LEADS)).toEqual({ New: 1, Contacted: 1, Qualified: 1, Converted: 0, Closed: 0 })
  })
})

describe('validation', () => {
  it('requires a name, a 10-digit phone, a branch and an owner for a lead', () => {
    expect(validateLead({ name: '', phone: '123', email: 'x', branch: '', owner: '' })).toEqual({ name: expect.any(String), phone: expect.any(String), email: expect.any(String), branch: expect.any(String), owner: expect.any(String) })
    expect(validateLead({ name: 'Nisha Menon', phone: '90000 00004', email: '', branch: 'Jubilee Hills Clinic', owner: 'Meera Shah' })).toEqual({})
  })

  it('requires an outcome and notes, and a date and reason only when rescheduling', () => {
    expect(validateInteraction({ outcome: '', notes: '', decision: 'keep' })).toEqual({ outcome: expect.any(String), notes: expect.any(String) })
    expect(Object.keys(validateInteraction({ outcome: 'Connected', notes: 'Spoke', decision: 'reschedule', nextAction: '', nextDate: '', reason: '' }))).toEqual(['nextAction', 'nextDate', 'reason'])
    expect(validateInteraction({ outcome: 'Connected', notes: 'Spoke', decision: 'complete' })).toEqual({})
  })

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
