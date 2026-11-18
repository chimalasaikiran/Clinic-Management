import { STATUS_LABELS } from '../patients/adapters'
import { localClock } from '../patients/format'

const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const SEVERITY = { critical: 'Critical', high: 'High', moderate: 'Moderate', low: 'Low' }

export const WORK_VIEWS = [
  { id: 'all', label: 'All Work Items', test: () => true },
  { id: 'active', label: 'Active Encounters', test: (item) => item.status === 'In Progress' },
  { id: 'waiting', label: 'Ready for Rooming', test: (item) => item.status === 'Arrived' },
  { id: 'upcoming', label: 'Upcoming', test: (item) => ['Confirmed', 'Pending Confirmation'].includes(item.status) },
  { id: 'done', label: 'Completed', test: (item) => item.status === 'Completed' },
]

// The numbers on the hub's tiles, all from the worklist API (in the member's scope).
export function hubSummary(worklist) {
  return {
    inConsultation: worklist.appointments.filter((appointment) => appointment.status === 'in_progress').length,
    pendingDocumentation: worklist.openEncounters.length,
    awaitingReview: worklist.ordersAwaitingReview ?? 0,
    mandatory: worklist.alerts.length,
    followUpsDue: worklist.followUpsDue ?? 0,
  }
}

// Serious active alerts (critical and high) with the patient they belong to.
export function safetyExceptions(worklist) {
  return worklist.alerts.map((alert) => ({ alert: { ...alert, severity: SEVERITY[alert.severity], status: 'Active' }, patient: { name: alert.patient.fullName, mrn: alert.patient.mrn } }))
}

const dwellOf = (status, appointment, now) => {
  if (status === 'Arrived') return { label: 'Ready for Rooming', note: appointment.arrivedAt ? `Checked in ${Math.max(0, minutes(now) - minutes(appointment.arrivedAt))}m ago` : '', tone: 'info' }
  if (status === 'In Progress') return { label: appointment.encounter?.status === 'in_progress' ? 'In Consultation' : 'In Chamber', note: appointment.encounter ? `Encounter ${appointment.encounter.reference}` : '', tone: 'success' }
  if (status === 'Completed') return { label: 'Completed', note: appointment.encounter?.status === 'signed' ? 'Note signed' : '', tone: 'neutral' }
  return { label: status === 'Pending Confirmation' ? 'Unverified booking' : `Booked for ${appointment.time}`, note: '', tone: 'neutral' }
}

// Today's appointments (in the member's scope) as work items for the clinical queue.
export function workItems(worklist, now = localClock()) {
  return worklist.appointments
    .filter((appointment) => !['cancelled', 'no_show'].includes(appointment.status))
    .map((appointment) => {
      const status = STATUS_LABELS[appointment.status]
      const alert = worklist.alerts.find((entry) => entry.patient.id === appointment.patient.id && entry.kind.startsWith('ALLERGY'))
      return {
        id: appointment.id,
        appointment: {
          id: appointment.id,
          patientId: appointment.patient.id,
          queueToken: appointment.queueToken,
          reason: appointment.reason,
          doctorId: appointment.practitioner.id,
          doctorShort: appointment.practitioner.displayName,
          specialty: appointment.practitioner.department,
          encounterId: appointment.encounter?.id ?? null,
        },
        patient: { name: appointment.patient.fullName, mrn: appointment.patient.mrn },
        encounter: appointment.encounter ? { id: appointment.encounter.id, status: appointment.encounter.status === 'signed' ? 'Signed & Locked' : 'In Progress' } : null,
        alert: alert ? { id: alert.id } : null,
        status,
        token: appointment.queueToken ?? '—',
        chamber: appointment.practitioner.room ?? '—',
        department: appointment.practitioner.department,
        dwell: dwellOf(status, appointment, now),
      }
    })
}

// Which button a work item offers, given what the signed-in member may do.
export function workAction(item, scope) {
  const { appointment, encounter } = item
  if (item.status === 'In Progress') {
    if (encounter?.status === 'In Progress') return scope.sign ? { kind: 'sign', label: 'Complete & Sign Note' } : { kind: 'view', label: 'View Encounter' }
    return scope.triage || scope.sign ? { kind: 'summary', label: 'Open Visit' } : null
  }
  if (item.status === 'Arrived') return scope.sign ? { kind: 'start', label: `Call Next Token [${appointment.queueToken ?? '—'}]` } : null
  if (item.status === 'Completed') return { kind: 'summary', label: 'View Summary' }
  if (item.status === 'Confirmed' || item.status === 'Pending Confirmation') return scope.triage ? { kind: 'checkin', label: 'Check In' } : null
  return null
}
