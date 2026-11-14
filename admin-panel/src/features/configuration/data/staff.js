// Sample staff directory until the staff API exists.
export const BRANCH_ROSTER = [
  { id: 'ananya-rao', initials: 'AR', tone: 'teal', name: 'Dr. Ananya Rao', registry: 'REG-TS-48291 · NPI-883920', type: 'Doctor', role: 'General Physician', department: 'General Medicine', branch: 'Main Clinic', slot: 'Chamber 02 · Shift A', status: 'Active' },
  { id: 'arjun-mehta', initials: 'AM', tone: 'deep', name: 'Dr. Arjun Mehta, MD', registry: 'REG-MH-20391 · NPI-119284', type: 'Doctor', role: 'Senior Cardiologist', department: 'Cardiology', branch: 'Main Clinic (Primary)', slot: 'Chamber 04 · Shift B', status: 'Active' },
  { id: 'sunita-kulkarni', initials: 'SK', tone: 'slate', name: 'Dr. Sunita Kulkarni', registry: 'REG-KA-99120 · NPI-450193', type: 'Doctor', role: 'Paediatric Specialist', department: 'Paediatrics', branch: 'Main Clinic', slot: 'Chamber 01 · Shift A', status: 'Active' },
  { id: 'rahul-kumar', initials: 'RK', tone: 'slate', name: 'Rahul Kumar', registry: 'EMP-8821 · Front Desk Operations', type: 'Staff', role: 'Receptionist & Front Desk', department: 'Reception & Front Desk', branch: 'Main Clinic', slot: 'Counter A · All Day', status: 'Active' },
  { id: 'priya-sharma', initials: 'PS', tone: 'slate', name: 'Priya Sharma, RN', registry: 'NUR-7734 · Nursing Council 4410', type: 'Staff', role: 'Head Nurse & Triage Officer', department: 'General Medicine & Emergency', branch: 'Main Clinic', slot: 'OPD Wing · Shift A', status: 'Active' },
  { id: 'suresh-patel', initials: 'SP', tone: 'slate', name: 'Suresh Patel', registry: 'PHARM-3312 · Drug Lic DL-0482', type: 'Staff', role: 'Inpatient Pharmacist', department: 'Pharmacy', branch: 'Main Clinic', slot: 'Main Dispensary', status: 'Active' },
  { id: 'neha-reddy', initials: 'NR', tone: 'slate', name: 'Neha Reddy', registry: 'EMP-9021 · Finance Officer', type: 'Staff', role: 'Accounts & Billing Exec', department: 'Administration', branch: 'Main Clinic', slot: 'Finance Office', status: 'Inactive (On Leave)' },
  { id: 'vikram-sethi', initials: 'VS', tone: 'slate', name: 'Vikram Sethi', registry: 'OPS-1002 · Facilities Lead', type: 'Staff', role: 'Chief Operations Manager', department: 'Administration', branch: 'Main Clinic', slot: 'Admin Office', status: 'Active' },
]

export const ROSTER_TOTAL = 24

export const ROSTER_FILTERS = [
  { key: 'type', label: 'All Types', options: ['Doctor', 'Staff'] },
  { key: 'department', label: 'All Departments', options: ['General Medicine', 'Cardiology', 'Paediatrics', 'Pharmacy', 'Administration'] },
  { key: 'status', label: 'All Status', options: ['Active', 'Inactive (On Leave)'] },
]

// People in the organisation directory who can be assigned to a branch.
export const DIRECTORY = [
  { id: 'rajesh-kannan', initials: 'RK', tone: 'teal', name: 'Dr. Rajesh Kannan, MD', type: 'Doctor', headline: 'Senior Neurologist · Neurology & Neurosciences', regNo: 'REG-TN-34901', assignment: 'Currently assigned: Kondapur Clinic (Primary)', note: 'Will hold OPD Chamber 03 on Tuesdays & Thursdays' },
  { id: 'meera-nambiar', initials: 'MN', tone: 'teal', name: 'Meera Nambiar', type: 'Staff', headline: 'Senior Staff Nurse & Infection Control Lead · General Medicine & Inpatient', regNo: 'EMP-6012', assignment: 'Currently assigned: Banjara Hills' },
  { id: 'vikramaditya-sen', initials: 'VS', tone: 'teal', name: 'Dr. Vikramaditya Sen', type: 'Doctor', headline: 'Consultant Orthopaedic Surgeon · Orthopaedics & Joint Care', regNo: 'REG-KA-11842', assignment: 'Unassigned (New Directory Onboarding)' },
  { id: 'farhan-akhtar', initials: 'FA', tone: 'slate', name: 'Farhan Akhtar', type: 'Staff', headline: 'Senior Pharmacist & Inventory Lead · Pharmacy & Central Dispensary', regNo: 'EMP-7740', assignment: 'Currently assigned: Metro North Clinic' },
  { id: 'shalini-mukhopadhyay', initials: 'SM', tone: 'slate', name: 'Dr. Shalini Mukhopadhyay', type: 'Doctor', headline: 'Consultant Paediatrician · Paediatrics', regNo: 'REG-MH-55201', assignment: 'Unassigned' },
  { id: 'ananya-rao', initials: 'AR', tone: 'slate', name: 'Dr. Ananya Rao', type: 'Doctor', headline: 'General Physician · General Medicine', regNo: 'REG-TS-48291', assigned: true, assignment: 'Already Assigned to Main Clinic', note: 'Already on Main Clinic active roster (Chamber 02 · Shift A)' },
  { id: 'arjun-mehta', initials: 'AM', tone: 'slate', name: 'Dr. Arjun Mehta, MD', type: 'Doctor', headline: 'Senior Cardiologist · Cardiology', regNo: 'REG-MH-20391', assigned: true, assignment: 'Already Assigned to Main Clinic', note: 'Already on Main Clinic active roster (Chamber 04 · Shift B)' },
  { id: 'anjali-menon', initials: 'AM', tone: 'slate', name: 'Anjali Menon', type: 'Staff', headline: 'Billing & Triage Associate · Reception & Front Desk', regNo: 'EMP-8119', assignment: 'Currently assigned: Kondapur Clinic' },
]

export const STAFF_PROFILE = {
  id: 'ananya-rao',
  initials: 'AR',
  name: 'Dr. Ananya Rao',
  designation: 'General Physician',
  masterId: '#STF-092',
  identification: [
    { label: 'Full Name & Post-Nominals', value: 'Dr. Ananya Rao, MD' },
    { label: 'Primary Clinical Designation', value: 'General Physician (Attending Specialist)' },
    { label: 'Institutional Email', value: 'ananya.rao@clinic.example' },
    { label: 'Official Mobile Contact', value: '+91 98490 28192' },
    { label: 'ABDM Health Professional Registry', value: 'HPR-IN-883920 · Linked & Active' },
    { label: 'State Medical Council Registration', value: 'REG-TS-48291 · Telangana State Medical Council (2014)' },
  ],
  affiliations: [
    { id: 'main', name: 'Main Clinic (HYD-HQ-01)', current: true, department: 'General Medicine', chamber: 'Chamber 02 (Shift A)', status: 'Active Practice', flag: 'Primary Facility' },
    { id: 'kondapur', name: 'Kondapur Clinic', department: 'General Medicine', chamber: 'Chamber 03 (Tue / Thu)', status: 'Active Routine' },
    { id: 'banjara', name: 'Banjara Hills Clinic', flag: 'Relieving Consultant', department: 'Outpatient Triage', chamber: 'On-Call Rotating', status: 'Active' },
  ],
  access: {
    profile: 'Doctor / Attending Physician',
    tier: 'Tier-2 Clinical Practitioner',
    permissions: ['OPD EMR Access & History Notes', 'Vitals Capture & Observation Logging', 'Diagnostic & Lab Order Direct Sign-off', 'Digital Rx Signing (ABDM Level 1)'],
    facilities: ['Main Clinic', 'Kondapur', 'Banjara Hills'],
    twoFactor: 'Enforced (Biometric / OTP)',
  },
  clinical: {
    department: 'General Medicine',
    departmentCode: '#DEP-GENMED',
    specialty: 'General & Internal Medicine',
    competencies: ['Preventive Health Checkups', 'Chronic Disease Management', 'Hypertension & Type-2 Diabetes Protocols'],
    languages: 'English, Hindi, Telugu',
    signing: 'Authorized OPD Encounters & E-Prescriptions',
  },
  audit: [
    { id: 'a1', text: 'Branch assignment updated at Main Clinic: Assigned to Chamber 02 (Shift A)', by: 'Authorized by Dr. Julian Vance', at: '12 Sep 2026, 11:20 AM' },
    { id: 'a2', text: 'Department mapping verified: General Medicine (#DEP-GENMED)', by: 'Automated Roster Validator', at: '10 Sep 2026, 09:45 AM' },
    { id: 'a3', text: 'ABDM HPR token refreshed & synced with National Registry', by: 'NDHM Bridge Service', at: '02 Sep 2026, 03:15 PM' },
    { id: 'a4', text: 'Assigned to Kondapur Clinic roster', by: 'Admin Ops Portal', at: '15 Aug 2026, 10:00 AM' },
  ],
}
