import { pathFor, ROUTES } from '../../../config/routes'

// Which dashboard /dashboard shows. It follows permissions, not role names, because organisations edit and add
// roles. Owners and managers (organisation settings or live branch telemetry) get the operational overview, as
// does anyone without a desk role (pharmacy, accounts, HR), limited to the sections they may read.
export function dashboardKind(can) {
  if (can('settings.organisation') || can('dashboard.telemetry') || !can('bookings.view')) return 'overview'
  if (can('clinical.write')) return 'doctor'
  if (can('clinical.vitals')) return 'nurse'
  if (can('bookings.create')) return 'reception'
  return 'overview'
}

export const DASHBOARD_NAMES = { overview: 'Overview', doctor: 'Clinical workspace', nurse: 'Nurse Dashboard', reception: 'Reception Desk' }

export const STATUS = {
  pending: { label: 'Pending confirmation', tone: 'warning' },
  confirmed: { label: 'Scheduled', tone: 'neutral' },
  arrived: { label: 'Checked in', tone: 'warning' },
  in_progress: { label: 'In consultation', tone: 'brand' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  no_show: { label: 'No-show', tone: 'danger' },
}

const UPCOMING = ['pending', 'confirmed']

export function ageOf(dateOfBirth, on) {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  const [nowYear, nowMonth, nowDay] = on.split('-').map(Number)
  return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0)
}

const SEX = { female: 'F', male: 'M' }
export const demographics = (patient, on) => `${patient.mrn} · ${ageOf(patient.dateOfBirth, on)}${SEX[patient.gender] ?? ''}`

export const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('')

export const waitingMinutes = (appointment, now) => (appointment.arrivedAt ? Math.max(0, Math.round((now - Date.parse(appointment.arrivedAt)) / 60_000)) : null)

// Cancelled bookings are not part of the day's work.
export const worklist = (appointments) => appointments.filter((row) => row.status !== 'cancelled')

export function counts(appointments) {
  const rows = worklist(appointments)
  const of = (...statuses) => rows.filter((row) => statuses.includes(row.status)).length
  const waiting = rows.filter((row) => row.status === 'arrived')
  return {
    total: rows.length,
    completed: of('completed'),
    waiting: waiting.length,
    inConsultation: of('in_progress'),
    upcoming: of(...UPCOMING),
    noShow: of('no_show'),
    checkedIn: rows.filter((row) => row.arrivedAt).length,
    // Meaningful only with clinical data: who has had vitals taken today.
    awaitingPreparation: waiting.filter((row) => !row.vitals).length,
    ready: waiting.filter((row) => row.vitals).length,
  }
}

export const summaryLine = (tally) =>
  `${tally.completed} completed · ${tally.inConsultation} in consultation · ${tally.waiting} waiting · ${tally.upcoming} upcoming${tally.noShow ? ` · ${tally.noShow} no-show` : ''}`

// The patient who has waited longest, optionally limited to those matching `only`.
export const nextWaiting = (appointments, only = () => true) =>
  appointments.filter((row) => row.status === 'arrived' && only(row)).sort((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''))[0] ?? null

export const filterRows = (appointments, { practitionerId = '', status = '', department = '' }) =>
  appointments.filter(
    (row) => (!practitionerId || row.practitioner.id === practitionerId) && (!status || row.status === status) && (!department || row.practitioner.department === department),
  )

// Choices for the filters, taken from the day's bookings.
export function filterOptions(appointments) {
  const unique = (entries) => [...new Map(entries).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  return {
    practitioners: unique(appointments.map((row) => [row.practitioner.id, row.practitioner.displayName])),
    departments: unique(appointments.map((row) => [row.practitioner.department, row.practitioner.department])),
    statuses: unique(appointments.map((row) => [row.status, STATUS[row.status].label])),
  }
}

const params = (row) => ({ patientId: row.patient.id, appointmentId: row.id, encounterId: row.encounter?.id })
export const patientLink = (patient) => pathFor(ROUTES.patientHub, { patientId: patient.id })
export const appointmentLink = (row) => pathFor(ROUTES.appointment, params(row))

// The one thing a clinician does next with a row.
export function doctorAction(row) {
  if (row.encounter?.status === 'in_progress') {
    return { label: row.status === 'completed' ? 'Review unsigned note' : 'Open active encounter', to: pathFor(ROUTES.encounter, params(row)) }
  }
  if (row.status === 'arrived') return { label: 'Open Encounter', to: pathFor(ROUTES.appointmentStartEncounter, params(row)) }
  if (UPCOMING.includes(row.status)) return { label: 'View appointment', to: appointmentLink(row) }
  return { label: 'View patient record', to: patientLink(row.patient) }
}

export function preparation(row) {
  if (row.status === 'arrived') return row.vitals ? { label: 'Ready for doctor', tone: 'success' } : { label: 'Awaiting preparation', tone: 'warning' }
  return STATUS[row.status]
}

export const readings = (vitals) => `${vitals.systolic}/${vitals.diastolic} mmHg · HR ${vitals.pulse} · SpO₂ ${vitals.spo2}% · ${vitals.temperatureF}°F`

export const allergyLine = (allergies) => (allergies.length ? allergies.map((entry) => `${entry.substance} (${entry.severity})`).join(', ') : 'No allergies recorded')

const EVENT_LABELS = {
  booked: 'Appointment booked', walk_in: 'Walk-in added', confirm: 'Booking confirmed', checkIn: 'Patient checked in', start: 'Consultation started',
  complete: 'Visit completed', reschedule: 'Appointment rescheduled', cancel: 'Appointment cancelled', noShow: 'Marked as no-show',
}
export const eventLabel = (action) => EVENT_LABELS[action] ?? 'Appointment updated'
