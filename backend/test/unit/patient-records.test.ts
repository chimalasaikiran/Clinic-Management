import { describe, expect, it } from 'vitest'
import { recordMessage } from '../../src/modules/notifications/notification.logic'
import { patientSees, staffSees } from '../../src/modules/notifications/live.logic'
import { courseEnd, newestFirst, orderSteps, releasedResult } from '../../src/modules/patient-records/records.logic'
import { orderListSchema } from '../../src/modules/patient-records/records.schemas'

const at = (iso: string) => new Date(iso)

describe('test results for patients', () => {
  const resulted = { status: 'awaiting_review' as const, resultSummary: 'HbA1c 11.2%', resultFlag: 'critical' as const, reviewOutcome: null }

  it('stays hidden until a clinician has reviewed it', () => {
    expect(releasedResult(resulted, null)).toBeNull()
    expect(releasedResult({ ...resulted, status: 'reviewed', reviewOutcome: 'normal' }, at('2026-11-27T10:00:00Z'))).toEqual({
      summary: 'HbA1c 11.2%',
      flag: 'critical',
      followUp: false,
      reviewedAt: '2026-11-27T10:00:00.000Z',
    })
  })

  it('asks the patient to talk to the clinic when the review calls for action', () => {
    expect(releasedResult({ ...resulted, status: 'reviewed', reviewOutcome: 'action' }, null)?.followUp).toBe(true)
    expect(releasedResult({ ...resulted, status: 'reviewed', reviewOutcome: 'escalate' }, null)?.followUp).toBe(true)
  })

  it('lists order progress oldest first, without notes or steps patients do not see', () => {
    const steps = orderSteps([
      { action: 'resulted', createdAt: at('2026-11-27T09:00:00Z') },
      { action: 'ordered', createdAt: at('2026-11-26T09:00:00Z') },
      { action: 'internal_flag', createdAt: at('2026-11-26T10:00:00Z') },
    ])
    expect(steps).toEqual([
      { action: 'ordered', at: '2026-11-26T09:00:00.000Z' },
      { action: 'resulted', at: '2026-11-27T09:00:00.000Z' },
    ])
    expect(steps[1]).not.toHaveProperty('note')
  })
})

describe('prescriptions and the timeline', () => {
  it('ends a course on the last day of its longest medicine', () => {
    expect(courseEnd('2026-11-27', [5, 30])).toBe('2026-12-26')
    expect(courseEnd('2026-11-27', [])).toBe('2026-11-27')
  })

  it('orders the timeline newest first', () => {
    const entry = (id: string, iso: string) => ({ kind: 'order' as const, id, at: iso, title: '', detail: '', clinicName: '' })
    expect([entry('a', '2026-01-01'), entry('b', '2026-03-01')].sort(newestFirst).map((item) => item.id)).toEqual(['b', 'a'])
  })

  it('accepts only known order filters', () => {
    expect(orderListSchema.parse({}).scope).toBe('all')
    expect(orderListSchema.safeParse({ scope: 'everything' }).success).toBe(false)
  })
})

describe('record notifications', () => {
  it('say where to look without any clinical detail', () => {
    const message = recordMessage('result_ready', 'Lakeside Clinic, Baner Road')
    expect(message.body).toBe('A test result from Lakeside Clinic, Baner Road has been reviewed by your doctor.')
  })

  it('reach the patient whose record changed, and staff only with clinical access', () => {
    const event = { topic: 'records' as const, orgId: 'org', entityId: 'rx', patientId: 'pat', branchId: 'north' }
    expect(patientSees(event, { accountId: 'acc', patientIds: new Set(['pat']) })).toBe(true)
    expect(patientSees(event, { accountId: 'acc', patientIds: new Set(['other']) })).toBe(false)
    expect(staffSees(event, { orgId: 'org', membershipId: 'm', canViewBookings: true, permissions: new Set<string>(), scope: { appointments: 'all', patients: 'all', branches: 'all' } })).toBe(false)
  })
})
