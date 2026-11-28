import { ALL_PERMISSION_IDS } from '../permissions/permission-catalogue'

export interface RoleTemplate {
  name: string
  category: string
  scope: 'org' | 'branch'
  system: boolean
  description: string
  permissions: string[]
}

export const OWNER_ROLE_NAME = 'Super Admin'

// Roles every new organisation starts with. Branch-scoped templates are attached to the first branch.
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: OWNER_ROLE_NAME,
    category: 'Administration',
    scope: 'org',
    system: true,
    description: 'Unrestricted owner-level access to every branch, clinical record, financial ledger and governance setting.',
    permissions: ALL_PERMISSION_IDS,
  },
  {
    name: 'Branch Manager',
    category: 'Operations',
    scope: 'branch',
    system: false,
    description: 'Runs day-to-day branch operations, schedules and staff deployment without access to organisation finance.',
    permissions: [
      'dashboard.view', 'dashboard.telemetry', 'branches.view', 'branches.hours', 'branches.staff',
      'bookings.view', 'bookings.create', 'bookings.assign', 'bookings.reschedule', 'bookings.cancel', 'bookings.notes',
      'patients.view', 'patients.create', 'patients.edit', 'staff.view', 'staff.attendance', 'staff.leave', 'inventory.view', 'reports.view',
      'growth.view', 'growth.leads',
    ],
  },
  {
    name: 'Front Desk & Reception',
    category: 'Reception / Front Office',
    scope: 'branch',
    system: false,
    description: 'Registers patients, books and reschedules appointments, and manages the waiting queue.',
    permissions: ['dashboard.view', 'bookings.view', 'bookings.create', 'bookings.reschedule', 'bookings.cancel', 'patients.view', 'patients.create', 'patients.edit', 'staff.view', 'growth.view', 'growth.leads'],
  },
  {
    name: 'Clinician',
    category: 'Operations',
    scope: 'branch',
    system: false,
    description: 'Sees their patients, records encounters, prescriptions and orders.',
    permissions: ['dashboard.view', 'bookings.view', 'bookings.notes', 'patients.view', 'clinical.read', 'clinical.write', 'pharmacy.view'],
  },
  {
    name: 'Nurse',
    category: 'Operations',
    scope: 'branch',
    system: false,
    description: 'Prepares checked-in patients: records vital signs, collects specimens and hands over to the clinician.',
    permissions: ['dashboard.view', 'bookings.view', 'bookings.notes', 'patients.view', 'clinical.read', 'clinical.vitals'],
  },
  {
    name: 'Growth & Marketing',
    category: 'Operations',
    scope: 'org',
    system: false,
    description: 'Works enquiries, campaigns, content, conversations and reviews, without access to patient records.',
    permissions: ['growth.view', 'growth.leads', 'growth.manage'],
  },
  {
    name: 'Pharmacist',
    category: 'Operations',
    scope: 'branch',
    system: false,
    description: 'Dispenses prescriptions and manages pharmacy stock.',
    permissions: ['dashboard.view', 'patients.view', 'pharmacy.view', 'pharmacy.dispense', 'inventory.view', 'inventory.manage'],
  },
  {
    name: 'Accountant / Billing',
    category: 'Finance',
    scope: 'org',
    system: false,
    description: 'Manages invoicing, payments, reconciliation and settlements across all branches.',
    permissions: [
      'dashboard.view', 'patients.view', 'accounting.revenue', 'accounting.payments', 'accounting.invoices', 'accounting.expenses', 'accounting.settlements',
      'reports.view', 'reports.export',
    ],
  },
  {
    name: 'HR & Compliance Officer',
    category: 'HR & Compliance',
    scope: 'org',
    system: false,
    description: 'Maintains staff records, user accounts, attendance and leave.',
    permissions: ['dashboard.view', 'staff.view', 'staff.create', 'staff.credentials', 'staff.attendance', 'staff.leave', 'reports.view'],
  },
]
