import { pathFor, ROUTES } from '../../config/routes'
import { DOCTORS, SESSIONS } from './data/catalog'
import { TODAY, daysBetween, formatTime } from './format'

export const UPCOMING_STATUSES = ['Pending Confirmation', 'Scheduled', 'Confirmed', 'Arrived', 'In Progress']

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

export function daysLabel(isoDate) {
  const days = daysBetween(TODAY, isoDate)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return days > 0 ? `In ${days} days` : `${-days} days ago`
}

// Where the hub's "Start Encounter" button goes: the next step in today's visit, or a new booking.
export function startEncounterPath(patientId, appointments) {
  const today = appointments.filter((appointment) => appointment.date === TODAY && isUpcoming(appointment)).sort(byOldest)
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

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// Deterministic 30-minute slot grid for one doctor and day. Slots already taken in the appointment list are booked;
// one slot per day is held for clinician rounds; a few more are booked by other patients so the grid is not uniform.
export function slotsFor(date, doctorId, appointments, ignoreAppointmentId) {
  const dayNumber = Number(date.slice(8))
  const taken = new Set(
    appointments
      .filter((appointment) => appointment.doctorId === doctorId && appointment.date === date && isUpcoming(appointment) && appointment.id !== ignoreAppointmentId)
      .map((appointment) => appointment.time),
  )
  const slots = []
  SESSIONS.forEach((session) => {
    for (let minutes = toMinutes(session.start); minutes < toMinutes(session.end); minutes += 30) {
      const time = toTime(minutes)
      const rounds = session.id === 'evening' && minutes === toMinutes('17:30')
      const bookedElsewhere = (minutes / 30 + dayNumber) % 7 === 0
      const past = date === TODAY && time <= '10:00'
      const state = rounds ? 'rounds' : taken.has(time) || bookedElsewhere || past ? 'booked' : 'available'
      slots.push({ time, session: session.id, state })
    }
  })
  return slots
}

export const doctorById = (id) => DOCTORS.find((doctor) => doctor.id === id)

export function datesFrom(startIso, count) {
  const [year, month, day] = startIso.split('-').map(Number)
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(year, month - 1, day + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
}

// Next queue token for a branch on a day: A-18, A-19 ...
export function nextToken(appointments, date) {
  const used = appointments.filter((appointment) => appointment.date === date && appointment.queueToken).map((appointment) => Number(appointment.queueToken.slice(2)))
  return `A-${String(Math.max(17, ...used) + 1).padStart(2, '0')}`
}

// Wall-clock "HH:MM" for audit entries and arrival stamps.
export const clockTime = () => new Date().toTimeString().slice(0, 5)

export const auditEntry = (text, by) => ({ time: formatTime(clockTime()), text, by })

// Newest-first feed of what happened on the chart, built from the patient's own records.
export function activityFeed({ appointments, encounters, prescriptions, orders, payments }, limit = 5) {
  const events = [
    ...encounters.map((item) => ({ date: item.date, time: item.time, title: `Encounter ${item.id} — ${item.status}`, detail: `${item.type} · ${item.doctor}, ${item.department}` })),
    ...prescriptions.map((item) => ({ date: item.date, time: item.time, title: `E-Prescription #${item.id} issued`, detail: `${item.items.length} item${item.items.length === 1 ? '' : 's'} prescribed by ${item.prescriber}` })),
    ...orders.map((item) => ({ date: item.date, time: item.time, title: `${item.title} — ${item.status}`, detail: `${item.category} · ordered by ${item.ordering}` })),
    ...payments.map((item) => ({ date: item.date, time: item.time, title: `Payment #${item.id} received`, detail: `${item.instrument} · ₹${item.amount.toLocaleString('en-IN')}` })),
    ...appointments.filter((item) => ['Cancelled', 'No-show'].includes(item.status)).map((item) => ({ date: item.date, time: item.time, title: `Appointment ${item.id} — ${item.status}`, detail: `${item.service} with ${item.doctorShort}` })),
  ]
  return events.sort(byNewest).slice(0, limit)
}

// Time left (or overdue) against a referral's statutory response window.
export function slaState(referral) {
  if (!referral.sla) return null
  const left = referral.sla.windowHours - referral.sla.elapsedHours
  return { left, overdue: left < 0, text: left < 0 ? `Overdue by ${-left}h` : `${left}h left` }
}
