import { pathFor, ROUTES } from '../../config/routes'
import { SESSIONS } from './data/catalog'
import { daysBetween, formatTime, localClock, localToday } from './format'

// 'Scheduled' only appears in the sample records of the in-memory modules; the API uses 'Pending Confirmation'.
export const UPCOMING_STATUSES = ['Pending Confirmation', 'Scheduled', 'Confirmed', 'Arrived', 'In Progress']

// Before arrival an appointment can still be confirmed, moved, cancelled or marked as a no-show.
export const CHANGEABLE_STATUSES = ['Pending Confirmation', 'Scheduled', 'Confirmed']
export const isChangeable = (appointment) => CHANGEABLE_STATUSES.includes(appointment.status)

const stamp = (item) => `${item.date} ${item.time}`
export const byNewest = (a, b) => stamp(b).localeCompare(stamp(a))
export const byOldest = (a, b) => stamp(a).localeCompare(stamp(b))

export const isUpcoming = (appointment) => UPCOMING_STATUSES.includes(appointment.status)

export const upcomingAppointments = (appointments) => appointments.filter(isUpcoming).sort(byOldest)
export const nextAppointment = (appointments) => upcomingAppointments(appointments)[0]
export const lastCompletedVisit = (appointments) => appointments.filter((appointment) => appointment.status === 'Completed').sort(byNewest)[0]

export function appointmentTone(status) {
  return { Confirmed: 'success', 'Pending Confirmation': 'warning', Scheduled: 'info', Arrived: 'brand', 'In Progress': 'warning', Completed: 'neutral', Cancelled: 'danger', 'No-show': 'danger' }[status] ?? 'neutral'
}

export const activeAlerts = (alerts) => alerts.filter((alert) => alert.status === 'Active')

export function daysLabel(isoDate, today = localToday()) {
  const days = daysBetween(today, isoDate)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return days > 0 ? `In ${days} days` : `${-days} days ago`
}

// Where the hub's "Start Encounter" button goes: the next step in today's visit, or a new booking.
export function startEncounterPath(patientId, appointments, todayIso = localToday()) {
  const today = appointments.filter((appointment) => appointment.date === todayIso && isUpcoming(appointment)).sort(byOldest)
  const inProgress = today.find((appointment) => appointment.status === 'In Progress')
  const arrived = today.find((appointment) => appointment.status === 'Arrived')
  const waiting = today[0]
  if (inProgress?.encounterId) return pathFor(ROUTES.encounter, { patientId, encounterId: inProgress.encounterId })
  if (arrived) return pathFor(ROUTES.appointmentStartEncounter, { patientId, appointmentId: arrived.id })
  if (waiting) return pathFor(ROUTES.appointmentCheckIn, { patientId, appointmentId: waiting.id })
  return pathFor(ROUTES.appointmentNew, { patientId })
}

// Session id for a 24-hour slot time.
export function sessionOf(time) {
  return SESSIONS.find((session) => time >= session.start && time < session.end)?.id ?? 'evening'
}

// SlotPicker entries from the API's slots for one day ({ time, state: available | booked | past }).
export const slotsForPicker = (slots = []) => slots.map((slot) => ({ time: slot.time, session: sessionOf(slot.time), state: slot.state }))

export function datesFrom(startIso, count) {
  const [year, month, day] = startIso.split('-').map(Number)
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(year, month - 1, day + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
}

// Wall-clock "HH:MM" for audit entries and arrival stamps.
export const clockTime = () => localClock()

export const auditEntry = (text, by) => ({ time: formatTime(clockTime()), text, by })

// Newest-first feed of what happened on the chart, built from the patient's own records.
export function activityFeed({ appointments, encounters, prescriptions, orders, payments }, limit = 5) {
  const events = [
    ...encounters.map((item) => ({ date: item.date, time: item.time, title: `Encounter ${item.reference ?? item.id} — ${item.status}`, detail: `${item.type} · ${item.doctor}, ${item.department}` })),
    ...prescriptions.map((item) => ({ date: item.date, time: item.time, title: `E-Prescription #${item.reference ?? item.id} issued`, detail: `${item.items.length} item${item.items.length === 1 ? '' : 's'} prescribed by ${item.prescriber}` })),
    ...orders.map((item) => ({ date: item.date, time: item.time, title: `${item.title} — ${item.status}`, detail: `${item.category} · ordered by ${item.ordering}` })),
    ...payments.map((item) => ({ date: item.date, time: item.time, title: `Payment #${item.id} received`, detail: `${item.instrument} · ₹${item.amount.toLocaleString('en-IN')}` })),
    ...appointments.filter((item) => ['Cancelled', 'No-show'].includes(item.status)).map((item) => ({ date: item.date, time: item.time, title: `Appointment ${item.reference ?? item.id} — ${item.status}`, detail: `${item.service} with ${item.doctorShort}` })),
  ]
  return events.sort(byNewest).slice(0, limit)
}

// Time left (or overdue) against a referral's statutory response window.
export function slaState(referral) {
  if (!referral.sla) return null
  const left = referral.sla.windowHours - referral.sla.elapsedHours
  return { left, overdue: left < 0, text: left < 0 ? `Overdue by ${-left}h` : `${left}h left` }
}
