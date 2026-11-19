import { dashboardIcons as icons } from '../../assets/icons/dashboard'
import { ROUTES } from '../../config/routes'
import { formatINR } from '../patients/format'

// Turns the dashboard API response (backend/src/modules/dashboard) into the props of the dashboard sections.
// A section the person's role cannot see comes back null from the API and is left out here.

const pad = (value) => String(value).padStart(2, '0')
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)
const parts = (iso) => iso.split('-').map(Number)
const asDate = (iso) => {
  const [year, month, day] = parts(iso)
  return new Date(year, month - 1, day)
}
const addDays = (iso, days) => {
  const date = asDate(iso)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const shortDate = (iso) => asDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const weekday = (iso) => asDate(iso).toLocaleDateString('en-US', { weekday: 'long' })

// "09:00 AM" from minutes after midnight.
export function clock(minute) {
  const hours = Math.floor(minute / 60) % 24
  return `${pad(hours % 12 || 12)}:${pad(minute % 60)} ${hours < 12 ? 'AM' : 'PM'}`
}

// The hour on the clinic's clock, for the greeting and times shown with the activity.
const zoned = (instant, timeZone, options) => new Date(instant).toLocaleString('en-US', { timeZone, ...options })
export const clinicHour = (now, timeZone) => Number(zoned(now, timeZone, { hour: 'numeric', hourCycle: 'h23' })) % 24

export function greeting(name, hour) {
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  return name ? `Good ${part}, ${name}` : `Good ${part}`
}

// The days the dashboard can show: today and the six before it.
export function dayOptions(today) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, -index)
    const label = index === 0 ? 'Today' : index === 1 ? 'Yesterday' : asDate(date).toLocaleDateString('en-US', { weekday: 'short' })
    return { value: date, label: `${label}, ${shortDate(date)}` }
  })
}

export function relativeTime(iso, now) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${plural(Math.floor(hours / 24), 'day')} ago`
}

const rupees = (value) => formatINR(value)

export function keyMetrics(view) {
  const metrics = []
  const day = view.date === view.today ? 'today' : shortDate(view.date)
  const visits = view.appointments
  if (visits) {
    const waiting = visits.waiting + visits.inConsultation
    metrics.push({
      id: 'appointments',
      label: 'Appointments',
      icon: icons.metricAppointments,
      value: `${visits.total} scheduled`,
      detail: `${visits.completed} completed · ${waiting} waiting · ${visits.upcoming} upcoming`,
      bar: [
        { width: share(visits.completed, visits.total), className: 'bg-brand' },
        { width: share(waiting, visits.total), className: 'bg-amber-400' },
        { width: share(visits.upcoming, visits.total), className: 'bg-slate-300' },
      ],
    })
    metrics.push({
      id: 'patients',
      label: 'Patients',
      icon: icons.metricPatients,
      value: `${visits.completed} seen`,
      detail: `${visits.waiting} waiting after check-in · Avg wait: ${visits.wait.meanMinutes === null ? '—' : `${visits.wait.meanMinutes} mins`}`,
      status: view.date === view.today ? `${visits.inConsultation} in consultation now` : undefined,
    })
  }
  if (view.collections) {
    metrics.push({
      id: 'collections',
      label: 'Collections',
      icon: icons.metricCollections,
      value: rupees(view.collections.amount),
      unit: day,
      detail: `${plural(view.collections.count, 'payment')} received`,
      note: view.collections.digitalShare === null ? 'No payments yet' : `UPI / card / bank: ${view.collections.digitalShare}% of the amount`,
    })
  }
  if (view.outstanding) {
    const owed = view.outstanding
    metrics.push({
      id: 'outstanding',
      label: 'Outstanding',
      icon: icons.metricOutstanding,
      value: rupees(owed.amount),
      detail: `${plural(owed.count, 'invoice')} with a balance`,
      warning: owed.count ? `${owed.patient} patient / ${owed.insurance} insurance / ${owed.corporate} corporate` : undefined,
    })
  }
  if (visits) {
    metrics.push({
      id: 'no-shows',
      label: 'No-shows',
      icon: icons.metricNoshows,
      value: String(visits.noShow),
      unit: day,
      detail: `Rate: ${visits.noShowRate === null ? '—' : `${visits.noShowRate}%`} of attended + missed`,
      queue: { label: 'Not yet rebooked', pending: plural(visits.notRebooked, 'patient') },
    })
  }
  return metrics
}

export function attentionItems(view) {
  const items = []
  const recon = view.reconciliation
  if (recon && recon.candidates + recon.exceptions > 0) {
    items.push({
      id: 'payments',
      icon: icons.attnPayment,
      tone: 'amber',
      title: 'Payment reconciliation',
      badge: `${recon.candidates + recon.exceptions} pending`,
      description: `${plural(recon.candidates, 'statement line')} to confirm · ${plural(recon.exceptions, 'open exception')}`,
      action: 'Review',
      to: ROUTES.billingReconciliation,
      primary: true,
    })
  }
  if (view.orders?.awaitingReview) {
    const { awaitingReview, urgent, flagged } = view.orders
    items.push({
      id: 'reports',
      icon: icons.attnReports,
      tone: 'indigo',
      title: 'Results awaiting review',
      badge: plural(awaitingReview, 'result'),
      description: `${plural(awaitingReview, 'lab or imaging result')} ready for clinician review (${urgent} urgent · ${flagged} abnormal or critical)`,
      action: 'Review results',
      to: ROUTES.clinical,
    })
  }
  if (view.lowStock?.count) {
    const [first] = view.lowStock.items
    items.push({
      id: 'inventory',
      icon: icons.attnInventory,
      tone: 'rose',
      title: 'Inventory',
      badge: first.available <= 0 ? 'Out of stock' : 'Low stock',
      description: `${plural(view.lowStock.count, 'item')} below ${view.lowStock.count === 1 ? 'its' : 'their'} stock level (${first.name}: ${first.available} of ${first.level} at ${first.location})`,
      action: 'View inventory',
      to: ROUTES.inventory,
    })
  }
  const approvals = pendingApprovals(view)
  if (approvals.total) {
    items.push({
      id: 'approvals',
      icon: icons.attnStaff,
      tone: 'orange',
      title: 'Pending approvals',
      badge: `${approvals.total} pending`,
      description: approvals.parts.map((part) => part.text).join(' · '),
      action: 'Review',
      to: approvals.parts[0].to,
    })
  }
  return items
}

// Work waiting on someone's decision or entry, for the people who can act on it.
export function pendingApprovals(view) {
  const { attendanceUnmarked, payrollAdjustments, advances } = view.approvals
  const refunds = view.refunds?.pending ?? 0
  const parts = [
    attendanceUnmarked ? { text: `${plural(attendanceUnmarked, 'staff member')} without attendance ${view.date === view.today ? 'today' : 'that day'}`, to: ROUTES.staffDirectory } : null,
    refunds ? { text: `${plural(refunds, 'refund')} awaiting approval`, to: ROUTES.billingRefunds } : null,
    payrollAdjustments ? { text: `${plural(payrollAdjustments, 'payroll adjustment')} to decide`, to: ROUTES.payrollRunAdjustments } : null,
    advances ? { text: `${plural(advances, 'salary advance')} to decide`, to: ROUTES.payrollRunAdvances } : null,
  ].filter(Boolean)
  return { total: (attendanceUnmarked ?? 0) + refunds + (payrollAdjustments ?? 0) + (advances ?? 0), parts }
}

const SESSION_STATUS = {
  in_progress: { label: 'In progress', tone: 'emerald' },
  finished: { label: 'Finished', tone: 'slate' },
  not_started: { label: 'Not started', tone: 'slate' },
  empty: { label: 'No appointments', tone: 'slate' },
  open: { label: 'Not closed', tone: 'slate' },
}

export function operations(visits) {
  return {
    chips: [
      { label: 'Scheduled', value: visits.total, tone: 'slate' },
      { label: 'Completed', value: visits.completed, tone: 'emerald' },
      { label: 'Waiting', value: visits.waiting + visits.inConsultation, tone: 'amber' },
      { label: 'No-show', value: visits.noShow, tone: 'rose' },
    ],
    sessions: visits.sessions.map((session) => {
      const waiting = session.waiting + session.inConsultation
      return {
        id: session.id,
        icon: session.id === 'morning' ? icons.sessionMorning : icons.sessionAfternoon,
        title: session.id === 'morning' ? 'Morning session' : 'Afternoon session',
        window: session.firstStart === null ? (session.id === 'morning' ? '(before 02:00 PM)' : '(from 02:00 PM)') : `(${clock(session.firstStart)} – ${clock(session.lastEnd)})`,
        status: SESSION_STATUS[session.state],
        highlighted: session.state === 'in_progress',
        stats: [
          { label: plural(session.total, 'appointment'), className: 'text-slate-700' },
          { label: `${session.completed} completed`, className: 'text-emerald-700' },
          { label: `${waiting} waiting`, className: 'text-amber-700' },
          { label: `${session.upcoming} upcoming`, className: 'text-sky-700' },
          { label: `${session.noShow} no-show`, className: 'text-slate-500' },
        ],
        bar: [
          { width: share(session.completed, session.total), className: 'bg-emerald-600' },
          { width: share(waiting, session.total), className: 'bg-amber-400' },
          { width: share(session.upcoming, session.total), className: 'bg-sky-400' },
          { width: share(session.noShow, session.total), className: 'bg-slate-400' },
        ],
      }
    }),
  }
}

export function finance(view) {
  const tiles = []
  const day = view.date === view.today ? "Today's collections" : `Collections · ${shortDate(view.date)}`
  if (view.collections) {
    const { change, previous } = view.collections
    tiles.push({
      id: 'collections',
      label: day,
      value: rupees(view.collections.amount),
      note: change === null ? `Nothing received last ${weekday(view.date)} to compare` : `${change > 0 ? '+' : ''}${change}% vs last ${weekday(view.date)} (${rupees(previous.amount)})`,
      noteClass: change === null ? 'text-slate-500' : change >= 0 ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium',
    })
  }
  if (view.outstanding) tiles.push({ id: 'outstanding', label: 'Outstanding', value: rupees(view.outstanding.amount), note: `${plural(view.outstanding.count, 'invoice')} with a balance`, noteClass: 'text-slate-500' })
  if (view.refunds) tiles.push({ id: 'refunds', label: 'Refunds', value: rupees(view.refunds.amount), note: `${view.refunds.processed} processed · ${view.refunds.pending} awaiting approval`, noteClass: 'text-slate-500' })
  if (view.reconciliation) {
    const count = view.reconciliation.candidates + view.reconciliation.exceptions
    tiles.push({
      id: 'reconciliation',
      label: 'Awaiting reconciliation',
      value: plural(count, 'item'),
      valueClass: count ? 'text-amber-700' : undefined,
      note: `${view.reconciliation.candidates} to confirm · ${view.reconciliation.exceptions} exceptions`,
      noteClass: count ? 'text-amber-800 font-medium' : 'text-slate-500',
    })
  }
  if (!tiles.length) return null
  return { tiles, footnote: 'Operational financial awareness. Detailed auditing available in Billing & Finance.' }
}

export function teamStatus(view, generatedAt) {
  const team = view.team
  if (!team) return null
  const marked = team.total - team.notMarked
  return {
    total: team.total,
    presence: [
      { label: `${team.present} present`, count: team.present, labelClass: 'text-emerald-700', barClass: 'bg-emerald-600' },
      { label: `${team.leave} on leave`, count: team.leave, labelClass: 'text-amber-700', barClass: 'bg-amber-400' },
      { label: `${team.absent} absent`, count: team.absent, labelClass: 'text-rose-700', barClass: 'bg-rose-500' },
    ],
    alert: team.notMarked ? `${plural(team.notMarked, 'staff member')} without attendance marked${team.late ? ` · ${team.late} arrived late` : ''}` : null,
    shifts: [
      { label: 'Doctors', value: `${team.doctorsOnDuty} on duty` },
      { label: 'Other staff', value: `${team.staffOnDuty} on duty` },
      { label: 'Not marked', value: String(team.notMarked) },
    ],
    nextSync: `Attendance marked for ${marked} of ${plural(team.total, 'staff member')}`,
    syncStatus: `Records as of ${generatedAt}`,
  }
}

const exceptionTone = (count) => (count === 0 ? 'text-emerald-700' : count === 1 ? 'text-amber-700' : 'text-rose-700')
const BRANCH_STATUS = { active: 'Active', planned: 'Planned', paused: 'Paused', inactive: 'Inactive' }

export function locations(view) {
  return view.locations.map((row) => {
    const branch = view.branches.find((entry) => entry.id === row.id)
    return {
      id: row.id,
      code: branch.code,
      name: branch.name,
      focus: [branch.city, branch.state].filter(Boolean).join(', '),
      status: BRANCH_STATUS[branch.status] ?? branch.status,
      active: branch.status === 'active',
      appointments: row.appointments ?? '—',
      collections: row.collections === null ? '—' : rupees(row.collections),
      exceptions: row.exceptions === null ? { label: '—', className: 'text-slate-500' } : { label: plural(row.exceptions, 'item'), className: exceptionTone(row.exceptions) },
      primary: view.branchId === row.id,
    }
  })
}

const STATUS_WORDS = { present: 'present', late: 'late', absent: 'absent', leave: 'on leave', unavailable: 'unavailable' }
const DOTS = {
  emerald: 'bg-emerald-600 shadow-[0_0_0_2px_#d1fae5]',
  brand: 'bg-brand shadow-[0_0_0_2px_#ccfbf1]',
  indigo: 'bg-indigo-500 shadow-[0_0_0_2px_#e0e7ff]',
  sky: 'bg-sky-500 shadow-[0_0_0_2px_#e0f2fe]',
  amber: 'bg-amber-500 shadow-[0_0_0_2px_#fef3c7]',
  rose: 'bg-rose-500 shadow-[0_0_0_2px_#ffe4e6]',
}

function describe(entry, timeZone) {
  const d = entry.details ?? {}
  const who = entry.subject ? { strong: entry.subject } : 'a patient'
  const doctor = entry.practitioner ? [' (', { strong: entry.practitioner }, ')'] : []
  const at = entry.startsAt ? ` for ${zoned(entry.startsAt, timeZone, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''
  switch (entry.action) {
    case 'billing.payment.recorded': return ['Payment received', 'emerald', [`${rupees(d.amount ?? 0)} payment received from `, who, d.channel ? ` (${d.channel})` : '']]
    case 'billing.refund.processed': return ['Refund processed', 'amber', ['Refund ', { muted: d.reference ?? '' }, ' paid out']]
    case 'appointment.booked': return ['Appointment booked', 'brand', ['Appointment booked for ', who, at, ...doctor]]
    case 'appointment.checkIn': return ['Patient checked in', 'sky', [who, ' checked in', ...doctor]]
    case 'appointment.complete': return ['Visit completed', 'emerald', [who, ' completed a visit', ...doctor]]
    case 'appointment.cancel': return ['Appointment cancelled', 'amber', ['Appointment for ', who, at, ' cancelled']]
    case 'appointment.noShow': return ['Marked no-show', 'rose', [who, ' did not attend', at, ...doctor]]
    case 'patient.registered': return ['Patient registered', 'brand', [who, ' registered', ...(d.mrn ? [' (', { muted: d.mrn }, ')'] : [])]]
    case 'pharmacy.dispensed': return ['Prescription dispensed', 'indigo', ['Prescription ', { muted: d.prescription ?? '' }, d.complete ? ' dispensed in full' : ' partly dispensed']]
    case 'prescription.signed': return ['Prescription signed', 'indigo', ['Prescription ', { muted: d.reference ?? '' }, ` signed${d.items ? ` · ${plural(d.items, 'item')}` : ''}`]]
    case 'order.resulted': return ['Result recorded', 'amber', [`Lab or imaging result recorded${d.flag ? ` (${d.flag})` : ''}`]]
    case 'order.reviewed': return ['Result reviewed', 'amber', ['Result ', { muted: d.reference ?? '' }, ' reviewed by a clinician']]
    case 'encounter.signed': return ['Consultation signed', 'indigo', ['Consultation note signed']]
    case 'staff.attendance_recorded': return ['Staff attendance', 'sky', [entry.subject ? { strong: entry.subject } : 'A staff member', ` marked ${STATUS_WORDS[d.status] ?? d.status ?? ''}`]]
    case 'inventory.receipt.posted': return ['Goods received', 'indigo', ['Goods receipt ', { muted: d.reference ?? '' }, ' posted to stock']]
    case 'payroll.cycle.processed': return ['Payroll processed', 'emerald', ['Pay run processed and payslips issued']]
    default: return [entry.action, 'brand', [entry.action]]
  }
}

export function activity(view, now) {
  if (!view.activity) return null
  return view.activity.map((entry) => {
    const [title, dot, body] = describe(entry, view.timeZone)
    return { id: entry.id, title, time: relativeTime(entry.at, now), dot: DOTS[dot], body: entry.actor ? [...body, ` · by ${entry.actor}`] : body }
  })
}

const SETUP = {
  organisation: { label: 'Organisation profile', hint: 'Clinic details', to: ROUTES.organisation },
  branches: { label: 'Branches', hint: 'Add a location', to: ROUTES.branchNew },
  services: { label: 'Services & pricing', hint: 'Set catalogue', to: ROUTES.billingServices },
  staff: { label: 'Staff & roles', hint: 'Add staff', to: ROUTES.staffNew },
  schedules: { label: 'Consulting hours', hint: 'Doctor schedules', to: ROUTES.staffDirectory },
  billing: { label: 'Billing configuration', hint: 'Payment methods', to: ROUTES.billingConfig },
  pharmacy: { label: 'Pharmacy & inventory', hint: 'Items and locations', to: ROUTES.inventorySetup },
  payroll: { label: 'Payroll rules', hint: 'Statutory settings', to: ROUTES.payrollSetup },
}

export function setupChecklist(view) {
  if (!view.setup) return null
  const steps = view.setup.map((step, index) => ({ ...step, ...SETUP[step.id], step: index + 1 }))
  const open = steps.filter((step) => !step.done)
  if (!open.length) return null
  const [next, ...remaining] = open
  return {
    completed: steps.length - open.length,
    total: steps.length,
    next: { title: next.label, hint: `Recommended next step · ${next.hint}`, action: 'Configure', to: next.to },
    remaining: remaining.map(({ step, label, hint, to }) => ({ step, label, hint, to })),
  }
}

export const QUICK_ACTIONS = [
  { id: 'register', label: 'Register patient', icon: icons.qaRegister, to: ROUTES.patientNew, permission: 'patients.create' },
  { id: 'book', label: 'Book appt', icon: icons.qaBook, to: ROUTES.patients, permission: 'bookings.create' },
  { id: 'invoice', label: 'Create invoice', icon: icons.qaInvoice, to: ROUTES.billingInvoiceNew, permission: 'accounting.invoices' },
  { id: 'service', label: 'Add service', icon: icons.qaService, to: ROUTES.billingServiceNew, permission: 'accounting.invoices' },
  { id: 'staff', label: 'Add staff', icon: icons.qaStaff, to: ROUTES.staffNew, permission: 'staff.create' },
]
