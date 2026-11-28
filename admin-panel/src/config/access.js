import { matchPath } from 'react-router-dom'
import { NAV_ITEMS } from './workspace'

const FINANCE = ['accounting.revenue', 'accounting.payments', 'accounting.invoices', 'accounting.expenses', 'accounting.settlements']

// Which permissions open each workspace area (any one of them is enough). The first matching rule wins,
// so specific paths come before their section. This shapes the UI only: the API enforces access itself.
const RULES = [
  ['/staff/:staffId/account', ['staff.credentials']],
  ['/staff/new', ['staff.create']],
  ['/dashboard', ['dashboard.view']],
  ['/patients/new', ['patients.create']],
  ['/patients/:patientId/edit', ['patients.edit']],
  ['/patients/:patientId/book', ['bookings.create']],
  ['/patients/:patientId/appointment/:appointmentId/reschedule', ['bookings.reschedule']],
  ['/patients/:patientId/appointment/:appointmentId/cancel', ['bookings.cancel']],
  ['/patients/:patientId/appointment/:appointmentId/no-show', ['bookings.cancel']],
  ['/patients/:patientId/appointment/:appointmentId/check-in', ['bookings.create']],
  ['/patients/:patientId/appointment/:appointmentId/start-encounter', ['clinical.write']],
  ['/patients/:patientId/appointment', ['bookings.view']],
  ['/patients/:patientId/encounter/:encounterId/diagnoses', ['clinical.write']],
  ['/patients/:patientId/encounter/:encounterId', ['clinical.read']],
  ['/patients/:patientId/care-plan/new', ['clinical.write']],
  ['/patients', ['patients.view']],
  ['/appointments', ['bookings.view']],
  ['/clinical', ['clinical.read']],
  ['/billing', FINANCE],
  ['/reports', ['reports.view']],
  // Clinicians decide refills too, so they open this queue without pharmacy rights.
  ['/pharmacy/refills', ['pharmacy.view', 'clinical.read']],
  ['/pharmacy', ['pharmacy.view']],
  ['/inventory', ['inventory.view']],
  ['/growth/leads/new', ['growth.leads']],
  ['/growth/leads/:leadId/edit', ['growth.leads']],
  ['/growth/leads/:leadId/follow-up', ['growth.leads']],
  ['/growth/leads/:leadId/convert', ['growth.leads']],
  ['/growth/campaigns/new', ['growth.manage']],
  ['/growth/campaigns/:campaignId/edit', ['growth.manage']],
  ['/growth/audiences/new', ['growth.manage']],
  ['/growth/content/new', ['growth.manage']],
  ['/growth/workflows/new', ['growth.manage']],
  ['/growth', ['growth.view']],
  ['/staff', ['staff.view']],
  ['/roles', ['settings.roles']],
  ['/payroll', ['staff.payroll']],
  ['/configuration', ['settings.organisation']],
]

export function requiredPermissions(pathname) {
  const rule = RULES.find(([pattern]) => matchPath({ path: pattern, end: false }, pathname))
  return rule ? rule[1] : null
}

export function canOpen(pathname, can) {
  const required = requiredPermissions(pathname)
  return !required || required.some(can)
}

// Where to land after sign-in: the first section of the sidebar the user may open.
export function homePath(can) {
  return NAV_ITEMS.find((item) => canOpen(item.to, can))?.to ?? null
}
