import { describe, expect, it } from 'vitest'
import { addDays, dayGrid, dayStats, sessionSlots, slotOf, validateWalkIn, windowsOn } from './logic'

// 2026-11-16 is a Monday.
const MONDAY = '2026-11-16'
const therapist = (id, availability, overrides = {}) => ({ id, displayName: `Dr. ${id}`, specialty: 'Physiotherapy', room: `Room ${id}`, slotMinutes: 30, availability, ...overrides })
const appointment = (overrides) => ({ id: 'a1', doctorId: 'one', time: '09:00', status: 'Confirmed', waitingQueue: false, room: 'Room one', patientName: 'Ananya Sharma', ...overrides })

describe('schedule grid', () => {
  it('bands times into 30-minute rows and lists a session', () => {
    expect(slotOf('10:15')).toBe('10:00')
    expect(slotOf('10:30')).toBe('10:30')
    expect(sessionSlots('afternoon')).toEqual(['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'])
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
  })

  it('shows only therapists consulting at the branch that day, and blocks bands outside their hours', () => {
    const one = therapist('one', [{ branchId: 'main', weekday: 1, start: '09:00', end: '11:00' }])
    const two = therapist('two', [{ branchId: 'main', weekday: 2, start: '09:00', end: '13:00' }])
    const three = therapist('three', [{ branchId: 'other', weekday: 1, start: '09:00', end: '13:00' }])
    expect(windowsOn(one, 'main', MONDAY)).toHaveLength(1)

    const { columns } = dayGrid([one, two, three], [appointment({})], MONDAY, 'main', 'morning')
    expect(columns.map((column) => column.doctorId)).toEqual(['one'])
    const cells = Object.fromEntries(columns[0].cells.map((cell) => [cell.slot, cell]))
    expect(cells['09:00'].appointments).toHaveLength(1)
    expect(cells['10:30'].block).toBeNull()
    expect(cells['11:00'].block).toMatchObject({ label: 'Not consulting' })
    expect(cells['08:30'].block).not.toBeNull()
  })

  it('keeps waiting-queue walk-ins off the grid and counts the day', () => {
    const one = therapist('one', [{ branchId: 'main', weekday: 1, start: '09:00', end: '11:00' }])
    const day = [
      appointment({ id: 'a1', status: 'Confirmed', time: '09:00' }),
      appointment({ id: 'a2', status: 'Arrived', time: '09:30' }),
      appointment({ id: 'a3', status: 'Arrived', waitingQueue: true, time: '09:40' }),
      appointment({ id: 'a4', status: 'Cancelled', time: '10:00' }),
      appointment({ id: 'a5', status: 'Pending Confirmation', time: '10:30' }),
    ]
    const { columns } = dayGrid([one], day, MONDAY, 'main', 'morning')
    expect(columns[0].cells.flatMap((cell) => cell.appointments).map((entry) => entry.id)).toEqual(['a1', 'a2', 'a4', 'a5'])
    expect(columns[0].booked).toBe(3)

    const stats = dayStats(columns, day, '09:15')
    expect(stats).toMatchObject({ capacity: 4, booked: 3, waiting: 2, confirmed: 1, pending: 1, cancelled: 1 })
    expect(stats.nextConfirmed).toBeUndefined()
  })
})

describe('walk-in validation', () => {
  const valid = { patientId: 'p1', doctorId: 'one', complaint: 'Acute neck pain', option: 'slot' }

  it('needs a patient, a therapist and a complaint', () => {
    expect(validateWalkIn({ patientId: '', doctorId: '', complaint: 'x', option: 'slot' }, { hasSlot: true })).toEqual({
      patientId: 'Search and select the patient, or register a new one first.',
      doctorId: 'Choose the consulting therapist.',
      complaint: 'Describe the presenting complaint (at least 5 characters).',
    })
    expect(validateWalkIn(valid, { hasSlot: true })).toEqual({})
  })

  it('sends the patient to the waiting queue when no slot is left', () => {
    expect(validateWalkIn(valid, { hasSlot: false }).slot).toMatch(/waiting queue/)
    expect(validateWalkIn({ ...valid, option: 'queue' }, { hasSlot: false })).toEqual({})
  })
})
