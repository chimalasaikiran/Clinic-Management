// The owner dashboard's figures for one clinic-local day, worked out from records the service has already read.
// Pure, so it is unit tested. Amounts are in paise; times are minutes after local midnight.

export type VisitStatus = 'pending' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface DayAppointment {
  id: string
  patientId: string
  branchId: string
  startMinute: number
  endMinute: number
  status: VisitStatus
  arrivedAt: number | null
  startedAt: number | null
  // When it was marked a no-show, for the rebooking check.
  closedAt: number | null
}

// Morning appointments start before 14:00; the rest belong to the afternoon.
export const SESSION_SPLIT = 14 * 60

const OPEN: VisitStatus[] = ['pending', 'confirmed']

export interface Tally {
  total: number
  completed: number
  waiting: number
  inConsultation: number
  upcoming: number
  noShow: number
  cancelled: number
}

export function tally(rows: DayAppointment[]): Tally {
  const count = (statuses: VisitStatus[]) => rows.filter((row) => statuses.includes(row.status)).length
  const cancelled = count(['cancelled'])
  return {
    // Cancelled appointments no longer take a slot, so they are not counted as scheduled.
    total: rows.length - cancelled,
    completed: count(['completed']),
    waiting: count(['arrived']),
    inConsultation: count(['in_progress']),
    upcoming: count(OPEN),
    noShow: count(['no_show']),
    cancelled,
  }
}

export type SessionState = 'empty' | 'not_started' | 'in_progress' | 'finished' | 'open'

export interface Session extends Tally {
  id: 'morning' | 'afternoon'
  firstStart: number | null
  lastEnd: number | null
  state: SessionState
}

// `nowMinute` is null for a past day: a session is then finished once nothing in it is still open.
export function sessions(rows: DayAppointment[], nowMinute: number | null): Session[] {
  return (['morning', 'afternoon'] as const).map((id) => {
    const own = rows.filter((row) => (id === 'morning' ? row.startMinute < SESSION_SPLIT : row.startMinute >= SESSION_SPLIT))
    const booked = own.filter((row) => row.status !== 'cancelled')
    const counts = tally(own)
    const firstStart = booked.length ? Math.min(...booked.map((row) => row.startMinute)) : null
    const lastEnd = booked.length ? Math.max(...booked.map((row) => row.endMinute)) : null
    const unfinished = counts.waiting + counts.inConsultation + counts.upcoming
    let state: SessionState
    if (firstStart === null || lastEnd === null) state = 'empty'
    else if (nowMinute === null) state = unfinished ? 'open' : 'finished'
    else if (nowMinute < firstStart && !counts.waiting && !counts.inConsultation) state = 'not_started'
    else if (nowMinute >= lastEnd && !unfinished) state = 'finished'
    else state = 'in_progress'
    return { id, ...counts, firstStart, lastEnd, state }
  })
}

// Mean minutes from check-in to the start of the consultation, over visits that have both.
export function meanWait(rows: DayAppointment[]) {
  const waits = rows.filter((row) => row.arrivedAt !== null && row.startedAt !== null && row.startedAt >= row.arrivedAt).map((row) => (row.startedAt! - row.arrivedAt!) / 60_000)
  return { pairs: waits.length, meanMinutes: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : null }
}

// No-shows whose patient has not booked again since the no-show was recorded.
export function notRebooked(rows: DayAppointment[], bookings: Array<{ patientId: string; createdAt: number }>) {
  return rows.filter((row) => row.status === 'no_show' && !bookings.some((booking) => booking.patientId === row.patientId && booking.createdAt > (row.closedAt ?? 0))).length
}

// The share of the people who were expected and either came or did not: no-shows over completed plus no-shows.
export function noShowRate(counts: Pick<Tally, 'completed' | 'noShow'>) {
  const assessable = counts.completed + counts.noShow
  return assessable ? Math.round((counts.noShow / assessable) * 1000) / 10 : null
}

export interface PaymentRow {
  amount: number
  group: 'cash' | 'upi' | 'bank' | null
}

export function collections(rows: PaymentRow[]) {
  const amount = rows.reduce((sum, row) => sum + row.amount, 0)
  const digital = rows.filter((row) => row.group === 'upi' || row.group === 'bank').reduce((sum, row) => sum + row.amount, 0)
  return { amount, count: rows.length, digitalShare: amount ? Math.round((digital / amount) * 100) : null }
}

// Percentage change from the previous figure; null when there is nothing to compare against.
export const change = (current: number, previous: number) => (previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null)

export interface InvoiceRow {
  total: number
  allocated: number
  payer: string
}

export function outstanding(rows: InvoiceRow[]) {
  const open = rows.map((row) => ({ ...row, balance: row.total - row.allocated })).filter((row) => row.balance > 0)
  const payerCount = (payers: string[]) => open.filter((row) => payers.includes(row.payer)).length
  return {
    amount: open.reduce((sum, row) => sum + row.balance, 0),
    count: open.length,
    patient: payerCount(['Patient Direct (Self)', 'Family / Caregiver']),
    insurance: payerCount(['Insurance / TPA']),
    corporate: payerCount(['Corporate Account']),
  }
}

export interface StockBatchRow {
  itemId: string
  locationId: string
  expiry: string
  posted: number
  reserved: number
  quarantine: number
}

export interface StockItemRow {
  id: string
  name: string
  reorderLevel: number
  safetyLevel: number
}

export interface StockLocationRow {
  id: string
  name: string
  branchId: string
  kind: 'store' | 'pharmacy'
}

export interface LowStock {
  itemId: string
  name: string
  locationId: string
  location: string
  branchId: string
  available: number
  level: number
}

// The same rule as the inventory screens: at each location holding the item, available stock (posted, less
// reservations and quarantine, never from expired batches) below the reorder level at a store or the safety
// level at a pharmacy, or none at all.
export function lowStock(items: StockItemRow[], locations: StockLocationRow[], batches: StockBatchRow[], today: string): LowStock[] {
  const result: LowStock[] = []
  for (const location of locations) {
    for (const item of items) {
      const rows = batches.filter((batch) => batch.itemId === item.id && batch.locationId === location.id)
      if (!rows.length) continue
      const available = rows.reduce((sum, batch) => sum + (batch.expiry < today ? 0 : Math.max(0, batch.posted - batch.reserved - batch.quarantine)), 0)
      const level = location.kind === 'store' ? item.reorderLevel : item.safetyLevel
      if (available <= 0 || available < level) result.push({ itemId: item.id, name: item.name, locationId: location.id, location: location.name, branchId: location.branchId, available, level })
    }
  }
  return result.sort((a, b) => a.available - a.level - (b.available - b.level) || a.name.localeCompare(b.name))
}

export type Presence = 'present' | 'late' | 'leave' | 'absent' | 'unavailable' | 'not_marked'

export interface TeamMember {
  id: string
  type: 'doctor' | 'staff'
  branchIds: string[]
  // The attendance marked for the day, if any.
  attendance: Presence | null
  // A whole-day leave or block covers the day.
  onLeave: boolean
}

export function presenceOf(member: TeamMember): Presence {
  if (member.attendance) return member.attendance
  return member.onLeave ? 'leave' : 'not_marked'
}

export function team(members: TeamMember[]) {
  const presence = members.map((member) => ({ member, status: presenceOf(member) }))
  const count = (statuses: Presence[], type?: TeamMember['type']) => presence.filter((entry) => statuses.includes(entry.status) && (!type || entry.member.type === type)).length
  return {
    total: members.length,
    present: count(['present', 'late']),
    late: count(['late']),
    leave: count(['leave', 'unavailable']),
    absent: count(['absent']),
    notMarked: count(['not_marked']),
    doctorsOnDuty: count(['present', 'late'], 'doctor'),
    staffOnDuty: count(['present', 'late'], 'staff'),
  }
}

export interface SetupCounts {
  branches: number
  services: number
  staff: number
  practitionersWithHours: number
  billingSettings: boolean
  stockItems: number
  stockLocations: number
  payrollSettings: boolean
}

// The configuration steps a new clinic works through, each done when its records exist.
export function setupSteps(counts: SetupCounts) {
  return [
    { id: 'organisation', done: true },
    { id: 'branches', done: counts.branches > 0 },
    { id: 'services', done: counts.services > 0 },
    { id: 'staff', done: counts.staff > 0 },
    { id: 'schedules', done: counts.practitionersWithHours > 0 },
    { id: 'billing', done: counts.billingSettings },
    { id: 'pharmacy', done: counts.stockItems > 0 && counts.stockLocations > 0 },
    { id: 'payroll', done: counts.payrollSettings },
  ]
}
