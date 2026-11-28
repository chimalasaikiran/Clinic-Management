import type { MessageEvent } from '@nestjs/common'
import { Subject } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveEvent } from '../../src/common/realtime/live.service'
import { liveStream, patientSees, STREAM_MAX_MS, staffSees, StaffViewer } from '../../src/modules/notifications/live.logic'
import { noticeTime, patientMessage, staffMessage } from '../../src/modules/notifications/notification.logic'
import { markReadSchema } from '../../src/modules/notifications/notifications.schemas'

const booking: LiveEvent = { topic: 'appointments', orgId: 'org', entityId: 'apt', branchId: 'north', patientId: 'pat', practitionerId: 'dr-a' }
const desk: StaffViewer = { orgId: 'org', membershipId: 'm1', canViewBookings: true, permissions: new Set(['bookings.view']), scope: { appointments: 'all', patients: 'all', branches: 'all' } }

describe('who hears a change', () => {
  it('keeps staff to their organisation, their branches and their permissions', () => {
    expect(staffSees(booking, desk)).toBe(true)
    expect(staffSees(booking, { ...desk, orgId: 'other' })).toBe(false)
    expect(staffSees(booking, { ...desk, canViewBookings: false })).toBe(false)
    expect(staffSees(booking, { ...desk, scope: { ...desk.scope, branches: ['south'] } })).toBe(false)
    expect(staffSees(booking, { ...desk, scope: { ...desk.scope, branches: ['north'] } })).toBe(true)
  })

  it('tells a therapist about their own diary, including a visit that moves away from them', () => {
    const mine = (practitionerId: string): StaffViewer => ({ ...desk, scope: { appointments: { practitionerId }, patients: { practitionerId }, branches: 'all' } })
    expect(staffSees(booking, mine('dr-a'))).toBe(true)
    expect(staffSees(booking, mine('dr-b'))).toBe(false)
    expect(staffSees({ ...booking, previousPractitionerId: 'dr-b' }, mine('dr-b'))).toBe(true)
  })

  it('delivers a notification to its recipient only', () => {
    const forMember: LiveEvent = { topic: 'notifications', orgId: 'org', entityId: 'n', membershipId: 'm1' }
    const forAccount: LiveEvent = { topic: 'notifications', orgId: 'org', entityId: 'n', accountId: 'acc' }
    expect(staffSees(forMember, desk)).toBe(true)
    expect(staffSees(forMember, { ...desk, membershipId: 'm2' })).toBe(false)
    expect(staffSees(forAccount, desk)).toBe(false)
    expect(patientSees(forAccount, { accountId: 'acc', patientIds: new Set() })).toBe(true)
    expect(patientSees(forMember, { accountId: 'acc', patientIds: new Set(['pat']) })).toBe(false)
  })

  it('tells clinicians about chart changes at their branches, and nobody else on staff', () => {
    const chart: LiveEvent = { topic: 'records', orgId: 'org', entityId: 'vitals', patientId: 'pat', branchId: 'north' }
    const clinician: StaffViewer = { ...desk, permissions: new Set(['clinical.read']) }
    expect(staffSees(chart, clinician)).toBe(true)
    expect(staffSees(chart, desk)).toBe(false)
    expect(staffSees(chart, { ...clinician, orgId: 'other' })).toBe(false)
    expect(staffSees(chart, { ...clinician, scope: { ...clinician.scope, branches: ['south'] } })).toBe(false)
    expect(staffSees(chart, { ...clinician, scope: { ...clinician.scope, branches: ['north'] } })).toBe(true)
  })

  it('tells a patient only about records their account can open', () => {
    expect(patientSees(booking, { accountId: 'acc', patientIds: new Set(['pat']) })).toBe(true)
    expect(patientSees(booking, { accountId: 'acc', patientIds: new Set(['someone-else']) })).toBe(false)
  })
})

describe('the event stream', () => {
  afterEach(() => vi.useRealTimers())

  const collect = (source: Subject<LiveEvent>, closeWhen?: (event: LiveEvent) => boolean) => {
    const seen: MessageEvent[] = []
    let done = false
    liveStream(source, (event) => event.orgId === 'org', closeWhen).subscribe({ next: (message) => seen.push(message), complete: () => (done = true) })
    return { seen, done: () => done }
  }

  it('says it is ready, then sends only ids for what the viewer may see', () => {
    vi.useFakeTimers()
    const source = new Subject<LiveEvent>()
    const { seen } = collect(source)
    source.next(booking)
    source.next({ ...booking, orgId: 'other' })
    expect(seen).toEqual([
      { type: 'ready', data: {} },
      { type: 'appointments', data: { id: 'apt' } },
    ])
  })

  it('closes after its time limit, so access is checked again on reconnect', () => {
    vi.useFakeTimers()
    const stream = collect(new Subject<LiveEvent>())
    vi.advanceTimersByTime(STREAM_MAX_MS - 1)
    expect(stream.done()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(stream.done()).toBe(true)
  })

  it('closes at once when told to, for example when linked records change', () => {
    vi.useFakeTimers()
    const source = new Subject<LiveEvent>()
    const stream = collect(source, (event) => event.topic === 'app_access')
    source.next({ topic: 'app_access', orgId: 'org', entityId: 'pat', accountId: 'acc' })
    expect(stream.done()).toBe(true)
  })
})

describe('notification wording', () => {
  const facts = { patientName: 'Asha Rao', doctorName: 'Dr. Mehta', branchName: 'Baner', when: 'Tue, 1 Dec 2026 at 9:30 am', token: 'A-04' }

  it('tells the patient when and where, without naming them or the reason', () => {
    const message = patientMessage('booked', facts)
    expect(message.body).toBe('Tue, 1 Dec 2026 at 9:30 am with Dr. Mehta at Baner.')
    expect(patientMessage('checked_in', facts).body).toContain('A-04')
  })

  it('tells staff only about changes a patient made that need attention', () => {
    expect(staffMessage('cancelled', facts)?.body).toContain('Asha Rao')
    expect(staffMessage('checked_in', facts)).toBeNull()
  })

  it('writes times in the clinic time zone', () => {
    expect(noticeTime(new Date('2026-12-01T04:00:00Z'), 'Asia/Kolkata')).toMatch(/1 Dec 2026 at 9:30/)
  })

  it('marks either chosen notifications or all of them', () => {
    expect(markReadSchema.safeParse({ all: true }).success).toBe(true)
    expect(markReadSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(markReadSchema.safeParse({}).success).toBe(false)
  })
})
