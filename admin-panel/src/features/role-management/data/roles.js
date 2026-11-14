// Sample role and permission data until the access-control API exists.
// Branch ids match BRANCHES in ./organisation.

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
    id: 'reports',
    label: 'Reports & analytics',
    permissions: [
      { id: 'reports.view', label: 'View operational reports' },
      { id: 'reports.export', label: 'Export compliance & shift data' },
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

export const ROLES = [
  {
    id: 'super-admin',
    name: 'Super Admin',
    category: 'Administration',
    system: true,
    users: 3,
    scope: 'org',
    scopeNote: 'Full',
    branchIds: [],
    status: 'Active',
    description: 'Unrestricted owner-level access to every branch, clinical record, financial ledger and governance setting.',
    permissions: ALL_PERMISSION_IDS,
    createdBy: 'System',
    modifiedOn: 'Oct 24, 2026',
    modifiedBy: 'System',
  },
  {
    id: 'branch-manager',
    name: 'Branch Manager',
    category: 'Operations',
    users: 4,
    scope: 'branch',
    branchIds: ['main', 'kondapur'],
    status: 'Active',
    description:
      'Supervises single or multi-branch clinic operations, shift scheduling, therapist deployment and local patient throughput without access to global executive financials or cross-branch clinical records.',
    permissions: [
      'dashboard.view', 'dashboard.telemetry', 'branches.view', 'branches.hours', 'branches.staff',
      'bookings.view', 'bookings.create', 'bookings.assign', 'bookings.reschedule', 'bookings.cancel', 'bookings.notes',
      'staff.view', 'staff.attendance', 'staff.leave', 'therapists.profiles', 'therapists.routes', 'therapists.shifts', 'reports.view',
    ],
    createdBy: 'Dr. Siddharth Verma',
    modifiedOn: 'Oct 20, 2026',
    modifiedBy: 'Dr. Siddharth Verma',
  },
  {
    id: 'senior-physiotherapist',
    name: 'Senior Physiotherapist',
    category: 'Physiotherapy',
    users: 42,
    scope: 'branch',
    scopeNote: 'Caseload shielded',
    branchIds: ['main', 'kondapur', 'banjara'],
    status: 'Active',
    description: 'Delivers therapy sessions and records clinical progress for their own caseload only.',
    permissions: ['dashboard.view', 'bookings.view', 'bookings.notes', 'therapists.profiles', 'therapists.shifts', 'therapists.feedback'],
    createdBy: 'Dr. Siddharth Verma',
    modifiedOn: 'Oct 18, 2026',
    modifiedBy: 'Sarah Chen',
  },
  {
    id: 'front-desk',
    name: 'Front Desk & Reception',
    category: 'Reception / Front Office',
    users: 24,
    scope: 'branch',
    scopeNote: 'Assigned counters',
    branchIds: ['main', 'kondapur', 'banjara'],
    status: 'Active',
    description: 'Registers walk-ins, books and reschedules appointments, and manages the waiting queue at assigned branches.',
    permissions: ['dashboard.view', 'bookings.view', 'bookings.create', 'bookings.reschedule', 'bookings.cancel', 'staff.view'],
    createdBy: 'Dr. Siddharth Verma',
    modifiedOn: 'Oct 15, 2026',
    modifiedBy: 'Marcus Vance',
  },
  {
    id: 'field-dispatch-lead',
    name: 'Field Dispatch Lead',
    category: 'Operations',
    users: 8,
    scope: 'branch',
    scopeNote: 'Route & hub scoped',
    branchIds: ['kondapur'],
    status: 'Active',
    description: 'Plans home-visit routes and dispatches field therapists from their assigned hub.',
    permissions: ['dashboard.view', 'bookings.view', 'bookings.assign', 'therapists.profiles', 'therapists.routes', 'therapists.shifts'],
    createdBy: 'Dr. Siddharth Verma',
    modifiedOn: 'Oct 12, 2026',
    modifiedBy: 'Operations Lead',
  },
  {
    id: 'accountant',
    name: 'Accountant / Billing',
    category: 'Finance',
    users: 5,
    scope: 'org',
    scopeNote: 'Finance',
    branchIds: [],
    status: 'Active',
    description: 'Manages invoicing, payment reconciliation, expenses and settlements across all branches.',
    permissions: [
      'dashboard.view', 'accounting.revenue', 'accounting.payments', 'accounting.invoices', 'accounting.expenses', 'accounting.settlements',
      'reports.view', 'reports.export',
    ],
    createdBy: 'Dr. Siddharth Verma',
    modifiedOn: 'Oct 22, 2026',
    modifiedBy: 'Central Admin',
  },
  {
    id: 'hr-compliance',
    name: 'HR & Compliance Officer',
    category: 'HR & Compliance',
    users: 4,
    scope: 'org',
    scopeNote: 'Staff',
    branchIds: [],
    status: 'Active',
    description: 'Maintains staff records, credentials, attendance and leave, and runs compliance exports.',
    permissions: ['dashboard.view', 'staff.view', 'staff.create', 'staff.credentials', 'staff.attendance', 'staff.leave', 'reports.view', 'reports.export'],
    createdBy: 'Dr. Siddharth Verma',
    modifiedOn: 'Oct 24, 2026',
    modifiedBy: 'Sarah Chen',
  },
]
