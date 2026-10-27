import { dashboardIcons as icons } from '../../../assets/icons/dashboard'

export const OWNER = {
  name: 'Dr. Siddharth Verma',
  role: 'Owner · Medical Director',
}

export const PAGE_META = {
  eyebrow: 'Owner workspace · Operational overview',
  telemetry: 'Live telemetry active',
  greeting: `Good morning, ${OWNER.name}`,
  summary: "Here's how your clinic is doing today across clinical sessions, collections, and team flow.",
  locationFilter: 'All locations (3)',
  dateFilter: 'Today, Oct 24',
  lastSynced: 'Last synced 2m ago',
}

export const SIDEBAR_BRANCH = { name: 'Aura Health', scope: 'Single Location', uptime: '99.98%' }

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: icons.navOverview, active: true },
  { id: 'patients', label: 'Patients', icon: icons.navPatients },
  { id: 'appointments', label: 'Appointments', icon: icons.navAppointments },
  { id: 'clinical', label: 'Clinical', icon: icons.navClinical },
  { id: 'billing', label: 'Billing & Finance', icon: icons.navBilling },
  { id: 'pharmacy', label: 'Pharmacy', icon: icons.navPharmacy },
  { id: 'inventory', label: 'Inventory', icon: icons.navInventory },
  { id: 'staff', label: 'Staff', icon: icons.navStaff },
  { id: 'growth', label: 'Growth', icon: icons.navGrowth },
  { id: 'reports', label: 'Reports', icon: icons.navReports },
  { id: 'configuration', label: 'Configuration', icon: icons.navConfiguration },
]

export const KEY_METRICS = [
  {
    id: 'appointments',
    label: 'Appointments',
    icon: icons.metricAppointments,
    value: '24 scheduled',
    detail: '18 completed · 3 waiting · 3 upcoming',
    bar: [
      { width: 75, className: 'bg-brand' },
      { width: 12.5, className: 'bg-amber-400' },
      { width: 12.5, className: 'bg-slate-300' },
    ],
  },
  {
    id: 'patients',
    label: 'Patients',
    icon: icons.metricPatients,
    value: '18 seen',
    detail: '3 waiting in triage · Avg wait: 8 mins',
    status: 'OPD Bays 1-3 operating normal',
  },
  {
    id: 'collections',
    label: 'Collections',
    icon: icons.metricCollections,
    value: '₹42,500',
    unit: 'today',
    detail: '2 payments pending reconciliation',
    note: 'UPI / POS split (88% digital)',
  },
  {
    id: 'outstanding',
    label: 'Outstanding',
    icon: icons.metricOutstanding,
    value: '₹18,200',
    detail: '6 invoices pending clearance',
    warning: '3 corporate / 3 retail',
  },
  {
    id: 'no-shows',
    label: 'No-shows',
    icon: icons.metricNoshows,
    value: '2',
    unit: 'today',
    detail: 'Rate: 7.6% (Low)',
    queue: { label: 'Reschedule queue', pending: '2 pending' },
  },
]

export const ATTENTION_ITEMS = [
  {
    id: 'payments',
    icon: icons.attnPayment,
    tone: 'amber',
    title: 'Payment reconciliation',
    badge: '3 pending',
    description: '3 payments are awaiting reconciliation (UPI & insurance split)',
    action: 'Review',
    primary: true,
  },
  {
    id: 'reports',
    icon: icons.attnReports,
    tone: 'indigo',
    title: 'Reports awaiting review',
    badge: '4 reports',
    description: '4 reports are ready for review (Cardiology & pathology sign-offs)',
    action: 'Review reports',
  },
  {
    id: 'inventory',
    icon: icons.attnInventory,
    tone: 'rose',
    title: 'Inventory',
    badge: 'Low Stock',
    description: '1 item is below reorder level (Amoxicillin 500mg sterile pack)',
    action: 'View inventory',
  },
  {
    id: 'staff-tasks',
    icon: icons.attnStaff,
    tone: 'orange',
    title: 'Staff tasks',
    badge: '2 overdue',
    description: '2 staff tasks are overdue (Weekend duty roster shifts unassigned)',
    action: 'View tasks',
  },
]

export const OPERATIONS = {
  chips: [
    { label: 'Scheduled', value: 24, tone: 'slate' },
    { label: 'Completed', value: 18, tone: 'emerald' },
    { label: 'Waiting', value: 3, tone: 'amber' },
    { label: 'No-show', value: 2, tone: 'rose' },
  ],
  sessions: [
    {
      id: 'morning',
      icon: icons.sessionMorning,
      title: 'Morning session',
      window: '(08:30 AM – 01:30 PM)',
      status: { label: 'Finished / Wrap-up', tone: 'slate' },
      stats: [
        { label: '12 appointments', className: 'text-slate-700' },
        { label: '9 completed', className: 'text-emerald-700' },
        { label: '2 waiting', className: 'text-amber-700' },
        { label: '1 no-show', className: 'text-slate-500' },
      ],
      bar: [
        { width: 75, className: 'bg-emerald-600' },
        { width: 17, className: 'bg-amber-400' },
        { width: 8, className: 'bg-slate-400' },
      ],
    },
    {
      id: 'afternoon',
      icon: icons.sessionAfternoon,
      title: 'Afternoon session',
      window: '(02:30 PM – 07:30 PM)',
      status: { label: 'In progress', tone: 'emerald' },
      highlighted: true,
      stats: [
        { label: '12 appointments', className: 'text-slate-700' },
        { label: '9 upcoming', className: 'text-sky-700' },
        { label: '1 waiting', className: 'text-amber-700' },
        { label: 'Expected load: Moderate', className: 'text-slate-500' },
      ],
      bar: [
        { width: 25, className: 'bg-brand' },
        { width: 67, className: 'bg-sky-400' },
        { width: 8, className: 'bg-slate-300' },
      ],
    },
  ],
}

export const FINANCE = {
  tiles: [
    { id: 'collections', label: "Today's collections", value: '₹42,500', note: '+14.2% vs previous run', noteClass: 'text-emerald-700 font-medium' },
    { id: 'outstanding', label: 'Outstanding', value: '₹18,200', note: '6 invoices pending', noteClass: 'text-slate-500' },
    { id: 'refunds', label: 'Refunds', value: '₹2,400', note: '1 processed (Lab cancellation)', noteClass: 'text-slate-500' },
    {
      id: 'reconciliation',
      label: 'Awaiting reconciliation',
      value: '3 payments',
      valueClass: 'text-amber-700',
      note: 'UPI / POS clearing flag',
      noteClass: 'text-amber-800 font-medium',
    },
  ],
  footnote: 'Operational financial awareness. Detailed auditing available in Billing & Finance.',
}

export const TEAM = {
  total: 18,
  presence: [
    { label: '15 present', count: 15, labelClass: 'text-emerald-700', barClass: 'bg-emerald-600' },
    { label: '2 on leave', count: 2, labelClass: 'text-amber-700', barClass: 'bg-amber-400' },
    { label: '1 absent', count: 1, labelClass: 'text-rose-700', barClass: 'bg-rose-500' },
  ],
  alert: '3 tasks need attention (Duty roster & credential renewals)',
  shifts: [
    { label: 'Doctors', value: '5 on duty' },
    { label: 'Nursing', value: '8 on duty' },
    { label: 'Front desk', value: '2 on duty' },
  ],
  nextSync: 'Shift handoff schedule: Next sync at 02:00 PM',
  syncStatus: 'Roster sync active',
}

export const LOCATIONS = [
  {
    id: 'hq',
    code: 'HQ',
    name: 'Main Clinic (Indiranagar HQ)',
    focus: 'Primary Multi-Specialty & Day Surgery',
    appointments: 12,
    collections: '₹21,400',
    exceptions: { label: '2 items', className: 'text-rose-700' },
    primary: true,
  },
  {
    id: 'kondapur',
    code: 'KP',
    name: 'Kondapur Clinic',
    focus: 'Outpatient Consultation & Diagnostics',
    appointments: 8,
    collections: '₹13,600',
    exceptions: { label: '1 item', className: 'text-amber-700' },
  },
  {
    id: 'banjara',
    code: 'BH',
    name: 'Banjara Hills Clinic',
    focus: 'Pediatric & Dental Specialty Hub',
    appointments: 6,
    collections: '₹7,500',
    exceptions: { label: '0 items', className: 'text-emerald-700' },
  },
]

export const ACTIVITY = [
  {
    id: 'payment',
    title: 'Payment received',
    time: '10 min ago',
    dot: 'bg-emerald-600 shadow-[0_0_0_2px_#d1fae5]',
    body: [
      '₹2,500 payment received from patient ',
      { strong: 'Rohit Mehta' },
      ' (UPI)',
    ],
  },
  {
    id: 'appointment',
    title: 'Appointment booked',
    time: '24 min ago',
    dot: 'bg-brand shadow-[0_0_0_2px_#ccfbf1]',
    body: ['New appointment booked for 4:30 PM (', { strong: 'Dr. Ananya Sen · Cardiology' }, ')'],
  },
  {
    id: 'prescription',
    title: 'Prescription dispensed',
    time: '42 min ago',
    dot: 'bg-indigo-500 shadow-[0_0_0_2px_#e0e7ff]',
    body: ['Prescription dispensed by Pharmacy (', { muted: '#9042' }, ')'],
  },
  {
    id: 'attendance',
    title: 'Staff attendance',
    time: '1 hr ago',
    dot: 'bg-sky-500 shadow-[0_0_0_2px_#e0f2fe]',
    body: [{ strong: 'Dr. Mehta' }, ' marked attendance (Biometric)'],
  },
  {
    id: 'lab',
    title: 'Lab result received',
    time: '1 hr ago',
    dot: 'bg-amber-500 shadow-[0_0_0_2px_#fef3c7]',
    body: ['Blood test result added to patient record (', { strong: 'Metropolis' }, ')'],
  },
]

export const QUICK_ACTIONS = [
  { id: 'register', label: 'Register patient', icon: icons.qaRegister },
  { id: 'book', label: 'Book appt', icon: icons.qaBook },
  { id: 'invoice', label: 'Create invoice', icon: icons.qaInvoice },
  { id: 'service', label: 'Add service', icon: icons.qaService },
  { id: 'staff', label: 'Add staff', icon: icons.qaStaff },
]

export const SETUP_CHECKLIST = {
  completed: 4,
  total: 7,
  next: { title: 'Services & pricing', hint: 'Recommended next step · Set catalogs', action: 'Configure' },
  remaining: [
    { step: 5, label: 'Staff & roles', hint: 'Set roles' },
    { step: 6, label: 'Billing configuration', hint: 'Connect UPI/POS' },
    { step: 7, label: 'Pharmacy setup', hint: 'Formulary' },
    { step: 8, label: 'Diagnostics', hint: 'Templates' },
    { step: 9, label: 'Communication', hint: 'SMS / WhatsApp' },
  ],
}

export const FOOTER = {
  product: 'ClinicOS Sovereign 4.2.0',
  notes: ['HIPAA & ABDM Compliant Enterprise Architecture', 'Data Encrypted at Rest (AES-256)'],
  links: ['Emergency Protocol', 'Audit Export', 'Privacy & Sovereignty'],
}
