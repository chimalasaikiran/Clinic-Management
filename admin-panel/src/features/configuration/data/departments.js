// Sample department data until the department API exists. Only Cardiology has full detail.
export const DEPARTMENT_SUMMARY = [
  { label: 'Active depts', value: '6', hint: '1 inactive org-wide' },
  { label: 'Services', value: '38', hint: 'Across specialties' },
  { label: 'Practitioners', value: '27', hint: 'Rostered staff' },
  { label: 'Suites', value: '18', hint: 'Consultation rooms' },
]

export const DEPARTMENT_GROUPS = [
  { id: 'all', label: 'All Types' },
  { id: 'clinical', label: 'Clinical Specialties' },
  { id: 'diagnostic', label: 'Diagnostic & Imaging' },
  { id: 'support', label: 'Support & Allied Health' },
  { id: 'admin', label: 'Administrative' },
]

export const DEPARTMENTS = [
  { id: 'cardiology', name: 'Cardiology & Interventional Sciences', group: 'clinical', kind: 'Clinical Specialty', scope: 'Inpatient & OPD', location: 'Main Clinic (HQ)', locationNote: 'Kondapur Clinic · 2 branches linked', services: '8 configured services', serviceNote: 'ECG, 2D Echo, Stress Test, Lipid Consult, Holter', people: '8 total personnel', peopleNote: '5 doctors · 3 cardiac nurses', status: 'Active' },
  { id: 'general-medicine', name: 'General Medicine & Internal Medicine', group: 'clinical', kind: 'Clinical Specialty', scope: 'Primary OPD', location: 'Main Clinic (HQ)', locationNote: 'Kondapur, Banjara Hills · All 3 locations', services: '12 configured services', serviceNote: 'General OPD, Diabetic Screening, Health Checks', people: '14 total personnel', peopleNote: '8 physicians · 6 clinic nurses', status: 'Active' },
  { id: 'pediatrics', name: 'Pediatrics & Neonatal Care', group: 'clinical', kind: 'Clinical Specialty', scope: 'OPD & Well-Child', location: 'Main Clinic (HQ)', locationNote: 'Banjara Hills · 2 branches', services: '6 configured services', serviceNote: 'Vaccination, Developmental Assessment', people: '10 total personnel', peopleNote: '4 pediatricians · 4 pediatric nurses', status: 'Active' },
  { id: 'orthopedics', name: 'Orthopedics & Joint Rehabilitation', group: 'clinical', kind: 'Clinical Specialty', scope: 'OPD & Day Surgery', location: 'Main Clinic (HQ)', locationNote: 'Exclusive to this branch', exclusive: true, services: '5 configured services', serviceNote: 'Orthopedic consult, intra-articular injections', people: '5 total personnel', peopleNote: '3 surgeons · 2 casting techs', status: 'Active' },
  { id: 'diagnostics', name: 'Diagnostic Imaging & Central Laboratory', group: 'diagnostic', kind: 'Diagnostics & Pathology', scope: 'Central Diagnostic Wing', location: 'Main Clinic (HQ)', locationNote: 'Kondapur Clinic · 2 branches', services: '18 diagnostic panels', serviceNote: 'Full Pathology, Digital X-Ray, Sonography', people: '8 total personnel', peopleNote: '2 radiologists · 6 lab technicians', status: 'Active' },
  { id: 'physiotherapy', name: 'Physiotherapy & Sports Rehabilitation', group: 'support', kind: 'Support & Therapy', scope: 'Allied Health', location: 'Main Clinic (HQ)', locationNote: 'Kondapur Clinic · 2 branches', services: '6 therapeutic protocols', serviceNote: 'TENS, Ultrasound, Manual therapy', people: '3 total personnel', peopleNote: '3 senior physiotherapists', status: 'Active' },
  { id: 'dermatology', name: 'Dermatology & Aesthetic Medicine', group: 'clinical', kind: 'Clinical Specialty', scope: 'Outpatient', location: 'Banjara Hills Clinic', locationNote: 'Inactive at Main Clinic', services: '4 services', serviceNote: 'Dermatology OPD, Cosmetology', people: '2 personnel', peopleNote: 'Reassigned to Banjara', status: 'Inactive here', warning: 'Temporarily consolidated into Banjara Hills branch during renovation' },
]

export const CARDIOLOGY = {
  id: 'cardiology',
  name: 'Cardiology',
  code: '#DEP-CARD-01',
  orgNode: 'Organization node: #DEP-CARD-01',
  description: "Manage this department's organizational relationships, operating branches, linked clinical services, assigned personnel, and governance.",
  info: [
    { label: 'Department name', value: 'Cardiology & Interventional Sciences' },
    { label: 'Department code', value: '#DEP-CARD-01' },
    { label: 'Department type', value: 'Clinical Specialty' },
    { label: 'Clinical Head (HOD)', value: 'Dr. Ananya Rao, MD, DM (Cardiology)' },
    { label: 'Description', value: 'Outpatient cardiology consultations, non-invasive cardiac diagnostics (ECG, 2D Echo, Stress Test), preventive risk assessments, and post-angioplasty rehabilitation.', full: true },
    { label: 'Operating scope', value: 'Outpatient & Day Care' },
    { label: 'Created Date & ABDM Compliance', value: '12 Sep 2024 · ABDM Registry: CLIN-SPEC-CARD-01' },
  ],
  locations: [
    { id: 'main', name: 'Main Clinic (HQ)', tag: 'Primary location · Headquarters', detail: '18 Consultation Suites · Suites C-101 to C-104 assigned · Active OPD sessions Mon–Sat' },
    { id: 'kondapur', name: 'Kondapur Clinic', tag: 'Branch · Secondary Branch', detail: '10 Consultation Suites · Suite K-04 assigned · Active OPD sessions Tue, Thu, Sat' },
  ],
  services: [
    { id: 'srv-card-01', name: 'Cardiology Consultation (Initial OPD)', detail: 'Clinical Consultation · 30 mins', price: '₹1,000' },
    { id: 'srv-card-02', name: 'Cardiac Follow-up (Post-OPD / Rx Review)', detail: 'Follow-up · 15 mins', price: '₹600' },
    { id: 'srv-card-03', name: '12-Lead Electrocardiogram (ECG)', detail: 'Diagnostic Protocol · 15 mins', price: '₹450' },
    { id: 'srv-card-04', name: '2D Transthoracic Echocardiography', detail: 'Diagnostic Imaging · 45 mins', price: '₹2,800' },
    { id: 'srv-card-05', name: 'Treadmill Stress Test (TMT)', detail: 'Diagnostic Protocol · 45 mins', price: '₹2,200' },
    { id: 'srv-card-06', name: 'Ambulatory Blood Pressure & Holter Monitoring', detail: 'Diagnostic / Wearable · 24 hrs', price: '₹3,500' },
  ],
  practitioners: [
    { id: 'ananya-rao', initials: 'AR', name: 'Dr. Ananya Rao, MD, DM', head: true, detail: 'Senior Interventional Cardiologist', where: 'Main Clinic (HQ) & Kondapur', when: 'Mon, Wed, Fri (HQ) · Tue, Thu (KDP)' },
    { id: 'rahul-mehta', initials: 'RM', name: 'Dr. Rahul Mehta, DNB, FACC', detail: 'Consultant Non-Invasive Cardiologist', where: 'Main Clinic (HQ)', when: 'Daily OPD: 09:00–15:00' },
    { id: 'priya-sundaram', initials: 'PS', name: 'Dr. Priya Sundaram, MBBS, PGDCC', detail: 'Clinical Cardiologist & Preventive Care', where: 'Kondapur Clinic', when: 'Tue, Thu, Sat OPD: 14:00–19:00' },
    { id: 'maria-joseph', initials: 'MJ', name: 'Sister Maria Joseph, B.Sc Nursing', detail: 'Lead Cardiac Care Nurse & ECG Specialist', where: 'Main Clinic (HQ)', when: 'Shift A lead' },
    { id: 'arun-kumar', initials: 'AK', name: 'Arun Kumar, Dip. Clinical Cardiology', detail: 'Echo & TMT Senior Technician', where: 'Main Clinic (HQ)', when: 'Cardiac Lab Shift' },
  ],
  modules: [
    { id: 'locations', title: 'Operating locations', detail: '3 branches linked (Main Clinic, Kondapur)', to: 'departmentLocations' },
    { id: 'services', title: 'Services & fee schedules', detail: '8 services configured and costed', to: 'services' },
    { id: 'practitioners', title: 'Clinical practitioners', detail: '6 active physicians & clinical staff', to: 'departmentStaff' },
    { id: 'scheduling', title: 'Appointment scheduling', detail: 'Consultation cycle routing & buffer rules' },
    { id: 'templates', title: 'Prescription templates', detail: 'Standardized cardiology Rx favorites & protocols' },
  ],
  governance: [
    ['Role-based Access', 'Configured & Enforced'],
    ['Data Scope', 'AES-256 · ABDM M1/M2/M3'],
  ],
  privileges: [
    ['Doctors', 'Clinical Full Write'],
    ['Nurses', 'Vitals & Triage'],
    ['Staff', 'Scheduling & Reception'],
  ],
}

export const DEPARTMENT_STAFF = {
  facts: [
    ['Department', 'Cardiology #DEP-CARD · Clinical Specialty'],
    ['Locations', 'Main Clinic (HQ) · Banjara Hills'],
    ['Associated personnel', '6 Associated (4 Doctors, 2 Staff)'],
    ['Registry', 'ABDM HPR M3 · 100% VERIFIED'],
  ],
  filters: [
    { id: 'all', label: 'All', match: () => true },
    { id: 'doctor', label: 'Doctors', match: (person) => person.type === 'Doctor' },
    { id: 'staff', label: 'Clinical Staff', match: (person) => person.type === 'Staff' },
  ],
  people: [
    { id: 'ananya-rao', initials: 'AR', name: 'Dr. Ananya Rao', verified: true, registry: 'ABDM HPR: 14-8892-0192 · KMC-77301', type: 'Doctor', role: 'Cardiologist - Interventional', credentials: 'MD, DM (Cardiology), FACC', locations: ['Main Clinic (HQ)', 'Banjara Hills'], scope: 'OPD, Cath Lab, Inpatient Rounds', status: 'Active' },
    { id: 'rahul-mehta', initials: 'RM', name: 'Dr. Rahul Mehta', verified: true, registry: 'ABDM HPR: 14-3401-9923 · KMC-64812', type: 'Doctor', role: 'Consultant Cardiologist (Non-invasive)', credentials: 'DNB, Dip. Card, FASE', locations: ['Main Clinic (HQ)'], scope: 'OPD & Echo Clinic', status: 'Active' },
    { id: 'priya-sharma', initials: 'PS', name: 'Priya Sharma', registry: 'NMC-RN: 88129 · B.Sc Nursing (Cardiac)', type: 'Staff', role: 'Lead Cardiac Nurse', credentials: 'Cath Lab & ICU Specialist', locations: ['Main Clinic (HQ)', 'Banjara Hills'], scope: 'Pre-op Triage & Recovery', status: 'Active' },
    { id: 'arjun-kumar', initials: 'AK', name: 'Arjun Kumar', registry: 'ID: STF-4402 · Dip. Cardiovascular Tech', type: 'Staff', role: 'Clinical Cath Lab Assistant', credentials: 'Diagnostics Support', locations: ['Main Clinic (HQ) only'], scope: 'Echo & ECG Tech Assistance', status: 'Active' },
    { id: 'sneha-patel', initials: 'SP', name: 'Sneha Patel', registry: 'ID: STF-6219 · Operations & TPA', type: 'Staff', role: 'Front Office & Patient Coordinator', credentials: 'Cardiology OPD Desk', locations: ['Banjara Hills'], scope: 'OPD Registration & TPA Triage', status: 'Active' },
    { id: 'suresh-varma', initials: 'SV', name: 'Dr. Suresh Varma', registry: 'ABDM HPR: 14-1029-4401 · KMC-39102', type: 'Doctor', role: 'Visiting Pediatric Cardiologist', credentials: 'MD, Dip. (Ped. Cardiology)', locations: ['Banjara Hills'], scope: 'Pediatric Outpatient Rounds', status: 'Inactive', derostered: true },
  ],
  candidates: [
    { id: 'vikram-sethi', initials: 'VS', name: 'Dr. Vikram Sethi', verified: true, type: 'Doctor', detail: 'Interventional Electrophysiologist', registry: 'ABDM HPR: 14-8892-0192 · KMC-64812', locations: ['Main Clinic (HQ)', 'Banjara Hills'] },
    { id: 'sneha-rao', initials: 'SP', name: 'Sneha Patel', type: 'Staff', detail: 'Senior Cardiac Rehabilitation Specialist', registry: 'NMC-PT: 22091 · Post-CABG Physio Care', locations: ['Main Clinic (HQ)'] },
    { id: 'meera-nambiar', initials: 'MN', name: 'Dr. Meera Nambiar', verified: true, type: 'Doctor', detail: 'Pediatric Cardiologist & Congenital Echo', registry: 'ABDM HPR: 14-3401-9923 · KMC-77301', locations: ['Banjara Hills'] },
    { id: 'rajesh-varma', initials: 'RV', name: 'Rajesh Varma', type: 'Staff', detail: 'Cath Lab Lead Perfusionist', registry: 'ID: PERF-082 · Certified Clinical Perfusionist', locations: ['Main Clinic (HQ)'] },
    { id: 'tanvi-deshmukh', initials: 'TD', name: 'Dr. Tanvi Deshmukh', verified: true, type: 'Doctor', detail: 'Non-invasive Cardiologist & Preventive Care', registry: 'ABDM HPR: 14-1102-4402 · KMC-90123', locations: ['Kondapur Clinic'] },
    { id: 'farooq-ahmed', initials: 'FA', name: 'Farooq Ahmed', type: 'Staff', detail: 'Cardiac Diagnostic Technician', registry: 'ID: TECH-301 · Echo & Holter ECG Monitoring', locations: ['Main Clinic (HQ)'] },
  ],
  alreadyAdded: ['Dr. Ananya Rao', 'Dr. Rahul Mehta', 'Priya Sharma'],
}

export const DEPARTMENT_LOCATIONS = {
  facts: ['Cardiology (#DEP-CARD · Clinical Specialty)', '2 assigned (Active across 2 clinical nodes)', '8 services assigned', '6 associated (4 Doctors, 2 Staff)', 'ABDM HFR M3 · 100% Certified'],
  rows: [
    { id: 'main', name: 'Main Surgical Pavilion (HQ)', code: '#HYD-01', badge: 'ABDM HFR VERIFIED', address: 'Plot 12, Jubilee Hills Health Corridor', city: 'Hyderabad, Telangana', cityNote: 'Urban South · Metro Zone 1', hours: 'Open · 24/7', hoursNote: 'Tertiary Care', hoursDetail: 'Cath Lab & Cardiac ICU on-site', services: '6 Services', servicesNote: 'Configured in Department Services', people: '4 Doctors, 2 Staff', peopleNote: 'Rostered in Department People', status: 'Active' },
    { id: 'banjara', name: 'Banjara Hills Medical Center', code: '#HYD-02', badge: 'ABDM NODE', address: 'Road No. 2, Near Park Hyatt Arcade', city: 'Hyderabad, Telangana', cityNote: 'Central Hills · Outpatient Hub', hours: 'Open · 08:00 - 20:00', hoursNote: 'Outpatient Cardiology & Echo Lab', services: '4 Services', servicesNote: 'Configured in Department Services', people: '3 Doctors, 1 Staff', peopleNote: 'Rostered in Department People', status: 'Active' },
    { id: 'kondapur', name: 'Kondapur Day Surgery & Diagnostics', code: '#HYD-03', badge: 'HISTORICAL', address: 'HITEC IT Corridor Spine, Kondapur', city: 'Hyderabad, Telangana', cityNote: 'West Zone · Cyberabad', hours: 'Under Facility Upgrade', hoursNote: 'Reopening Q4 2025', services: '0 Services', servicesNote: 'Association detached', people: '0 Rostered', peopleNote: 'No active schedule', status: 'Inactive', muted: true },
  ],
  candidates: [
    { id: 'gachibowli', name: 'Gachibowli Multi-Specialty Hospital', badge: 'HFR VERIFIED', code: '#HYD-04', city: 'Hyderabad, Telangana · Financial District', hours: 'Open · 24/7 Tertiary Care', capacity: '8 Chambers · 2 Cath Labs' },
    { id: 'secunderabad', name: 'Secunderabad Diagnostic & Specialty Hub', badge: 'ABDM NODE', code: '#SEC-01', city: 'Secunderabad, Telangana · MG Road Corridor', hours: 'Open · 07:30 - 21:00', capacity: '4 Chambers · Imaging Ready' },
    { id: 'hitec', name: 'HITEC City Ambulatory Center', badge: 'ABDM VERIFIED', code: '#HYD-05', city: 'Hyderabad, Telangana · Cyber Towers Corridor', hours: 'Open · 08:00 - 20:00', capacity: '3 Consultation Suites' },
    { id: 'vijayawada', name: 'Vijayawada Regional Satellite', badge: 'SATELLITE', code: '#BZA-01', city: 'Vijayawada, Andhra Pradesh · Governorpet Hub', hours: 'Open · 09:00 - 18:00', capacity: '2 Outpatient Rooms' },
  ],
  alreadyAdded: ['Main Surgical Pavilion (HQ)', 'Banjara Hills Medical Center'],
}

export const DEPARTMENT_ACCESS = {
  summary: [
    { label: 'Department', value: 'Cardiology', hint: '#DEP-CARD · Specialty' },
    { label: 'Active locations', value: 'Main Clinic & Kondapur', hint: '2 Active Nodes · Attached' },
    { label: 'Access scope', value: 'Dept Overrides & Hierarchical Cascade' },
    { label: 'Active principals', value: '6 Configured', hint: '5 Roles, 3 Direct' },
    { label: 'Governance', value: 'ABDM Level-3 Audit', hint: 'HIPAA Compliant' },
  ],
  modes: [
    { id: 'inherit', title: 'Inherited Access Active', badge: 'ENABLED', detail: 'Follows parent clinic branch RBAC baseline for read-only staff operations.', on: true },
    { id: 'direct', title: 'Department Direct Grants', badge: 'PRIORITY', detail: 'Explicit user or role grants defined here override branch baselines.', on: true },
    { id: 'allowlist', title: 'Restricted Allowlist Mode', badge: 'OFF', detail: 'When enabled, isolates Cardiology by blocking all inherited branch access.', on: false },
  ],
  principals: [
    { id: 'ananya', initials: 'AR', name: 'Dr. Ananya Rao', detail: 'ananya.rao@stjude-health.org', registry: 'ABDM-AP-8861', kind: 'Direct user', level: 'Full access', scope: 'Department Direct', scopeNote: 'Explicit Override', modified: 'Modified May 14, 2024' },
    { id: 'cardiologist', initials: '', name: 'Cardiologist', detail: 'Specialty Consultant Medical Role (4 Assigned)', kind: 'Role', level: 'Full access', scope: 'Department Direct', scopeNote: 'Standard Specialty Role', modified: 'System ledger' },
    { id: 'rahul', initials: 'RM', name: 'Dr. Rahul Mehta', detail: 'rahul.mehta@stjude-health.org', registry: 'ABDM VM-1049', kind: 'Direct user', level: 'Work access', scope: 'Department Direct', scopeNote: 'Explicit Override', modified: 'Modified Jul 02, 2024' },
    { id: 'priya', initials: 'PS', name: 'Priya Sharma', detail: 'NMC-0382 · Lead Cath Lab Staff', kind: 'Direct user', level: 'Work access', scope: 'Department Direct', scopeNote: 'Specialty Team Role', modified: 'Modified Oct 5, 2024' },
    { id: 'cathlab', initials: '', name: 'Clinical Cath Lab Staff', detail: 'Catheterization Procedure Technical Team (6 Assigned)', kind: 'Role', level: 'Work access', scope: 'Department Direct', scopeNote: 'Specialty Team Role', modified: 'System ledger' },
    { id: 'frontoffice', initials: '', name: 'Front Office & Reception', detail: 'Patient Check-in & Scheduling Desk (12 Assigned)', kind: 'Role', level: 'View only', scope: 'Inherited from Main Clinic (HQ)', scopeNote: 'Branch Default Role', modified: 'Cascade Synced' },
    { id: 'triage', initials: '', name: 'Triage & OPD Nurse', detail: 'Inpatient/Outpatient Nursing Station (18 Assigned)', kind: 'Role', level: 'Work access', scope: 'Inherited from Main Clinic (HQ)', scopeNote: 'Branch Default Role', modified: 'Cascade Synced' },
    { id: 'billing', initials: '', name: 'Billing & Insurance Desk', detail: 'Revenue Cycle & TPA Claims Team (6 Assigned)', kind: 'Role', level: 'View only', scope: 'Inherited from Organization', scopeNote: 'Global Health System Role', modified: 'Cascade Synced' },
  ],
  capabilities: [
    ['View department overview & roster', 'Allowed', 'Allowed', 'Allowed'],
    ['View services & consultation catalog', 'Allowed', 'Allowed', 'Allowed'],
    ['View assigned department doctors & staff', 'Allowed', 'Allowed', 'Allowed'],
    ['Roster & schedule clinical appointments', 'Allowed', 'Allowed', 'Not allowed'],
    ['Create & execute clinical encounters / OPD', 'Allowed', 'Allowed', 'Not allowed'],
    ['Associate & unlink clinic branch locations', 'Allowed', 'Not allowed', 'Not allowed'],
    ['Associate & assign personnel to department', 'Allowed', 'Not allowed', 'Not allowed'],
    ['Configure department settings & RBAC rules', 'Allowed (Admin Only)', 'Not allowed', 'Not allowed'],
  ],
  candidates: [
    { id: 'vikram', initials: 'VS', name: 'Dr. Vikram Sethi', detail: 'Doctor · ABDM HPR: 14-8892-0192 · Main Clinic (HQ)', tag: 'Eligible for direct grant' },
    { id: 'cathlab-tech', initials: '', name: 'Cath Lab Technologist', detail: 'Clinical/Specialty Role · 4 Assignees', tag: 'Role overview', role: true },
    { id: 'meera', initials: 'MN', name: 'Meera Nambiar', detail: 'Pediatric Cardiologist · ABDM HPR: 14-3401-9923', tag: '' },
    { id: 'triage-nurse', initials: '', name: 'Triage & OPD Nursing Staff', detail: 'Role · 18 Assigned', tag: 'Inherited (Work access via Main Clinic)', role: true, locked: true },
  ],
}
