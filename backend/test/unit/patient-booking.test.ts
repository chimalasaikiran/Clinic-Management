import { describe, expect, it } from 'vitest'
import { ageInYears, assignmentOrder, poolSlots, titleFor } from '../../src/modules/patient-booking/booking.logic'
import { appointmentsQuerySchema, bookSchema, clinicSlotsSchema, clinicsQuerySchema } from '../../src/modules/patient-booking/booking.schemas'
import type { Slot, SlotState } from '../../src/modules/scheduling/slots'

const slot = (time: string, state: SlotState): Slot => ({ time, state, minute: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) })
const ID = '0199aaaa-0000-7000-8000-000000000001'

describe('pooled slots', () => {
  it('offers a time while any therapist is free, and shows it as taken once none is', () => {
    const pooled = poolSlots([
      { practitionerId: 'a', slots: [slot('09:00', 'booked'), slot('09:30', 'booked')] },
      { practitionerId: 'b', slots: [slot('09:00', 'available'), slot('09:30', 'booked')] },
    ])
    expect(pooled).toEqual([
      { time: '09:00', free: ['b'] },
      { time: '09:30', free: [] },
    ])
  })

  it('leaves out times that have passed or fall in leave, and sorts the rest', () => {
    const pooled = poolSlots([
      { practitionerId: 'a', slots: [slot('11:00', 'available'), slot('09:00', 'past'), slot('10:00', 'unavailable')] },
      { practitionerId: 'b', slots: [slot('08:30', 'available')] },
    ])
    expect(pooled.map((entry) => entry.time)).toEqual(['08:30', '11:00'])
  })
})

describe('therapist assignment', () => {
  const booked = new Map([
    ['a', 5],
    ['b', 1],
  ])

  it('tries the least busy therapist first', () => {
    expect(assignmentOrder(['a', 'b', 'c'], booked)).toEqual(['c', 'b', 'a'])
  })

  it('keeps the therapist already booked when they are free', () => {
    expect(assignmentOrder(['b', 'a'], booked, 'a')).toEqual(['a', 'b'])
  })
})

describe('a record created by booking', () => {
  it('counts age by whether the birthday has passed', () => {
    expect(ageInYears('2010-06-15', '2026-06-14')).toBe(15)
    expect(ageInYears('2010-06-15', '2026-06-15')).toBe(16)
  })

  it('gives a title only where one follows from what is known', () => {
    expect(titleFor('male', 8)).toBe('Master')
    expect(titleFor('male', 30)).toBe('Mr.')
    expect(titleFor('female', 30)).toBe('Ms.')
    expect(titleFor('other', 30)).toBe('')
  })
})

describe('booking requests', () => {
  it('needs a real clinic, service, date and time, and treats an empty reason as none', () => {
    expect(bookSchema.parse({ branchId: ID, serviceId: ID, date: '2026-12-01', time: '09:30', reason: '  ' }).reason).toBeNull()
    expect(bookSchema.safeParse({ branchId: ID, serviceId: ID, date: '2026-12-01', time: '25:00' }).success).toBe(false)
    expect(bookSchema.safeParse({ branchId: 'x', serviceId: ID, date: '2026-12-01', time: '09:30' }).success).toBe(false)
  })

  it('drops fields a patient must not choose', () => {
    const parsed = bookSchema.parse({ branchId: ID, serviceId: ID, date: '2026-12-01', time: '09:30', patientId: ID, practitionerId: ID, status: 'completed', quotedFee: 0 })
    expect(Object.keys(parsed).sort()).toEqual(['branchId', 'date', 'reason', 'serviceId', 'time'])
  })

  it('limits how much one request can ask for', () => {
    expect(clinicSlotsSchema.safeParse({ serviceId: ID, from: '2026-12-01', days: 90 }).success).toBe(false)
    expect(clinicsQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false)
    expect(appointmentsQuerySchema.parse({}).scope).toBe('upcoming')
  })
})
