import { matchPath } from 'react-router-dom'
import { NAV_ITEMS } from './workspace'

const FINANCE = ['accounting.revenue', 'accounting.payments', 'accounting.invoices', 'accounting.expenses', 'accounting.settlements']

// Which permissions open each workspace area (any one of them is enough). The first matching rule wins,
// so specific paths come before their section. This shapes the UI only: the API enforces access itself.
const RULES = [
  ['/staff/:staffId/account', ['staff.credentials']],
  ['/dashboard', ['dashboard.view']],
  ['/patients', ['patients.view']],
  ['/appointments', ['bookings.view']],
  ['/clinical', ['clinical.read']],
  ['/billing', FINANCE],
  ['/reports', ['reports.view']],
  ['/pharmacy', ['pharmacy.view']],
  ['/inventory', ['inventory.view']],
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
