import { addDays, weekdayOf } from '../scheduling/clinic-time'
import { blockedRanges, type LeaveBlock } from '../scheduling/slots'

// The Operations report worked out from appointment records, free of the database so each measure can be tested.
// Dates are clinic-local YYYY-MM-DD; instants are milliseconds.

export interface ReportAppointment {
  id: string
  patientId: string
  practitionerId: string
  branchId: string
  // Local start date and minutes after midnight, and the length in minutes.
  date: string
  startMinute: number
  minutes: number
  status: 'pending' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  type: string
  arrivedAt: number | null
  // When the consultation was started, from its 'start' event.
  startedAt: number | null
  // When it was cancelled or marked no-show, from that event.
  closedAt: number | null
  rescheduled: boolean
}

export interface Booking {
  patientId: string
  createdAt: number
}

export interface Window {
  practitionerId: string
  branchId: string
  weekday: number
  startMinute: number
  endMinute: number
}

export interface OperationsInput {
  from: string
  to: string
  today: string
  now: number
  appointments: ReportAppointment[]
  // Bookings made from the start of the period to a week after its end, for the rebooking measure.
  bookings: Booking[]
  practitioners: Array<{ id: string; name: string }>
  availability: Window[]
  leaves: Array<LeaveBlock & { practitionerId: string }>
  // Branches in the report's scope.
  branchIds: string[]
}

const WEEK = 7 * 24 * 60 * 60 * 1000
const OPEN = new Set(['pending', 'confirmed', 'arrived', 'in_progress'])
const TYPE_LABELS: Record<string, string> = { consultation: 'Consultation', follow_up: 'Follow-up', procedure: 'Procedure', diagnostic_review: 'Diagnostic review' }

const overlap = (start: number, end: number, ranges: Array<{ startMinute: number; endMinute: number }>) =>
  ranges.reduce((total, range) => total + Math.max(0, Math.min(end, range.endMinute) - Math.max(start, range.startMinute)), 0)

function outcome(rows: ReportAppointment[]) {
  const count = (test: (row: ReportAppointment) => boolean) => rows.filter(test).length
  return {
    completed: count((row) => row.status === 'completed'),
    cancelled: count((row) => row.status === 'cancelled'),
    noShow: count((row) => row.status === 'no_show'),
    open: count((row) => OPEN.has(row.status)),
  }
}

export function datesBetween(from: string, to: string) {
  const dates: string[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}

export function operationsReport(input: OperationsInput) {
  const rows = input.appointments
  const totals = outcome(rows)

  // Seven-day windows from the first day; the last one may be shorter and says so.
  const windows: Array<{ from: string; to: string; days: number } & ReturnType<typeof outcome>> = []
  for (let start = input.from; start <= input.to; start = addDays(start, 7)) {
    const end = addDays(start, 6) < input.to ? addDays(start, 6) : input.to
    windows.push({ from: start, to: end, days: datesBetween(start, end).length, ...outcome(rows.filter((row) => row.date >= start && row.date <= end)) })
  }

  // Check-in to the start of the consultation, for completed visits that have both.
  const waits = rows.filter((row) => row.status === 'completed' && row.arrivedAt !== null && row.startedAt !== null && row.startedAt >= row.arrivedAt)
  const waitMinutes = waits.reduce((total, row) => total + (row.startedAt! - row.arrivedAt!) / 60_000, 0)

  // A cancellation or no-show is "replaced" when the same patient books again within seven days of it. Events less
  // than seven days old have not had the full week yet and are counted apart.
  const closed = rows.filter((row) => (row.status === 'cancelled' || row.status === 'no_show') && row.closedAt !== null)
  const mature = closed.filter((row) => row.closedAt! + WEEK <= input.now)
  const replaced = mature.filter((row) => input.bookings.some((booking) => booking.patientId === row.patientId && booking.createdAt > row.closedAt! && booking.createdAt <= row.closedAt! + WEEK))

  // Utilization over the days already passed: consulting minutes of completed visits against the weekly windows,
  // less leave and blocked time.
  const lastDay = input.to < input.today ? input.to : input.today
  const elapsed = input.from <= lastDay ? datesBetween(input.from, lastDay) : []
  const doctors = input.practitioners.map((practitioner) => {
    const windowsOf = input.availability.filter((window) => window.practitionerId === practitioner.id && input.branchIds.includes(window.branchId))
    const leaves = input.leaves.filter((leave) => leave.practitionerId === practitioner.id)
    let availableMinutes = 0
    for (const date of elapsed) {
      for (const window of windowsOf.filter((entry) => entry.weekday === weekdayOf(date))) {
        const blocked = blockedRanges(leaves, date, window.branchId)
        availableMinutes += window.endMinute - window.startMinute - overlap(window.startMinute, window.endMinute, blocked)
      }
    }
    const consultMinutes = rows.filter((row) => row.practitionerId === practitioner.id && row.status === 'completed' && row.date <= lastDay).reduce((total, row) => total + row.minutes, 0)
    return { id: practitioner.id, name: practitioner.name, consultMinutes, availableMinutes }
  }).filter((doctor) => doctor.availableMinutes > 0 || doctor.consultMinutes > 0)

  const completed = rows.filter((row) => row.status === 'completed')
  const services = Object.entries(TYPE_LABELS)
    .map(([type, name]) => ({ name, count: completed.filter((row) => row.type === type).length }))
    .filter((service) => service.count > 0)

  return {
    from: input.from,
    to: input.to,
    scheduled: rows.length,
    ...totals,
    rescheduled: rows.filter((row) => row.rescheduled).length,
    windows,
    wait: { pairs: waits.length, minutes: Math.round(waitMinutes), meanMinutes: waits.length ? Math.round(waitMinutes / waits.length) : null },
    rebooking: { mature: mature.length, replaced: replaced.length, immature: closed.length - mature.length },
    doctors,
    services,
  }
}
