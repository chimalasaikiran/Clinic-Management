import { CHAMBERS, SCHEDULE_NOW } from '../appointments/constants'
import { daysBetween, TODAY } from '../patients/format'
import { activeAlerts } from '../patients/selectors'

const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

export const WORK_VIEWS = [
  { id: 'all', label: 'All Work Items', test: () => true },
  { id: 'active', label: 'Active Encounters', test: (item) => item.status === 'In Progress' },
  { id: 'waiting', label: 'Ready for Rooming', test: (item) => item.status === 'Arrived' },
  { id: 'upcoming', label: 'Upcoming', test: (item) => ['Scheduled', 'Confirmed', 'Pending Confirmation'].includes(item.status) },
  { id: 'done', label: 'Completed', test: (item) => item.status === 'Completed' },
]

// The numbers on the hub's tiles, taken from the records rather than typed in.
export function hubSummary(records, today = TODAY) {
  const alerts = activeAlerts(records.alerts)
  const todays = records.appointments.filter((appointment) => appointment.date === today && CHAMBERS.some((entry) => entry.doctorId === appointment.doctorId))
  return {
    inConsultation: todays.filter((appointment) => appointment.status === 'In Progress').length,
    pendingDocumentation: records.encounters.filter((encounter) => encounter.status === 'In Progress').length,
    awaitingReview: records.orders.filter((order) => order.status === 'Awaiting Review').length,
    mandatory: alerts.filter((alert) => alert.severity === 'Critical' || alert.severity === 'High').length,
    followUpsDue: records.carePlans.filter((plan) => plan.status !== 'Draft' && daysBetween(plan.nextReview, today) >= 0).length,
  }
}

export function safetyExceptions(records) {
  return activeAlerts(records.alerts)
    .filter((alert) => alert.severity === 'Critical' || alert.severity === 'High')
    .map((alert) => ({ alert, patient: records.patients.find((patient) => patient.id === alert.patientId) ?? null }))
}

const dwellOf = (appointment, encounter) => {
  if (appointment.status === 'Arrived') return { label: 'Ready for Rooming', note: `Checked in ${Math.max(0, minutes(SCHEDULE_NOW) - minutes(appointment.arrivedAt ?? appointment.time))}m ago`, tone: 'info' }
  if (appointment.status === 'In Progress') return { label: encounter?.status === 'In Progress' ? 'In Consultation' : 'In Chamber', note: encounter ? `Encounter ${encounter.id}` : '', tone: 'success' }
  if (appointment.status === 'Completed') return { label: 'Completed', note: 'Note signed', tone: 'neutral' }
  return { label: appointment.status === 'Pending Confirmation' ? 'Unverified booking' : `Booked for ${appointment.time}`, note: '', tone: 'neutral' }
}

// Today's chamber appointments as work items for the clinical queue.
export function workItems(records, today = TODAY) {
  return records.appointments
    .filter((appointment) => appointment.date === today && CHAMBERS.some((entry) => entry.doctorId === appointment.doctorId) && !['Cancelled', 'No-show'].includes(appointment.status))
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((appointment) => {
      const patient = records.patients.find((entry) => entry.id === appointment.patientId)
      const encounter = records.encounters.find((entry) => entry.id === appointment.encounterId)
      const alert = activeAlerts(records.alerts).find((entry) => entry.patientId === appointment.patientId && entry.kind.startsWith('ALLERGY'))
      return { id: appointment.id, appointment, patient, encounter, alert, status: appointment.status, token: appointment.queueToken ?? '—', chamber: appointment.room, department: appointment.department, dwell: dwellOf(appointment, encounter) }
    })
}

// Which button a work item offers, given what the active scope may do.
export function workAction(item, scope) {
  const { appointment, encounter } = item
  if (item.status === 'In Progress') {
    if (encounter?.status === 'In Progress') return scope.sign ? { kind: 'sign', label: 'Complete & Sign Note' } : { kind: 'view', label: 'View Encounter' }
    return scope.triage || scope.sign ? { kind: 'encounter', label: 'Open Active Encounter' } : null
  }
  if (item.status === 'Arrived') return scope.triage || scope.sign ? { kind: 'start', label: `Call Next Token [${appointment.queueToken}]` } : null
  if (item.status === 'Completed') return { kind: 'summary', label: 'View Summary' }
  if (item.status === 'Scheduled' || item.status === 'Confirmed') return scope.triage || scope.sign ? { kind: 'checkin', label: 'Check In' } : null
  return null
}
