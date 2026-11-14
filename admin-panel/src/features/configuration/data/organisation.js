// Sample organisation data until the configuration API exists.
export const ORGANISATION = {
  initials: 'CP',
  name: 'CarePoint Clinics',
  tags: ['Multi-Speciality Clinic · Clinic Network', 'Verified Org ID #CP-IND-4091'],
  registry: 'Enterprise ABDM Registry',
  licence: 'National Health Authority Lic. #AP-HYD-MED-99201',
}

export const ORG_FACTS = [
  { label: 'Operational facilities', value: '3 Operating Branches', hint: 'Regional Hyderabad Cluster' },
  { label: 'Primary location', value: 'Main Clinic', hint: 'Central Hub, Banjara Hills / Jubilee Hills' },
  { label: 'Departmental scope', value: '6 Departments', hint: 'Active specialties across network' },
  { label: 'Organisation status', value: 'Active', hint: 'All HIPAA & ABDM nodes operational', badge: 'L1 Sovereign' },
]

export const BRANCHES = [
  {
    id: 'main',
    name: 'Main Clinic',
    kind: 'Primary location',
    secondary: 'Headquarters',
    address: 'Road No. 12, Banjara Hills, Hyderabad, Telangana · 500034',
    departments: ['Cardiology', 'General Medicine', 'Pediatrics', 'Orthopedics', 'ENT', 'Diagnostics'],
    appointmentsToday: 12,
    suites: 18,
    abdmNode: 'HFR-HYD-001',
    status: 'Active',
  },
  {
    id: 'kondapur',
    name: 'Kondapur Clinic',
    kind: 'Branch',
    secondary: 'Secondary Branch',
    address: 'Hitec City Main Rd, Kondapur, Hyderabad, Telangana · 500084',
    departments: ['Pediatrics', 'Gynecology', 'General Medicine', 'Physiotherapy'],
    appointmentsToday: 8,
    suites: 10,
    abdmNode: 'HFR-HYD-002',
    status: 'Active',
  },
  {
    id: 'banjara',
    name: 'Banjara Hills Clinic',
    kind: 'Branch',
    secondary: 'Specialty Care Wing',
    address: 'Road No. 2, Banjara Hills, Hyderabad, Telangana · 500034',
    departments: ['Dental', 'Ophthalmology', 'Dermatology'],
    appointmentsToday: 6,
    suites: 8,
    abdmNode: 'HFR-HYD-003',
    status: 'Active',
  },
]

export const BRANCH_FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'active', label: 'Active', match: (branch) => branch.status === 'Active' },
  { id: 'renovating', label: 'Renovating', match: (branch) => branch.status === 'Renovating' },
]
