import { pathFor, ROUTES } from '../../config/routes'
import { formatDate, formatINR, formatTime } from '../patients/format'

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// The active branches the person's roles cover, in the order the API lists them.
export function permittedBranches(branches, branchScope) {
  return (branches ?? []).filter((branch) => branch.status === 'active' && (branchScope === 'all' || (branchScope ?? []).includes(branch.id)))
}

// The header's location choices: every covered branch together, then each one.
export function locationOptions(branches, branchScope) {
  if (branches.length === 1) return [{ value: '', label: branches[0].name }]
  const all = branchScope === 'all' ? `All locations (${branches.length})` : `All my locations (${branches.length})`
  return [{ value: '', label: all }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]
}

// The sidebar card's second line: how much of the organisation the person's roles cover.
export function scopeLabel(branchScope, count) {
  if (branchScope === 'all') return count === 1 ? 'Single Location' : `All ${count} locations`
  return `${plural(count, 'location')} assigned`
}

// Open items from /v1/alerts, worded for the header and linked to where each is handled.
const ALERTS = {
  waiting: { title: (n) => `${plural(n, 'patient')} waiting`, detail: () => 'Arrived today and not yet called in', to: ROUTES.appointments },
  results: { title: (n) => `${plural(n, 'result')} awaiting review`, detail: (item) => (item.urgent ? `${item.urgent} marked urgent` : 'Diagnostic results to sign off'), to: ROUTES.clinical },
  low_stock: { title: (n) => `${plural(n, 'item')} low on stock`, detail: () => 'At or below the reorder level', to: ROUTES.inventory },
  reconciliation: { title: (n) => `${plural(n, 'payment')} to reconcile`, detail: () => 'Statement matches and open exceptions', to: ROUTES.billingReconciliation },
  refunds: { title: (n) => `${plural(n, 'refund')} awaiting approval`, detail: () => 'Requested refunds that need a decision', to: ROUTES.billingRefunds },
  attendance: { title: (n) => `${plural(n, 'staff member')} without attendance`, detail: () => 'Not yet marked present, late, absent or on leave today', to: ROUTES.staffDirectory },
  payroll: { title: (n) => `${plural(n, 'payroll request')} to decide`, detail: () => 'Adjustments and salary advances', to: ROUTES.payroll },
  lead_follow_ups: { title: (n) => `${plural(n, 'lead follow-up')} due`, detail: () => 'Overdue or due before the end of today', to: ROUTES.leads },
}

export function alertItems(alerts) {
  return (alerts?.items ?? []).filter((item) => ALERTS[item.id]).map((item) => ({ id: item.id, title: ALERTS[item.id].title(item.count), detail: ALERTS[item.id].detail(item), to: ALERTS[item.id].to }))
}

// Where a notice opens: the booking, the refill queue or the help request it is about.
function noticeTarget(item) {
  if (item.entityType === 'refill_request') return ROUTES.pharmacyRefills
  if (item.entityType === 'support_ticket' && item.entityId) return pathFor(ROUTES.helpRequest, { ticketId: item.entityId })
  if (item.entityType === 'appointment' && item.patientId) return pathFor(ROUTES.appointment, { patientId: item.patientId, appointmentId: item.entityId })
  return ROUTES.appointments
}

// The person's own notices (from /v1/notifications), newest first, each linking to the booking it is about.
export function noticeItems(response, limit = 5) {
  return (response?.data ?? []).slice(0, limit).map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.body,
    unread: !item.readAt,
    to: noticeTarget(item),
  }))
}

const STATUS = { pending: 'Pending', confirmed: 'Confirmed', arrived: 'Arrived', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }

// /v1/search results as the groups the header lists; groups the person cannot read (null) or with no match are left out.
export function searchGroups(result) {
  if (!result) return []
  const groups = [
    {
      id: 'patients',
      label: 'Patients',
      items: (result.patients ?? []).map((row) => ({ key: row.id, title: row.fullName, detail: [row.mrn, row.mobile, row.status === 'inactive' ? 'Inactive' : null].filter(Boolean).join(' · '), to: pathFor(ROUTES.patientHub, { patientId: row.id }) })),
    },
    {
      id: 'appointments',
      label: 'Appointments',
      items: (result.appointments ?? []).map((row) => ({
        key: row.id,
        title: `${row.reference} · ${row.patient}`,
        detail: `${formatDate(row.date)}, ${formatTime(row.time)} · ${row.practitioner} · ${STATUS[row.status] ?? row.status}`,
        to: pathFor(ROUTES.appointment, { patientId: row.patientId, appointmentId: row.id }),
      })),
    },
    {
      id: 'invoices',
      label: 'Invoices',
      items: (result.invoices ?? []).map((row) => ({ key: row.reference, title: `${row.reference} · ${row.patient}`, detail: `${formatDate(row.date)} · ${formatINR(row.total)} · ${row.title}`, to: pathFor(ROUTES.billingInvoice, { invoiceId: row.reference }) })),
    },
  ]
  return groups.filter((group) => group.items.length > 0)
}

// The sidebar's System Health line from the last readiness check.
export function healthStatus(health) {
  if (!health) return { label: 'Checking…', tone: 'neutral' }
  if (!health.ok) return { label: 'Unavailable', tone: 'danger' }
  return { label: `Operational · ${health.ms} ms`, tone: 'brand' }
}
