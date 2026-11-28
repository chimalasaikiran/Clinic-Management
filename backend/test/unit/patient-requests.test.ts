import { describe, expect, it } from 'vitest'
import type { LiveEvent } from '../../src/common/realtime/live.service'
import { patientSees, staffSees, StaffViewer } from '../../src/modules/notifications/live.logic'
import { refillMessages, statusAfterMessage, supportMessages } from '../../src/modules/patient-requests/requests.logic'
import { openTicketSchema, refillDecisionSchema, staffReplySchema, ticketQueueSchema } from '../../src/modules/patient-requests/requests.schemas'

const ID = '0199aaaa-0000-7000-8000-000000000001'

describe('refill decisions', () => {
  it('needs a reason the patient can read before declining', () => {
    expect(refillDecisionSchema.safeParse({ decision: 'decline', version: 1 }).success).toBe(false)
    expect(refillDecisionSchema.safeParse({ decision: 'decline', note: 'no', version: 1 }).success).toBe(false)
    expect(refillDecisionSchema.safeParse({ decision: 'decline', note: 'Please book a review first.', version: 1 }).success).toBe(true)
    expect(refillDecisionSchema.parse({ decision: 'approve', note: '  ', version: 1 }).note).toBeNull()
  })

  it('tells the patient where to collect, and staff who is asking', () => {
    expect(refillMessages.approved('Lakeside Clinic, Baner Road', 'RX-000001').body).toContain('Collect it at the clinic pharmacy')
    expect(refillMessages.requested('Asha Rao', 'RX-000001').body).toBe('Asha Rao asked for a refill of prescription RX-000001.')
  })
})

describe('help requests', () => {
  it('asks for a real description and a known topic', () => {
    const base = { linkId: ID, category: 'Appointments', subject: 'Wrong time shown' }
    expect(openTicketSchema.safeParse({ ...base, body: 'Too short' }).success).toBe(false)
    expect(openTicketSchema.safeParse({ ...base, category: 'Billing hacks', body: 'The appointment shows the wrong time today.' }).success).toBe(false)
    expect(openTicketSchema.safeParse({ ...base, body: 'The appointment shows the wrong time today.' }).success).toBe(true)
  })

  it('reopens on a patient message and answers or resolves on a staff reply', () => {
    expect(statusAfterMessage('patient')).toBe('open')
    expect(statusAfterMessage('staff')).toBe('answered')
    expect(statusAfterMessage('staff', true)).toBe('resolved')
    expect(staffReplySchema.parse({ body: 'Fixed now.' }).resolve).toBe(false)
  })

  it('lists requests waiting on either side by default', () => {
    expect(ticketQueueSchema.parse({}).status).toBe('active')
  })

  it('names the clinic to the patient and the patient to staff', () => {
    expect(supportMessages.answered('Lakeside Clinic, Baner Road', 'HLP-000001').body).toBe('Lakeside Clinic, Baner Road replied to HLP-000001.')
    expect(supportMessages.opened('Asha Rao', 'HLP-000001', 'Wrong time').body).toBe('Asha Rao (HLP-000001): Wrong time')
  })
})

describe('who hears about a request', () => {
  const refill: LiveEvent = { topic: 'requests', orgId: 'org', entityId: 'r', branchId: 'north', patientId: 'pat', kind: 'refill' }
  const support: LiveEvent = { ...refill, kind: 'support' }
  const viewer = (permissions: string[], branches: 'all' | string[] = 'all'): StaffViewer => ({
    orgId: 'org', membershipId: 'm', canViewBookings: false, permissions: new Set(permissions), scope: { appointments: 'all', patients: 'all', branches },
  })

  it('reaches the staff who work that queue at that branch', () => {
    expect(staffSees(refill, viewer(['pharmacy.view']))).toBe(true)
    expect(staffSees(refill, viewer(['clinical.read']))).toBe(true)
    expect(staffSees(refill, viewer(['patients.view']))).toBe(false)
    expect(staffSees(support, viewer(['patients.view']))).toBe(true)
    expect(staffSees(support, viewer(['patients.view'], ['south']))).toBe(false)
  })

  it('reaches the patient whose request it is', () => {
    expect(patientSees(refill, { accountId: 'acc', patientIds: new Set(['pat']) })).toBe(true)
    expect(patientSees(refill, { accountId: 'acc', patientIds: new Set(['other']) })).toBe(false)
  })
})
