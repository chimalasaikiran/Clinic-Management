// Permission catalogue used by the role screens. The API keeps the same list (api/src/access/permissions.ts)
// and its tests fail if the two drift.

// `locked` permissions and `guard: 'restricted'` groups are reserved for system roles.
// `guard: 'finance'` groups cannot be granted to branch-scoped roles.
export const PERMISSION_GROUPS = [
  {
    id: 'dashboard',
    label: 'Dashboard operations',
    permissions: [
      { id: 'dashboard.view', label: 'View dashboard & high-level KPIs' },
      { id: 'dashboard.telemetry', label: 'View live branch telemetry' },
    ],
  },
  {
    id: 'branches',
    label: 'Branches',
    permissions: [
      { id: 'branches.view', label: 'View branches directory' },
      { id: 'branches.create', label: 'Add / provision new branch', locked: true },
      { id: 'branches.hours', label: 'Edit branch operational hours' },
      { id: 'branches.staff', label: 'Manage branch staff deployment' },
    ],
  },
  {
    id: 'bookings',
    label: 'Bookings & appointments',
    permissions: [
      { id: 'bookings.view', label: 'View bookings & schedule matrix' },
      { id: 'bookings.create', label: 'Create new patient booking' },
      { id: 'bookings.assign', label: 'Assign & dispatch therapist' },
      { id: 'bookings.reschedule', label: 'Reschedule booking' },
      { id: 'bookings.cancel', label: 'Cancel booking' },
      { id: 'bookings.notes', label: 'View booking details & notes' },
    ],
  },
  {
    id: 'patients',
    label: 'Patients & records',
    permissions: [
      { id: 'patients.view', label: 'View patient directory & records' },
      { id: 'patients.create', label: 'Register new patients' },
      { id: 'patients.edit', label: 'Edit patient demographics & consents' },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinical care',
    permissions: [
      { id: 'clinical.read', label: 'View encounters, notes & results' },
      { id: 'clinical.write', label: 'Record encounters, prescriptions & orders' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff & HR',
    permissions: [
      { id: 'staff.view', label: 'View staff directory' },
      { id: 'staff.create', label: 'Add new staff profile' },
      { id: 'staff.credentials', label: 'Edit staff core credentials' },
      { id: 'staff.attendance', label: 'Manage live shift attendance' },
      { id: 'staff.leave', label: 'Manage leave requests' },
      { id: 'staff.payroll', label: 'Manage payroll & compensation', locked: true },
    ],
  },
  {
    id: 'therapists',
    label: 'Therapist management',
    permissions: [
      { id: 'therapists.profiles', label: 'View therapist clinical profiles' },
      { id: 'therapists.routes', label: 'Manage field route deployment' },
      { id: 'therapists.shifts', label: 'View therapist shift timeline' },
      { id: 'therapists.feedback', label: 'View patient session feedback' },
      { id: 'therapists.earnings', label: 'View earnings & financial settlements', locked: true },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting & billing',
    guard: 'finance',
    permissions: [
      { id: 'accounting.revenue', label: 'View revenue metrics' },
      { id: 'accounting.payments', label: 'View payments stream' },
      { id: 'accounting.invoices', label: 'Manage patient invoices' },
      { id: 'accounting.expenses', label: 'Manage expenses' },
      { id: 'accounting.settlements', label: 'Manage settlements' },
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    permissions: [
      { id: 'pharmacy.view', label: 'View prescription queue & returns' },
      { id: 'pharmacy.dispense', label: 'Dispense medicines & process returns' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & suppliers',
    permissions: [
      { id: 'inventory.view', label: 'View stock, orders & transfers' },
      { id: 'inventory.manage', label: 'Raise orders, receive & adjust stock' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & analytics',
    permissions: [
      { id: 'reports.view', label: 'View operational reports' },
      { id: 'reports.export', label: 'Export compliance & shift data' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth & communication',
    permissions: [
      { id: 'growth.view', label: 'View leads, campaigns & reviews' },
      { id: 'growth.manage', label: 'Run campaigns & patient messaging' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings & governance',
    guard: 'restricted',
    permissions: [
      { id: 'settings.organisation', label: 'Manage organization settings' },
      { id: 'settings.roles', label: 'Manage roles & permissions' },
    ],
  },
]

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id))

export const STAFF_CATEGORIES = ['Administration', 'Operations', 'Physiotherapy', 'Reception / Front Office', 'Finance', 'HR & Compliance']

export const SCOPES = { org: 'Org-wide', branch: 'Branch-level' }
