// Sample branch access data until the access-control API exists.
export const ACCESS_SUMMARY = [
  { label: 'People with access', value: '18', hint: '4 clinical · 4 administration', note: 'All credentials verified (NMC)' },
  { label: 'Roles mapped', value: '6', hint: 'Role assignments active', note: 'Inherited group matrix' },
  { label: 'Full access', value: '5', hint: 'Direct branch leads', note: '2 Attending, 3 Directors' },
  { label: 'Limited access', value: '13', hint: 'Work & View scopes', note: 'Restricted departmental duty' },
]

export const ACCESS_LEVELS = {
  full: { label: 'Full (Clinical & Consult)', tone: 'success' },
  fullSovereign: { label: 'Full (Sovereign Authority)', tone: 'success' },
  workRegistration: { label: 'Work (Registration & POS)', tone: 'warning' },
  workVitals: { label: 'Work (Vitals & Triage Entry)', tone: 'warning' },
  workDispensing: { label: 'Work (Dispensation & Sched H)', tone: 'warning' },
  viewLedger: { label: 'View only (Ledger Audit)', tone: 'neutral' },
  viewStock: { label: 'View only (Stock Audit)', tone: 'neutral' },
}

export const BRANCH_ACCESS = [
  { id: 'ananya-rao', initials: 'AR', name: 'Dr. Ananya Rao', detail: '#STF-092 · Doctor · General Physician', level: 'full', scope: 'Main Clinic (Chamber 02)', scopeNote: 'OPD Wing & Teleconsult Lab', department: 'General Medicine', status: 'Active', source: 'Role-based' },
  { id: 'rahul-kumar', initials: 'RK', name: 'Rahul Kumar', detail: 'EMP-8821 · Receptionist & Front Desk', level: 'workRegistration', scope: 'Main Clinic (Desk 01)', scopeNote: 'Shift A 02/00 – 18:30', department: 'Reception & Front Desk', status: 'Active', source: 'Role-based' },
  { id: 'priya-sharma', initials: 'PS', name: 'Priya Sharma, RN', detail: 'NUR-7734 · Head Nurse & Triage Officer', level: 'workVitals', scope: 'Main Clinic (All Clinical Wards)', scopeNote: 'ICU, Post-Op, Recovery Bay', department: 'General Medicine', status: 'Active', source: 'Direct' },
  { id: 'neha-reddy', initials: 'NR', name: 'Neha Reddy', detail: 'EMP-9021 · Accounts & Billing Exec', level: 'viewLedger', scope: 'Main Clinic (Finance Unit)', scopeNote: 'Day Reconciliation Desk', department: 'Administration', status: 'Active', source: 'Direct' },
  { id: 'julian-vance', initials: 'JV', name: 'Dr. Julian Vance, MD', detail: 'PROPRIETOR-01 · Chief Medical Proprietor', level: 'fullSovereign', scope: 'Main Clinic (All Wings & Theatres)', scopeNote: 'Unrestricted Sovereign Jurisdiction', department: 'Executive & Surgery', status: 'Active', source: 'Inherited', sourceLink: true },
  { id: 'suresh-patel', initials: 'SP', name: 'Suresh Patel', detail: 'Drug Lic DL-0482 · Inpatient Pharmacist', level: 'workDispensing', scope: 'Main Pharmacy (Dispensing Bay 1 & 2)', scopeNote: 'Narcotics Vault Access Restricted', department: 'Pharmacy', status: 'Active', source: 'Role-based' },
  { id: 'farhan-akhtar', initials: 'FA', name: 'Farhan Akhtar', detail: 'EMP-7740 · Inventory Lead', level: 'viewStock', scope: 'Main Clinic (Stores & Cold Chain)', scopeNote: 'Consumables & Vaccines', department: 'Pharmacy & Stores', status: 'Active', source: 'Inherited', sourceLink: true },
]

export const ACCESS_TIERS = [
  { id: 'full', tone: 'bg-emerald-500', title: 'Full Access (Facility Lead)', detail: 'Authorized to execute all permitted clinical and operational workflows within this branch. Direct branch administrators and heads of department with physical oversight.', foot: 'Can manage branch schedules, counters & countersign triage' },
  { id: 'work', tone: 'bg-amber-500', title: 'Work Access (Duty Operator)', detail: 'Permitted to execute routine daily transactions: scheduling, registration, point-of-sale invoicing, vitals recording, and schedule H dispensation strictly within assigned bays.', foot: 'Constrained to active shifts and assigned physical chambers' },
  { id: 'view', tone: 'bg-slate-500', title: 'View Only (Audit / Inspection)', detail: 'Can inspect medical registers, patient appointments, and inventory levels for financial auditing and supply tracking without modification or signature credentials.', foot: 'Zero-write capability; all access requests watermarked' },
]

export const ACCESS_TIER_OPTIONS = [
  { value: 'full', title: 'Full Access (Branch Lead)', detail: 'Full departmental control, staff shift oversight, clinical counter-signing.' },
  { value: 'work', title: 'Work Access (Duty Operator)', detail: 'Execution of consultations, procedural entries, and outpatient billing.', standard: true },
  { value: 'view', title: 'View Only (Audit Scope)', detail: 'Telemetry inspection, telemetry charts, read-only patient registry.' },
]

export const ACCESS_CANDIDATES = [
  { id: 'rajesh-kannan', initials: 'RK', name: 'Dr. Rajesh Kannan, MD', detail: 'Neurologist · Central Staff #STF-114', note: 'Medical Council: AP-MED-64820 · Verified Active', eligible: true },
  { id: 'vikramaditya-sen', initials: 'VS', name: 'Dr. Vikramaditya Sen', detail: 'Orthopaedic Surgeon · #STF-209', note: 'Visiting Senior Consultant · Apollo Credentialed', eligible: true },
  { id: 'meera-nambiar', initials: 'MN', name: 'Meera Nambiar', detail: 'Staff Nurse · NUR-6401', note: 'Assigned to Post-Operative Recovery bay', eligible: false },
]

export const ACCESS_ROLES = [
  { id: 'role-lead', name: 'Branch Administrator', detail: 'Facility lead · 2 people hold this role', note: 'Full operational authority within the branch', eligible: true },
  { id: 'role-attending', name: 'Attending Physician', detail: 'Clinical consult & encounter signing · 5 people', note: 'Requires verified council registration', eligible: true },
  { id: 'role-nurse', name: 'Nursing & Triage', detail: 'Vitals, triage entry, ward duty · 6 people', note: 'Scoped to assigned wards and shifts', eligible: true },
  { id: 'role-front-desk', name: 'Front Desk & Registration', detail: 'Registration, scheduling, POS · 3 people', note: 'Scoped to assigned counters', eligible: true },
  { id: 'role-auditor', name: 'Audit / Inspection', detail: 'Read-only ledger and stock audit · 2 people', note: 'Already mapped to this branch', eligible: false },
]
