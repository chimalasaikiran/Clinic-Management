import { describe, expect, it } from 'vitest'
import { dashboardQuery } from '../../src/modules/dashboard/dashboard.controller'
import {
  change, collections, meanWait, noShowRate, notRebooked, outstanding, lowStock, sessions, setupSteps, tally, team,
  type DayAppointment, type TeamMember,
} from '../../src/modules/dashboard/dashboard.logic'

const at = (time: string) => Date.parse(`2026-11-18T${time}:00Z`)
const visit = (id: string, startMinute: number, status: DayAppointment['status'], extra: Partial<DayAppointment> = {}): DayAppointment => ({
  id, patientId: `p-${id}`, branchId: 'b-1', startMinute, endMinute: startMinute + 30, status, arrivedAt: null, startedAt: null, closedAt: null, ...extra,
})

describe('dashboard appointments', () => {
  const day = [
    visit('a', 540, 'completed'), visit('b', 570, 'no_show'), visit('c', 600, 'arrived'), visit('d', 630, 'cancelled'),
    visit('e', 900, 'in_progress'), visit('f', 930, 'confirmed'), visit('g', 960, 'pending'),
  ]

  it('counts the day by status, leaving cancelled appointments out of the scheduled total', () => {
    expect(tally(day)).toEqual({ total: 6, completed: 1, waiting: 1, inConsultation: 1, upcoming: 2, noShow: 1, cancelled: 1 })
    expect(noShowRate({ completed: 1, noShow: 1 })).toBe(50)
    expect(noShowRate({ completed: 0, noShow: 0 })).toBeNull()
  })

  it('splits the day at 14:00 and says where each session stands', () => {
    const [morning, afternoon] = sessions(day, 15 * 60 + 10)
    expect(morning).toMatchObject({ id: 'morning', total: 3, firstStart: 540, lastEnd: 630, state: 'in_progress' })
    expect(afternoon).toMatchObject({ id: 'afternoon', total: 3, inConsultation: 1, upcoming: 2, firstStart: 900, lastEnd: 990, state: 'in_progress' })

    const closed = [visit('a', 540, 'completed'), visit('b', 570, 'no_show')]
    expect(sessions(closed, 13 * 60).map((session) => session.state)).toEqual(['finished', 'empty'])
    expect(sessions([visit('a', 900, 'confirmed')], 9 * 60)[1]?.state).toBe('not_started')
    // A past day: anything still open stays open.
    expect(sessions([visit('a', 540, 'confirmed')], null)[0]?.state).toBe('open')
  })

  it('averages the wait over visits with both a check-in and a start', () => {
    expect(meanWait([
      visit('a', 540, 'completed', { arrivedAt: at('08:50'), startedAt: at('09:02') }),
      visit('b', 570, 'completed', { arrivedAt: at('09:20'), startedAt: at('09:28') }),
      visit('c', 600, 'arrived', { arrivedAt: at('09:55') }),
    ])).toEqual({ pairs: 2, meanMinutes: 10 })
    expect(meanWait([])).toEqual({ pairs: 0, meanMinutes: null })
  })

  it('counts no-shows the patient has not booked again since', () => {
    const missed = [visit('a', 540, 'no_show', { closedAt: at('09:30') }), visit('b', 570, 'no_show', { closedAt: at('10:00') })]
    expect(notRebooked(missed, [{ patientId: 'p-a', createdAt: at('11:00') }, { patientId: 'p-b', createdAt: at('08:00') }])).toBe(1)
  })
})

describe('dashboard money', () => {
  it('totals collections with the share paid digitally', () => {
    expect(collections([{ amount: 30000, group: 'cash' }, { amount: 50000, group: 'upi' }, { amount: 20000, group: 'bank' }])).toEqual({ amount: 100000, count: 3, digitalShare: 70 })
    expect(collections([])).toEqual({ amount: 0, count: 0, digitalShare: null })
    expect(change(11420, 10000)).toBe(14.2)
    expect(change(5000, 0)).toBeNull()
  })

  it('sums what is still owed on invoices, by payer', () => {
    expect(outstanding([
      { total: 100000, allocated: 40000, payer: 'Patient Direct (Self)' },
      { total: 50000, allocated: 50000, payer: 'Patient Direct (Self)' },
      { total: 80000, allocated: 0, payer: 'Insurance / TPA' },
      { total: 20000, allocated: 5000, payer: 'Corporate Account' },
    ])).toEqual({ amount: 155000, count: 3, patient: 1, insurance: 1, corporate: 1 })
  })
})

describe('dashboard stock, team and setup', () => {
  it('flags stock below the reorder level at a store and the safety level at a pharmacy', () => {
    const items = [{ id: 'amox', name: 'Amoxicillin 500mg', reorderLevel: 100, safetyLevel: 20 }, { id: 'para', name: 'Paracetamol 650mg', reorderLevel: 50, safetyLevel: 10 }]
    const locations = [{ id: 'store', name: 'Central store', branchId: 'b-1', kind: 'store' as const }, { id: 'rx', name: 'Pharmacy', branchId: 'b-1', kind: 'pharmacy' as const }]
    const batch = (itemId: string, locationId: string, posted: number, extra = {}) => ({ itemId, locationId, expiry: '2027-06-30', posted, reserved: 0, quarantine: 0, ...extra })
    const low = lowStock(items, locations, [
      batch('amox', 'store', 80), batch('amox', 'rx', 25),
      batch('para', 'store', 60, { reserved: 5 }), batch('para', 'rx', 40, { expiry: '2026-11-01' }),
    ], '2026-11-18')
    // Expired paracetamol leaves the pharmacy with none; amoxicillin at the store is 20 short of 100.
    expect(low.map((entry) => [entry.name, entry.location, entry.available, entry.level])).toEqual([
      ['Amoxicillin 500mg', 'Central store', 80, 100],
      ['Paracetamol 650mg', 'Pharmacy', 0, 10],
    ])
  })

  it('reads presence from the attendance marked, then whole-day leave', () => {
    const member = (id: string, type: TeamMember['type'], attendance: TeamMember['attendance'], onLeave = false): TeamMember => ({ id, type, branchIds: ['b-1'], attendance, onLeave })
    expect(team([member('1', 'doctor', 'present'), member('2', 'staff', 'late'), member('3', 'staff', null, true), member('4', 'staff', 'absent'), member('5', 'doctor', null)])).toEqual({
      total: 5, present: 2, late: 1, leave: 1, absent: 1, notMarked: 1, doctorsOnDuty: 1, staffOnDuty: 1,
    })
  })

  it('marks each setup step done once its records exist', () => {
    const steps = setupSteps({ branches: 1, services: 3, staff: 0, practitionersWithHours: 0, billingSettings: true, stockItems: 2, stockLocations: 0, payrollSettings: false })
    expect(steps.filter((step) => step.done).map((step) => step.id)).toEqual(['organisation', 'branches', 'services', 'billing'])
  })

  it('accepts an optional date and branch', () => {
    expect(dashboardQuery.parse({})).toEqual({})
    expect(dashboardQuery.safeParse({ date: '18-11-2026' }).success).toBe(false)
    expect(dashboardQuery.safeParse({ branchId: 'main' }).success).toBe(false)
  })
})
