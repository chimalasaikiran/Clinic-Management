// Sample branch configuration until the configuration API exists.
export const BRANCH_INFO = [
  { label: 'Branch name', value: 'Main Clinic' },
  { label: 'Branch type', value: 'Primary location · Operational Headquarters' },
  { label: 'Physical address', value: 'Road No. 12, Banjara Hills, Hyderabad, Telangana — 500034', full: true },
  { label: 'City & State', value: 'Hyderabad, Telangana (IN-TG)' },
  { label: 'Operational status', value: 'Active · Licensed Operational Facility' },
  { label: 'Primary contact telephone', value: '+91 40 2345 6789' },
  { label: 'Facility communications email', value: 'mainclinic@carepointhealth.in' },
]

export const OPERATING_CONFIG = [
  {
    title: 'Operating model',
    detail: 'Multi-Speciality Clinic · Outpatient Care & Day Surgery',
    badge: 'Multi-Speciality',
    action: 'Change model',
  },
  {
    title: 'Departments & Specialties',
    detail: 'Cardiology, General Medicine, Pediatrics, Orthopedics, ENT, Diagnostics',
    badge: '6 configured',
    badgeTone: 'brand',
    action: 'Manage departments',
    to: 'departments',
  },
  {
    title: 'Consultation mode',
    detail: 'Physical OPD consultation suites, emergency triage, and digital prescription routing',
    badge: 'In-clinic (18 suites)',
    action: 'Configure modes',
  },
  {
    title: 'Working days & Operating hours',
    detail: 'Monday – Saturday · 9:00 AM – 8:00 PM IST',
    badge: 'Open Now',
    badgeTone: 'success',
    action: 'Configure operating hours',
    to: 'branchHours',
  },
]

export const CAPABILITIES = [
  { id: 'opd', title: 'OPD (Outpatient Department)', detail: 'Queue scheduling, triage bay allocation, and clinical consultation suites', enabled: true },
  { id: 'billing', title: 'Billing & Payment Counter', detail: 'Localized GSTIN invoicing, POS terminals, and UPI QR reconciliation', enabled: true },
  { id: 'pharmacy', title: 'Pharmacy Counter', detail: 'On-site dispensary, localized batch inventory, and Schedule H1 registry.', action: 'Configure' },
  { id: 'diagnostics', title: 'Diagnostics & Specimen Collection', detail: 'Phlebotomy room, sample dispatch tracking, and outsourced lab integration', action: 'Configure' },
  { id: 'tele', title: 'Teleconsultation', detail: 'Video consultation bridge, patient dial-in, and digital prescription auto-dispatch', action: 'Setup gateway' },
]

export const BRANCH_SHORTCUTS = [
  { id: 'staff', title: 'Staff & doctors', detail: 'Manage people assigned to this branch', to: 'branchStaff' },
  { id: 'services', title: 'Services & pricing', detail: 'Configure services available at this branch', to: 'services' },
  { id: 'departments', title: 'Departments', detail: 'Manage branch departments & suites', to: 'departments' },
  { id: 'inventory', title: 'Inventory', detail: 'Manage branch inventory & reorders', to: 'branchInventory' },
  { id: 'access', title: 'Access & permissions', detail: 'Control who can access this branch', to: 'branchAccess' },
  { id: 'comms', title: 'Communication', detail: 'Configure patient WhatsApp & SMS alerts' },
]
