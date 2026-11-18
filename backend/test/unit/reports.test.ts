import { describe, expect, it } from 'vitest'
import { periodSchema } from '../../src/modules/reports/reports.controller'
import { datesBetween, operationsReport, type OperationsInput, type ReportAppointment } from '../../src/modules/reports/operations.logic'

const HOUR = 60 * 60 * 1000
const at = (date: string, time = '09:00') => Date.parse(`${date}T${time}:00Z`)

const visit = (id: string, date: string, status: ReportAppointment['status'], extra: Partial<ReportAppointment> = {}): ReportAppointment => ({
  id, patientId: `p-${id}`, practitionerId: 'dr-1', branchId: 'b-1', date, startMinute: 540, minutes: 30, status, type: 'consultation',
  arrivedAt: null, startedAt: null, closedAt: null, rescheduled: false, ...extra,
})

const input = (appointments: ReportAppointment[], extra: Partial<OperationsInput> = {}): OperationsInput => ({
  from: '2026-11-02', to: '2026-11-15', today: '2026-11-18', now: at('2026-11-18', '12:00'), appointments, bookings: [],
  practitioners: [{ id: 'dr-1', name: 'Dr. Rahul Mehta' }],
  // Mondays 09:00–13:00.
  availability: [{ practitionerId: 'dr-1', branchId: 'b-1', weekday: 1, startMinute: 540, endMinute: 780 }],
  leaves: [], branchIds: ['b-1'], ...extra,
})

describe('operations report', () => {
  it('counts final outcomes once each, with appointments still open apart', () => {
    const report = operationsReport(input([
      visit('a', '2026-11-02', 'completed'), visit('b', '2026-11-03', 'cancelled'), visit('c', '2026-11-09', 'no_show'),
      visit('d', '2026-11-10', 'completed', { rescheduled: true }), visit('e', '2026-11-15', 'confirmed'),
    ]))
    expect(report).toMatchObject({ scheduled: 5, completed: 2, cancelled: 1, noShow: 1, open: 1, rescheduled: 1 })
    expect(report.windows.map((window) => [window.from, window.to, window.days, window.completed, window.cancelled, window.noShow, window.open])).toEqual([
      ['2026-11-02', '2026-11-08', 7, 1, 1, 0, 0],
      ['2026-11-09', '2026-11-15', 7, 1, 0, 1, 1],
    ])
  })

  it('labels a short last window by its days', () => {
    expect(operationsReport(input([], { to: '2026-11-11' })).windows.map((window) => window.days)).toEqual([7, 3])
  })

  it('averages the wait from check-in to the start of the consultation, for visits that have both', () => {
    const report = operationsReport(input([
      visit('a', '2026-11-02', 'completed', { arrivedAt: at('2026-11-02', '08:50'), startedAt: at('2026-11-02', '09:10') }),
      visit('b', '2026-11-09', 'completed', { arrivedAt: at('2026-11-09', '08:55'), startedAt: at('2026-11-09', '09:05') }),
      visit('c', '2026-11-09', 'completed', { arrivedAt: at('2026-11-09', '08:55') }),
    ]))
    expect(report.wait).toEqual({ pairs: 2, minutes: 30, meanMinutes: 15 })
  })

  it('counts a cancellation as replaced when the patient books again within a week, once the week has passed', () => {
    const report = operationsReport(input([
      visit('a', '2026-11-02', 'cancelled', { closedAt: at('2026-11-01') }),
      visit('b', '2026-11-03', 'no_show', { closedAt: at('2026-11-03') }),
      visit('c', '2026-11-15', 'cancelled', { closedAt: at('2026-11-14') }),
    ], { bookings: [{ patientId: 'p-a', createdAt: at('2026-11-04') }, { patientId: 'p-b', createdAt: at('2026-11-03') - HOUR }] }))
    expect(report.rebooking).toEqual({ mature: 2, replaced: 1, immature: 1 })
  })

  it('sets consulting minutes against the weekly windows less leave, over the days already passed', () => {
    const report = operationsReport(input([visit('a', '2026-11-02', 'completed', { minutes: 60 }), visit('b', '2026-11-16', 'completed')], {
      to: '2026-11-20',
      // A half-day block on 9 November.
      leaves: [{ practitionerId: 'dr-1', startDate: '2026-11-09', endDate: '2026-11-09', startMinute: 540, endMinute: 660, branchId: null }],
    }))
    // Mondays 2, 9 and 16 November: 240 + 120 + 240 minutes; the visit on the 16th has passed too.
    expect(report.doctors).toEqual([{ id: 'dr-1', name: 'Dr. Rahul Mehta', consultMinutes: 90, availableMinutes: 600 }])
    expect(report.services).toEqual([{ name: 'Consultation', count: 2 }])
  })

  it('accepts periods of up to a year, in order', () => {
    expect(datesBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    expect(periodSchema.safeParse({ from: '2026-11-10', to: '2026-11-01' }).success).toBe(false)
    expect(periodSchema.safeParse({ from: '2025-01-01', to: '2026-11-01' }).success).toBe(false)
    expect(periodSchema.parse({ from: '2026-11-01', to: '2026-11-30' })).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
})
