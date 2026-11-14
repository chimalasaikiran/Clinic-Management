// Sample detail records for Dr. Ananya Rao until the staff API exists.
export const ANANYA = {
  id: 'ananya-rao',
  initials: 'AR',
  name: 'Dr. Ananya Rao, MBBS, MD, DM',
  shortName: 'Dr. Ananya Rao',
  staffCode: 'STF-088',
  designation: 'Consultant Interventional Cardiologist',
  speciality: 'Specialist · Interventional Cardiology',
  iam: 'rao-ananya-88',
  rank: 'Senior Specialist Tier IV',
  institution: 'St. Jude Surgical Health System',
  council: 'NMC-TS-2018-49021',
  email: 'a.rao@stjudesurgical.com',
  mobile: '+91 98490 23114',
  department: 'Cardiology & Vascular Surgery',
  token: 'HPR-91-8842-NMC',
  facilities: '2 Facilities (Flagship Pavilion + Kondapur Surgical)',
  anchor: 'Main Surgical Pavilion',
  anchorChamber: 'Chamber Suite 104',
}

export const PROFILE_STATUS = [
  ['Person status', 'Active Master Record', 'TSMC Identity Validated'],
  ['IAM identity account', 'Active & MFA Verified', 'a.rao@stjudesurgical.com'],
  ['Clinical privileging', 'Active Faculty Privileges', 'Tier IV Invasive Surgical'],
  ['Real-time dispatch', 'Available on Duty', 'In Clinic: Chamber 104'],
]

export const DEMOGRAPHICS = [
  ['Full legal name', 'Dr. Ananya Rao'],
  ['Gender', 'Female'],
  ['Registered mobile', '+91 98490 23114'],
  ['Institutional email', 'a.rao@stjudesurgical.com'],
  ['Statutory council registration', 'NMC-TS-2018-49021'],
]

export const CLINICAL_CADRE = [
  ['Clinical designation', 'Consultant Interventional Cardiologist'],
  ['Faculty tier', 'Senior Faculty / Tier IV Specialist'],
  ['Clinical sub-focus', 'Transcatheter Aortic Valve Implantation (TAVI), Complex PCI'],
  ['Recognized qualifications', 'MBBS (AIIMS New Delhi), MD (PGI Chandigarh), DM (AIIMS Cardiology)'],
]

export const BRANCH_ROWS = [
  { id: 'main', unit: 'Main Surgical Pavilion (Flagship)', campus: 'Banjara Hills Campus', type: 'Primary Deployment', location: 'Chamber Suite 104 & Hybrid Cath Lab 01', cadence: 'Mon, Wed, Fri (Full Shift)', status: 'Active' },
  { id: 'kondapur', unit: 'Kondapur Satellite Clinic', campus: 'Outpatient Specialist Annexe', type: 'Secondary Deployment', location: 'Outpatient Chamber Suite B-02', cadence: 'Tuesday & Thursday (Half Shift OPD)', status: 'Active' },
]

export const UNITS = [
  { id: 'primary', label: 'Primary unit', primary: true, name: 'Cardiology & Vascular Surgery', code: 'Code: DPT-CARDIO-MSP', footLabel: 'Head of Department:', foot: 'Dr. Siddharth Verma, MD' },
  { id: 'cath', label: 'Allied operating unit', name: 'Cardiac Catheterization Lab', code: 'Cath Lab 01 & Hybrid OT 04', footLabel: 'Credentialed capacity:', foot: 'Primary Operator Privileged' },
  { id: 'ccu', label: 'Allied critical unit', name: 'Coronary Care Unit (CCU)', code: 'CCU Cluster 3 (Beds 301–312)', footLabel: 'Admissions protocol:', foot: 'Direct Emergency Attending' },
]

export const IAM = [
  ['Account state', 'Active Institutional IAM'],
  ['MFA authentication', 'FIDO2 YubiKey 5C Reg.'],
  ['Provisioned on', '12 Jan 2024 by Dr. J. Vance'],
]

export const ROLES = [
  { id: 'doctor', name: 'Doctor (Consultant Faculty)', detail: '18 Clinical, EMR & Admission Permissions', badge: 'Tier IV' },
  { id: 'supervisor', name: 'Clinical Supervisor', detail: '6 Supervisory Rights (RMO Co-sign, Triage)', badge: 'Active' },
]

export const OPD_CADENCE = [
  ['Total hours', '26.5 hrs/wk'],
  ['Scheduled days', '4 Days / Week'],
  ['Token capacity', '98 Tokens Max'],
  ['Chamber allocation', 'Suite 104 & B-02'],
]

export const TARIFFS = [
  { id: 'initial', name: 'Specialist Initial Cardiology Consultation', code: 'TRF-CARD-001', note: 'Physical In-Chamber', price: '₹1,200', context: 'Standard Private' },
  { id: 'followup', name: 'Cardiology Follow-Up Consultation (7-Day Validity)', code: 'TRF-CARD-002', note: 'Post-Discharge / Test Review', price: '₹600', context: 'Subsidized Follow-Up' },
  { id: 'tele', name: 'Tele-Cardiology Video Consultation', code: 'TRF-TELE-004', note: 'Sovereign Secure Video', price: '₹950', context: 'Remote Digital OPD' },
]

export const WORKFORCE_NAV = [
  { id: 'professional', title: '1. Professional Details', detail: 'Council license, qualifications' },
  { id: 'branches', title: '2. Branch Assignments', detail: '2 active facilities, chamber numbers', to: 'staffBranches' },
  { id: 'department', title: '3. Department Association', detail: 'Cardiology, Cath Lab 01, CCU' },
  { id: 'account', title: '4. User Account & IAM', detail: 'SSO identity, hardware MFA key', to: 'staffAccount' },
  { id: 'roles', title: '5. Roles & Permissions', detail: 'RBAC profiles, prescription authority' },
  { id: 'schedule', title: '6. OPD Schedule & Tariff', detail: '26.5 hrs/wk, 3 connected tariffs', to: 'staffSchedule' },
  { id: 'leave', title: '7. Leave & Availability', detail: 'Sabbaticals, block rosters', to: 'staffLeave' },
  { id: 'attendance', title: '8. Attendance & Records', detail: 'Biometric logs, punctuality', to: 'staffAttendance' },
]

export const TRUST_VAULT = [
  ['ABDM HPR registration', '#ABDM-STF-9902'],
  ['Medical council', 'Telangana State (TSMC) · Valid thru Dec 2028'],
  ['Malpractice coverage', 'Institutional Policy · Tier IV Surgical Covered'],
  ['Digital signature (DSC)', 'FIPS-140 HSM Bound'],
]

export const PROFILE_LEAVES = [
  { id: 'l1', period: '18 Oct – 20 Oct 2026', badge: 'Sabbatical', title: 'Annual Interventional Cardiology Conclave', note: '14 OPD appointment tokens auto-diverted for triage review.' },
  { id: 'l2', period: '04 Nov 2026 (Full Day)', badge: 'Chamber Block', title: 'Elective TAVI & Multi-Vessel Stent Caseload' },
]

export const AUDIT_TRAIL = [
  { id: 'a1', title: 'OPD Schedule Extended for Kondapur Clinic', when: 'Today, 10:42 AM', detail: 'Modified by Medical Directorate administrator (Dr. Julian Vance). Added 4 slots.', current: true },
  { id: 'a2', title: 'Sabbatical Leave Authorization (18–20 Oct)', when: 'Yesterday, 04:15 PM', detail: 'Approved by Head of Department (Dr. Siddharth Verma). Replacement attending confirmed.' },
  { id: 'a3', title: 'Statutory TSMC Re-verification Completed', when: '14 Sep 2026', detail: 'Automated statutory handshake via ABDM National Registry Gateway.' },
  { id: 'a4', title: 'Master Staff Profile Created', when: '12 Jan 2024', detail: 'Institutional record STF-088 initialized with Tier IV Consultant privileges.' },
]

export const OPD_SCHEDULE = [
  { day: 'Monday', on: true, note: 'Active · 2 Sessions', sessions: ['09:00 AM – 01:00 PM|15m · Max 16|Ch. 104', '04:30 PM – 07:30 PM|15m · Max 12|Ch. 104'], verified: true },
  { day: 'Tuesday', on: true, note: 'Active · Morning', sessions: ['09:00 AM – 01:00 PM|15m · Max 16|Ch. 104'], warning: '14:00–18:00 Reserved: Inpatient Cath Lab Procedures', addable: true },
  { day: 'Wednesday', on: true, note: 'Active · 2 Sessions', sessions: ['09:00 AM – 01:00 PM|15m · Max 16', '04:30 PM – 07:30 PM|15m · Max 12'], verified: true },
  { day: 'Thursday', on: false, note: 'Inactive Here', assigned: 'Assigned to Kondapur Branch OPD (10:00 AM – 06:00 PM)', aside: 'No conflicts logged at Main Pavilion' },
  { day: 'Friday', on: true, note: 'Active · Extended', sessions: ['09:30 AM – 05:30 PM|1-hr Midday Break · Max 28|Ch. 104'], alert: 'Session extends past standard OPD handover by 30 mins (Branch OPD curfew: 20:00 IST). Validated against facility roster.' },
  { day: 'Saturday', on: true, note: 'Active · Half Day', sessions: ['09:00 AM – 01:30 PM|15m · Max 18|Ch. 104'], verified: true },
  { day: 'Sunday', on: false, note: 'OFF / Inactive', aside: 'Emergency On-Call Roster Only · Standard OPD slots generated: 0', enable: true },
]

export const OPD_SERVICES = [
  { id: 's1', name: 'Cardiology Specialist Consultation (Initial)', code: 'OPD-CARD-001', modality: 'In-Person OPD', context: 'Standard Private OPD Tariff', price: '₹1,200' },
  { id: 's2', name: 'Cardiology Follow-Up Consultation (Within 7 Days)', code: 'OPD-CARD-002', modality: 'In-Person OPD', context: 'Follow-up Subsidized', price: '₹600' },
  { id: 's3', name: 'Tele-Consultation Cardiology OPD', code: 'OPD-CARD-REM', modality: 'Remote OPD', context: 'Digital Health Schedule', price: '₹950' },
]

export const LEAVE_SUMMARY = [
  ['Regular schedule', 'Configured', '26.5h · 98 slots / week'],
  ['Current availability', 'Available on duty', 'Chamber 104 · Morning OPD'],
  ['Upcoming exceptions', '2 Scheduled', '1 Sabbatical, 1 Cath Block'],
  ['Next unavailable date', '18–20 Oct 2026', 'Annual Cardiology Summit'],
]

export const LEAVE_RECORDS = [
  { id: 'e1', period: '18 Oct 2026 – 20 Oct 2026', length: '3 Full Days', kind: 'Leave', type: 'Medical Sabbatical', scope: 'All Assigned Branches', scopeNote: 'Main Pavilion & Kondapur', branch: 'all', reason: 'Cardiological Society of India (CSI) Annual Conclave', affected: '14 slots' },
  { id: 'e2', period: '04 Nov 2026', length: '02:00 PM – 07:30 PM (Evening)', kind: 'Unavailable', type: 'Temporary Chamber Block', scope: 'Main Pavilion Only', scopeNote: 'Chamber 104', branch: 'main', reason: 'Scheduled Inpatient Cath Lab Block', affected: '12 slots' },
]

export const LEAVE_HISTORY = [
  { id: 'h1', period: '12 Aug 2026 – 14 Aug 2026', type: 'Personal Leave', scope: 'Main Surgical Pavilion', by: 'Recorded by HR Admin' },
  { id: 'h2', period: '02 Jul 2026', type: 'Unplanned Emergency Relief', scope: 'All Branches', by: 'Approved by Dr. Julian Vance' },
  { id: 'h3', period: '15 May 2026 – 16 May 2026', type: 'Academic CME Workshop', scope: 'Kondapur Satellite', by: 'Self-recorded / Verified' },
]

export const FACILITY_SCOPES = [
  { value: 'all', title: 'All Assigned Branches', detail: 'Main Surgical Pavilion & Kondapur Satellite Clinic' },
  { value: 'main', title: 'Main Surgical Pavilion Only', detail: 'Keep Kondapur Tuesday/Thursday schedule intact' },
  { value: 'kondapur', title: 'Kondapur Surgical Clinic Only', detail: 'Keep Main Pavilion Mon/Wed/Fri schedule intact' },
]

export const EXCEPTION_TYPES = [
  { value: 'leave', title: 'Planned Leave', detail: 'Sabbatical / Leave' },
  { value: 'block', title: 'Temporary Block', detail: 'Procedure / Cath Lab' },
  { value: 'relief', title: 'Emergency Relief', detail: 'Immediate Notice' },
]

export const ATTENDANCE_SUMMARY = [
  { label: 'Present', value: '18', hint: 'On-time consult start 98.4%', tone: 'text-brand' },
  { label: 'Absent', value: '1', hint: 'Unscheduled: 12 Oct', tone: 'text-danger' },
  { label: 'Leave', value: '2', hint: 'Pre-approved Sabbatical', tone: 'text-brand' },
  { label: 'Late', value: '2', hint: '>15m threshold recorded', tone: 'text-amber-700' },
  { label: 'Not recorded', value: '1', hint: 'Pending supervisor verification', tone: 'text-outline' },
]

export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent', 'Leave', 'Unavail.']

export const ATTENDANCE_RECORDS = [
  { id: 'r16', date: '16 Oct 2026', today: true, facility: 'Main Surgical Pavilion', context: 'Morning OPD + Cath Lab 01', status: 'Present', time: '08:52 AM', timeNote: 'On time', source: 'Biometric Terminal B1', by: 'System (Hardware B1)', hash: '9f42b9-e8e4f9a5…78c6f1a' },
  { id: 'r15', date: '15 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Cath Lab Intervention Block', status: 'Present', time: '08:48 AM', source: 'Biometric Terminal B1', by: 'System (Hardware B1)' },
  { id: 'r14', date: '14 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Full Day OPD Roster', status: 'Late', time: '09:22 AM', timeNote: '+22m', source: 'Biometric Terminal B1', by: 'Supervisor Verified' },
  { id: 'r13', date: '13 Oct 2026', facility: 'Main Surgical Pavilion', facilityMuted: true, context: 'Off Roster (Kondapur Shift)', status: 'Not Scheduled Here', time: '— (Logged at Kondapur)', source: 'Cross-Branch Synced', by: 'System', crossBranch: true },
  { id: 'r12', date: '12 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Morning OPD Session', status: 'Absent', time: 'No punch recorded', source: 'Absence Log Engine', by: 'Dr. Julian Vance (CMP)' },
  { id: 'r10', date: '10 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Saturday Half-Day OPD', status: 'Present', time: '08:55 AM', source: 'Biometric Terminal B1', by: 'System (Hardware B1)' },
  { id: 'r09', date: '09 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Extended OPD Session', status: 'Present', time: '08:45 AM', source: 'Biometric Terminal B1', by: 'System (Hardware B1)' },
  { id: 'r08', date: '08 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Inpatient CCU Rounds', status: 'Late', time: '09:18 AM', timeNote: '+18m', source: 'Manual Entry', by: 'Admin (STF-ADN-012)' },
  { id: 'r07', date: '07 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Morning OPD + Cath Lab', status: 'Present', time: '08:50 AM', source: 'Biometric Terminal B1', by: 'System (Hardware B1)' },
  { id: 'r06', date: '06 Oct 2026', facility: 'Main Surgical Pavilion', context: 'Morning OPD + Cath Lab', status: 'Present', time: '08:58 AM', source: 'Biometric Terminal B1', by: 'System (Hardware B1)' },
  { id: 'r02', date: '02 Oct 2026', facility: 'Main Surgical Pavilion', context: 'National Holiday', status: 'Leave (Approved Holiday)', time: '—', source: 'Statutory Calendar', by: 'System' },
]
