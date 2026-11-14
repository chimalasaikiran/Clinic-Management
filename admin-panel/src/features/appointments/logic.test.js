import { describe, expect, it } from 'vitest'
import { SEED_APPOINTMENTS } from '../patients/data/seedVisits'
import { SEED_DAY_APPOINTMENTS } from './data/seedDay'
import { addDays, buildWalkIn, canConfirm, dayGrid, dayStats, firstFreeSlot, slotOf, validateWalkIn } from './logic'

const appointments = [...SEED_APPOINTMENTS, ...SEED_DAY_APPOINTMENTS]
const DAY = '2026-10-12'

describe('day grid', () => {
  it('places each appointment in its half-hour slot under the right chamber', () => {
    const { slots, columns } = dayGrid(appointments, DAY, 'morning')
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'])
    const mehta = columns.find((column) => column.chamber === '101')
    expect(mehta.cells.find((cell) => cell.slot === '10:30').appointments[0].patientId).toBe('pt-000184')
    expect(mehta.booked).toBe(4)
  })

  it('marks rostered blocks and counts them out of the capacity', () => {
    const { columns } = dayGrid(appointments, DAY, 'morning')
    const nair = columns.find((column) => column.chamber === '104')
    expect(nair.cells.filter((cell) => cell.block)).toHaveLength(2)
    expect(dayStats(appointments, DAY, 'morning').capacity).toBe(32 - 2)
  })

  it('derives the headline figures from the bookings', () => {
    expect(dayStats(appointments, DAY, 'morning')).toMatchObject({ waiting: 2, inConsultation: 0, pending: 1, cancelled: 1, confirmed: 2 })
  })

  it('rounds an off-grid time into its slot', () => {
    expect(slotOf('10:15')).toBe('10:00')
    expect(slotOf('10:45')).toBe('10:30')
  })
})

describe('free slots', () => {
  it('skips slots already held, lapsed or blocked', () => {
    expect(firstFreeSlot(appointments, DAY, 'rahul-mehta', 'morning')).toBe('11:00')
    expect(firstFreeSlot(appointments, DAY, 'rajesh-nair', 'morning', '11:00')).toBe('12:00')
  })

  it('returns nothing once the session is full', () => {
    const full = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'].map((time, index) => ({ id: `X${index}`, patientId: 'p', date: '2026-10-13', time, doctorId: 'rahul-mehta', status: 'Confirmed' }))
    expect(firstFreeSlot(full, '2026-10-13', 'rahul-mehta', 'morning')).toBeUndefined()
  })
})

describe('walk-ins', () => {
  const base = { patientId: 'pt-000305', doctorId: 'rahul-mehta', serviceCode: 'SRV-CARD-001', complaint: 'Chest tightness after exertion', option: 'slot', slot: '11:00', present: true }

  it('requires a patient, chamber, service and complaint', () => {
    const errors = validateWalkIn({ ...base, patientId: '', doctorId: '', serviceCode: '', complaint: 'ok' }, appointments, DAY)
    expect(Object.keys(errors)).toEqual(['patientId', 'doctorId', 'serviceCode', 'complaint'])
  })

  it('refuses a second open appointment with the same doctor on the same day', () => {
    expect(validateWalkIn({ ...base, patientId: 'pt-000671' }, appointments, DAY).patientId).toMatch(/already has an open appointment with Dr\. Rahul Mehta at 10:00 AM/)
  })

  it('refuses a slot allocation when the doctor has no free slot', () => {
    expect(validateWalkIn({ ...base, slot: undefined }, appointments, DAY).slot).toMatch(/waiting queue/)
  })

  it('books an arrived patient into the slot with the next OPD token', () => {
    const booked = buildWalkIn(base, { appointments, patient: { id: 'pt-000305' }, date: DAY })
    expect(booked).toMatchObject({ status: 'Arrived', time: '11:00', queueToken: 'A-19', walkIn: true, room: 'Chamber 101', tariff: 1500 })
    expect(booked.id).toBe('APT-2026-0925')
  })

  it('holds the slot as confirmed when the patient is not at the desk yet', () => {
    const booked = buildWalkIn({ ...base, present: false }, { appointments, patient: { id: 'pt-000305' }, date: DAY })
    expect(booked.status).toBe('Confirmed')
    expect(booked.queueToken).toBeUndefined()
  })

  it('puts a queue walk-in behind the others with a waiting token', () => {
    const booked = buildWalkIn({ ...base, option: 'queue', slot: undefined }, { appointments, patient: { id: 'pt-000305' }, date: DAY })
    expect(booked).toMatchObject({ waitingQueue: true, status: 'Arrived', queueToken: 'W-01' })
  })
})

describe('confirming a booking', () => {
  const pending = appointments.find((entry) => entry.status === 'Pending Confirmation')

  it('allows a pending booking whose slot is free', () => {
    expect(canConfirm(pending, appointments)).toEqual({ ok: true })
  })

  it('blocks a booking whose slot another confirmed appointment holds', () => {
    const rival = { ...pending, id: 'RIVAL', status: 'Confirmed' }
    expect(canConfirm(pending, [...appointments, rival]).error).toMatch(/already held by another confirmed appointment/)
  })

  it('only confirms pending bookings', () => {
    expect(canConfirm({ ...pending, status: 'Completed' }, appointments).ok).toBe(false)
  })
})

describe('addDays', () => {
  it('moves across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })
})
