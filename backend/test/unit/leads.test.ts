import { describe, expect, it } from 'vitest'
import { clinicInstant, cohortWindow, describeChanges, dueState, dueWindows, funnel } from '../../src/modules/leads/leads.logic'
import { createLeadSchema, interactionSchema } from '../../src/modules/leads/leads.schemas'

const ZONE = 'Asia/Kolkata'
// 10:00 IST on 19 Nov 2026.
const NOW = new Date('2026-11-19T04:30:00Z')

describe('lead follow-up due state', () => {
  it('is overdue once the time has passed, due today until clinic midnight, upcoming after', () => {
    expect(dueState(null, NOW, ZONE)).toBe('none')
    expect(dueState(clinicInstant('2026-11-19', '09:59', ZONE), NOW, ZONE)).toBe('overdue')
    expect(dueState(clinicInstant('2026-11-18', '18:00', ZONE), NOW, ZONE)).toBe('overdue')
    expect(dueState(clinicInstant('2026-11-19', '10:30', ZONE), NOW, ZONE)).toBe('due_today')
    expect(dueState(clinicInstant('2026-11-19', '23:59', ZONE), NOW, ZONE)).toBe('due_today')
    expect(dueState(clinicInstant('2026-11-20', '00:00', ZONE), NOW, ZONE)).toBe('upcoming')
  })

  it('bounds today in the clinic zone, not UTC', () => {
    expect(dueWindows(NOW, ZONE).endOfToday.toISOString()).toBe('2026-11-19T18:30:00.000Z')
    expect(cohortWindow('2026-11-01', '2026-11-19', ZONE)).toEqual({ gte: new Date('2026-10-31T18:30:00Z'), lt: new Date('2026-11-19T18:30:00Z') })
  })
})

describe('lead edits', () => {
  it('lists only the fields that changed, old → new', () => {
    const labels = { owner: 'Owner', email: 'Email', stage: 'Stage' }
    expect(describeChanges({ owner: 'Meera Shah', email: null, stage: 'New' }, { owner: 'Priya Nair', email: 'a@b.in', stage: 'New' }, labels)).toEqual({
      changed: ['owner', 'email'],
      text: 'Owner: Meera Shah → Priya Nair; Email: — → a@b.in',
    })
    expect(describeChanges({ owner: 'A' }, { owner: 'A' }, { owner: 'Owner' })).toEqual({ changed: [], text: '' })
  })
})

describe('conversion funnel', () => {
  const converted = new Date('2026-11-10T05:00:00Z')
  it('counts bookings and completed visits made on or after conversion, ignoring cancellations', () => {
    const leads = [
      { stage: 'converted' as const, patientId: 'p1', convertedAt: converted },
      { stage: 'converted' as const, patientId: 'p2', convertedAt: converted },
      { stage: 'converted' as const, patientId: 'p3', convertedAt: converted },
      { stage: 'qualified' as const, patientId: null, convertedAt: null },
    ]
    const appointments = [
      { patientId: 'p1', startsAt: new Date('2026-11-12T05:00:00Z'), status: 'completed' },
      { patientId: 'p2', startsAt: new Date('2026-11-20T05:00:00Z'), status: 'confirmed' },
      { patientId: 'p3', startsAt: new Date('2026-11-12T05:00:00Z'), status: 'cancelled' },
      // A visit from before the enquiry was converted is not credited to it.
      { patientId: 'p3', startsAt: new Date('2026-11-01T05:00:00Z'), status: 'completed' },
    ]
    expect(funnel(leads, appointments)).toEqual({ converted: 3, booked: 2, consulted: 1 })
  })
})

describe('lead input', () => {
  const lead = { fullName: ' Nisha Menon ', mobile: '+91 98452 11029', source: 'phone', branchId: '01930000-0000-7000-8000-000000000001', ownerMembershipId: '01930000-0000-7000-8000-000000000002' }

  it('normalises contact details and needs a next action with a follow-up date', () => {
    expect(createLeadSchema.parse(lead)).toMatchObject({ fullName: 'Nisha Menon', mobile: '9845211029', email: null, stage: 'new', nextAction: null })
    expect(createLeadSchema.safeParse({ ...lead, nextDueDate: '2026-11-20' }).error?.issues[0]?.path).toEqual(['nextAction'])
    expect(createLeadSchema.safeParse({ ...lead, mobile: '12345' }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, stage: 'converted' }).success).toBe(false)
  })

  it('asks for the next action, date and reason when rescheduling', () => {
    const base = { type: 'phone_call', occurredDate: '2026-11-19', occurredTime: '09:30', outcome: 'connected', notes: 'Spoke about knee pain', ownerMembershipId: lead.ownerMembershipId, version: 1 }
    expect(interactionSchema.safeParse({ ...base, decision: 'keep' }).success).toBe(true)
    const paths = interactionSchema.safeParse({ ...base, decision: 'reschedule' }).error?.issues.map((issue) => issue.path[0])
    expect(paths).toEqual(['nextAction', 'nextDueDate', 'reason'])
  })
})
