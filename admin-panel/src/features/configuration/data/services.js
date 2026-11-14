// Sample service catalogue until the services API exists. Only Cardiology Consultation has full detail.
export const SERVICE_TOTALS = [
  { label: 'Total catalogued', value: '38', hint: 'Services across entire enterprise' },
  { label: 'Clinical & OPD', value: '24', hint: 'Consultations & in-clinic' },
  { label: 'Diagnostic & Lab', value: '10', hint: 'Standard panels' },
  { label: 'Allied & Rehab', value: '4', hint: 'Multi-session protocols' },
]

export const SERVICE_TYPES = [
  { id: 'all', label: 'All Types', count: 38 },
  { id: 'consultation', label: 'Consultations' },
  { id: 'diagnostic', label: 'Diagnostics & Lab' },
  { id: 'procedure', label: 'Procedures & Day Surgery' },
  { id: 'therapy', label: 'Therapy & Allied Health' },
]

export const SERVICES = [
  { id: 'srv-card-01', name: 'Cardiology Consultation (Initial OPD)', code: '#SRV-CARD-01', cpt: 'CPT 99204', type: 'consultation', department: 'Cardiology', locations: 'Main Clinic, Kondapur', locationNote: '2 of 3 branches active', duration: '30 mins', price: '₹1,000', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-card-02', name: 'Cardiac Follow-up (Post-OPD / Rx Review)', code: '#SRV-CARD-02', cpt: 'CPT 99214', type: 'consultation', department: 'Cardiology', locations: 'Main Clinic, Kondapur', locationNote: 'Follow-up window 14 days', duration: '15 mins', price: '₹600', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-card-03', name: '12-Lead Electrocardiogram (ECG)', code: '#SRV-CARD-03', cpt: 'CPT 93000', type: 'diagnostic', department: 'Cardiology & Imaging', locations: 'All 3 branches', locationNote: 'Full network availability', duration: '15 mins', price: '₹450', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-card-04', name: '2D Transthoracic Echocardiography', code: '#SRV-CARD-04', cpt: 'CPT 93306', type: 'diagnostic', department: 'Cardiology', locations: 'Main Clinic, Kondapur', locationNote: 'Equipment-gated availability', duration: '45 mins', price: '₹2,800', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-card-05', name: 'Treadmill Stress Test (TMT)', code: '#SRV-CARD-05', cpt: 'CPT 93015', type: 'diagnostic', department: 'Cardiology', locations: 'Main Clinic', locationNote: 'Cardiac lab only', duration: '45 mins', price: '₹2,200', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-gen-01', name: 'General Physician Consultation', code: '#SRV-GEN-01', cpt: 'CPT 99203', type: 'consultation', department: 'General Medicine', locations: 'All 3 branches', locationNote: 'Branch tariff overrides allowed', duration: '20 mins', price: '₹500', priceNote: 'Branch overrides apply', status: 'Active' },
  { id: 'srv-diag-01', name: 'Comprehensive Diabetic Health Panel', code: '#SRV-DIAG-01', cpt: 'Panel · 12 tests', type: 'diagnostic', department: 'Diagnostics & Imaging', locations: 'Main Clinic, Kondapur', locationNote: 'Sample collection at both', duration: '10 mins', price: '₹1,800', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-ped-01', name: 'Pediatric Well-Baby Examination', code: '#SRV-PED-01', cpt: 'CPT 99391', type: 'consultation', department: 'Pediatrics', locations: 'Main Clinic, Banjara Hills', locationNote: 'Vaccination add-ons', duration: '30 mins', price: '₹750', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-phy-01', name: 'Physiotherapy & Musculoskeletal Rehab', code: '#SRV-PHY-01', cpt: 'Protocol · 6 sessions', type: 'therapy', department: 'Physiotherapy', locations: 'Main Clinic, Kondapur', locationNote: 'Joint multi-session plan', duration: '45 mins', price: '₹700', priceNote: 'Per session', status: 'Active' },
  { id: 'srv-orth-01', name: 'Orthopedic Joint Infiltration & Injection', code: '#SRV-ORTH-01', cpt: 'CPT 20610', type: 'procedure', department: 'Orthopedics', locations: 'Main Clinic', locationNote: 'Minor procedure room', duration: '30 mins', price: '₹1,500', priceNote: 'Standard tariff', status: 'Active' },
  { id: 'srv-sleep-01', name: 'Sleep Study & Overnight Polysomnography', code: '#SRV-SLP-01', cpt: 'Pending department mapping', type: 'diagnostic', department: '', locations: '', duration: '480 mins', price: '₹6,500', priceNote: 'Base tariff', status: 'Inactive', unmapped: true },
]

export const SERVICE_PRINCIPLES = [
  ['NODE 01', 'Service Catalog', 'Master definitions'],
  ['NODE 02', 'Dept & Branch', 'Clinical owners'],
  ['NODE 03', 'Diet & Booking', 'Doctor calendars'],
  ['NODE 04', 'Encounter', 'Clinical notes'],
  ['NODE 05', 'Charge Item', 'Branch pricing'],
  ['NODE 06', 'ABDM Claim', 'Invoice & claims'],
]

export const SERVICE_DEPARTMENTS = ['Cardiology & Vascular Medicine (#DEP-CARD)', 'General Medicine (#DEP-GEN)', 'Diagnostics & Imaging (#DEP-DIAG)', 'Pediatrics (#DEP-PED)']
export const SERVICE_TYPE_CHOICES = ['Consultation', 'Procedure', 'Diagnostic', 'Therapy', 'Follow-up', 'Other']
export const SLOT_DURATIONS = [15, 20, 30, 45, 60]
export const DELIVERY_MODALITIES = [
  { id: 'in-clinic', title: 'In-Clinic OPD', detail: 'Physical consultation chamber', defaultOn: true },
  { id: 'tele', title: 'Teleconsultation / Video', detail: 'ABDM Telemedicine Compliant', defaultOn: true },
  { id: 'in-hospital', title: 'In-Hospital Clearance', detail: 'Pre-op bedside evaluation' },
]

export const AUTHORIZABLE_BRANCHES = [
  { id: 'hq', name: 'Main Surgical Pavilion (HQ)', detail: 'Tier-2 Surgical Hospital · Gachibowli, Hyderabad', code: 'HYD-HQ-01', infrastructure: '14 Consult Suites', state: 'Active & Operational', tone: 'success' },
  { id: 'kondapur', name: 'Kondapur Day-Care Center', detail: 'Satellite Ambulatory Center · Hitec City, Hyderabad', code: 'HYD-KDP-02', infrastructure: 'OPD Wing C (6 Suites)', state: 'Active & Operational', tone: 'success' },
  { id: 'banjara', name: 'Banjara Hills Medical Center', detail: 'Tier-2 Clinic · Road No. 2, Banjara Hills', code: 'HYD-BJH-03', infrastructure: '6 Consult Rooms', state: 'Inactive for Service', tone: 'neutral' },
  { id: 'jubilee', name: 'Jubilee Hills Specialty Clinic', detail: 'Outpatient Wing · Road No. 36, Hyderabad', code: 'HYD-JBL-04', infrastructure: '3 Specialist Suites', state: 'Available', tone: 'info' },
]

export const CARDIOLOGY_CONSULT = {
  id: 'srv-card-01',
  code: '#SRV-CARD-01',
  name: 'Cardiology Consultation',
  description: 'Manage clinical service definition, branch-level availability, appointment scheduling rules, and standardized tariff schedules across all licensed facilities.',
  info: [
    { label: 'Service name', value: 'Cardiology Consultation (Initial OPD)' },
    { label: 'Service code & CPT', value: '#SRV-CARD-01 · CPT 99204' },
    { label: 'Service type', value: 'Clinical Consultation' },
    { label: 'Owning department', value: 'Cardiology' },
    { label: 'Delivery channel', value: 'In-clinic / Outpatient Care (Physical)' },
    { label: 'Clinical governance', value: 'ABDM M1/M2/M3 Coded · Standard OPD' },
    { label: 'Clinical description', value: 'Comprehensive initial cardiac clinical assessment, cardiovascular risk evaluation, resting vitals examination, and preliminary management plan review by a consultant cardiologist.', full: true },
  ],
  delivery: [
    ['Default duration', '30 mins', 'Fixed consultation slot'],
    ['Buffer / turnover', '5 mins', 'Sanitization & room prep'],
    ['Booking window', '30 days', 'Advance scheduling cap'],
  ],
  deliveryNotes: [
    ['Telehealth compatible', 'No', 'In-person physical examination required for heart sound auscultation and tactile cardiac assessment.'],
    ['Intake triage pre-requisite', 'Vitals + ECG', 'Mandatory vitals recording (BP, Pulse, SpO2, BMI) and 12-lead ECG if symptomatic prior to physician room entry.'],
  ],
  pipeline: [
    ['Appointments & Front Desk', 'Can be selected by the front desk for OPD booking (standard 30 min calibrated slots).'],
    ['Clinical Encounters', 'Auto-links SOAP clinical notes, cardiac diagnosis templates, and digital prescription modules.'],
    ['Billing & Invoicing', 'Generates itemized billing line items at ₹1,000 without manual fee entry or ledger tampering.'],
    ['ABDM Insurance Claims', 'Automatically maps diagnostic codes to ABDM insurance settlement schemas and FHIR bundles.'],
    ['Analytics & Audit Ledgers', 'Feeds OPD volume, doctor utilization rates, and departmental specialty revenue reporting.'],
  ],
  related: [
    ['Owning department', 'Cardiology & Interventional Sciences', 'View', 'department'],
    ['Operating locations', '2 Active Branches Linked', 'Manage'],
    ['Rostered practitioners', '4 Cardiologists Credentialed', 'View roster', 'departmentStaff'],
    ['Role-based access', 'Doctor Write · Front Desk Book', 'Permissions', 'departmentAccess'],
    ['Linked follow-up service', '#SRV-CARD-02 (₹600)', 'View service', 'service'],
  ],
  tariff: { base: '₹1,000', tax: 'Healthcare Services Exempt', followUp: 'Complimentary or reduced follow-up within 14 days automatically utilizes linked sub-service #SRV-CARD-02 fixed at ₹600.' },
  branches: [
    { id: 'main', name: 'MainClinic (HQ)', note: 'Surgical Pavilion Block A', status: 'Available', capacity: '4 Consultation Suites', tariff: '₹1,000', tariffNote: 'Base standard' },
    { id: 'kondapur', name: 'Kondapur Clinic', note: 'CarePoint Metro Outpatient', status: 'Available', capacity: '2 Consultation Suites', tariff: '₹1,000', tariffNote: 'Synchronized' },
    { id: 'banjara', name: 'BanjaraHills Clinic', note: 'Specialty Center', status: 'Not Configured', capacity: 'No Active Suite', tariff: '—' },
  ],
  addLocationOptions: [
    { id: 'kondapur-daycare', name: 'Kondapur Day-Care Center', code: 'HYD-KDP-02', detail: 'Satellite Ambulatory Clinic · Hitec City Corridor, Hyderabad', hours: 'Open (08:00 - 21:00)', wing: 'OPD Wing C', note: 'Adding availability creates booking capability only. Requires localized tariff setup in Branch Pricing before billing can be initiated.' },
    { id: 'jubilee', name: 'Jubilee Hills Specialty Clinic', code: 'HYD-JBL-04', detail: 'Outpatient Specialty Wing · Road No. 36, Hyderabad', hours: 'Open (09:00 - 18:00)', wing: '6 Consult Rooms' },
    { id: 'secunderabad', name: 'Secunderabad Diagnostic Pavilion', code: 'SEC-01-03', detail: 'Imaging & Clinical Lab · Cantonment, Secunderabad', hours: 'Open (07:00 - 22:00)', wing: 'Echo & ECG Lab' },
  ],
  alreadyAdded: 'Main Surgical Pavilion (HQ)',
}
