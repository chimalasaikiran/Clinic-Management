// Sample visit history for PT-000184 (Ananya Sharma): appointments, encounters, vitals and diagnoses.
const PATIENT = 'pt-000184'
const MAIN = { branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus' }

export const SEED_APPOINTMENTS = [
  {
    id: 'APT-2026-0912', patientId: PATIENT, date: '2026-10-12', time: '10:30', minutes: 30, type: 'Consultation', mode: 'In-Person Clinical Consultation',
    service: 'OPD Consultation (Post-Op Review)', serviceCode: 'SRV-CARD-009', tariff: 2800, token: '#88', tokenLabel: 'OPD Queue Slot',
    doctorId: 'rahul-mehta', doctor: 'Dr. Rahul Mehta, MD, DM', doctorShort: 'Dr. Rahul Mehta', specialty: 'Interventional Cardiologist',
    department: 'Cardiology OPD', room: 'Suite 302 (Wing B)', ...MAIN, status: 'Confirmed',
    reason: 'Post-CABG 90-day follow-up review & echocardiography evaluation',
    prep: 'Mandated Prep: Fasting lipid profile mandated before visit. Patient instructed to carry recent BP log.',
    bookedBy: 'Priya Nair (Reception)', channel: 'Reception / In-Person Intake',
    audit: [
      { time: '09:12 AM', text: 'Appointment booked via Reception desk', by: 'Staff operator: Priya Nair (Terminal T-02)' },
      { time: '09:15 AM', text: 'WhatsApp confirmation dispatched', by: 'Webhook delivery: HTTP 200 OK' },
    ],
  },
  {
    id: 'APT-2026-0924', patientId: PATIENT, date: '2026-10-24', time: '16:00', minutes: 45, type: 'Procedure', mode: 'In-Person Clinical Consultation',
    service: 'Cardiac Rehab & Physiotherapy Evaluation', serviceNote: 'Session #02 of 10 Protocol', serviceCode: 'SRV-PMR-001', tariff: 1200,
    doctorId: 'preeti-deshmukh', doctor: 'Dr. Preeti Deshmukh, BPT', doctorShort: 'Dr. Preeti Deshmukh', specialty: 'Physiotherapist',
    department: 'Physical Medicine & Rehab', room: 'Chamber 104', branch: 'Metro North Clinic', campus: 'Begumpet Annex', status: 'Scheduled',
    reason: 'Phase II cardiac rehabilitation, session 2 of 10', bookedBy: 'Priya Nair (Reception)', channel: 'Reception / In-Person Intake', audit: [],
  },
  {
    id: 'APT-2026-0894', patientId: PATIENT, date: '2026-10-05', time: '11:00', minutes: 28, type: 'Follow-up', mode: 'In-Person Clinical Consultation',
    service: 'Follow-up Clinical Consultation', serviceNote: 'Rx · Discharged', token: '#14', doctorId: 'rahul-mehta', doctor: 'Dr. Rahul Mehta, MD, DM', doctorShort: 'Dr. Rahul Mehta', specialty: 'Interventional Cardiologist',
    department: 'Cardiology OPD', room: 'Suite 302', ...MAIN, status: 'Completed', encounterId: 'ENC-2026-0894', tariff: 1500, audit: [],
  },
  {
    id: 'APT-2026-0741', patientId: PATIENT, date: '2026-09-20', time: '15:30', minutes: 45, type: 'Procedure', mode: 'In-Person Clinical Consultation',
    service: 'Pre-Operative Surgical Workup', serviceNote: 'Cardiac PAC Clearance Granted', doctorId: 'julian-vance', doctor: 'Dr. Julian Vance, MD, FRCS', doctorShort: 'Dr. Julian Vance', specialty: 'Cardio-Thoracic Surgery',
    department: 'Cardio-Thoracic Surgery', room: 'Suite 401', ...MAIN, status: 'Completed', encounterId: 'ENC-2026-0741', tariff: 2200, audit: [],
  },
  {
    id: 'APT-2026-0610', patientId: PATIENT, date: '2026-09-04', time: '14:00', minutes: 18, type: 'Consultation', mode: 'Tele-consultation',
    service: 'Tele-Consultation', serviceNote: 'Recorded Consent #TC-9912', doctorId: 'sarita-nambiar', doctor: 'Dr. Sarita V. Nambiar, MD', doctorShort: 'Dr. Sarita V. Nambiar', specialty: 'General Medicine',
    department: 'Tele-Health Virtual Suite', room: 'Room V-03', branch: 'Central Digital Hub', campus: 'Cloud Tele-OPD', status: 'Completed', encounterId: 'ENC-2026-0610', tariff: 800, audit: [],
  },
  {
    id: 'APT-2026-0488', patientId: PATIENT, date: '2026-08-18', time: '10:00', minutes: 32, type: 'Diagnostic Review', mode: 'In-Person Clinical Consultation',
    service: 'Diagnostic Cardiac Echo & Doppler', serviceNote: 'Order #RAD-88219 (LVEF 58%)', doctorId: 'amitav-ghosh', doctor: 'Dr. Amitav Ghosh, MD', doctorShort: 'Dr. Amitav Ghosh', specialty: 'Radiology & Diagnostics',
    department: 'Non-Invasive Imaging', room: 'Room B-12', ...MAIN, status: 'Completed', encounterId: 'ENC-2026-0488', tariff: 3500, audit: [],
  },
  {
    id: 'APT-2026-0455', patientId: PATIENT, date: '2026-08-07', time: '17:00', minutes: 30, type: 'Consultation', mode: 'In-Person Clinical Consultation',
    service: 'Routine Hypertension Check', serviceNote: 'Patient requested conflict reschedule', doctorId: 'sarita-nambiar', doctor: 'Dr. Sarita V. Nambiar, MD', doctorShort: 'Dr. Sarita V. Nambiar', specialty: 'General Medicine',
    department: 'OPD General Medicine', room: 'Suite 108', branch: 'Banjara Hills Satellite Clinic', campus: 'Banjara Hills Rd 12', status: 'Cancelled', tariff: 800,
    audit: [{ time: '05 Aug', text: 'Cancelled — Patient requested', by: 'Receptionist Priya Nair' }],
  },
  {
    id: 'APT-2026-0312', patientId: PATIENT, date: '2026-07-14', time: '09:30', minutes: 20, type: 'Consultation', mode: 'In-Person Clinical Consultation',
    service: 'Annual Preventive Executive Wellness', serviceNote: 'Package Tier III (Full Screen)', doctorId: 'rajesh-nair', doctor: 'Dr. Rajesh K. Nair, MD', doctorShort: 'Dr. Rajesh K. Nair', specialty: 'Internal Medicine',
    department: 'Preventive Health Suite', room: 'Floor 1 Wing A', ...MAIN, status: 'Completed', encounterId: 'ENC-2026-0312', tariff: 900, audit: [],
  },
]

export const SEED_ENCOUNTERS = [
  {
    id: 'ENC-2026-0894', patientId: PATIENT, appointmentId: 'APT-2026-0894', date: '2026-10-05', time: '11:15', minutes: 28, mode: 'OPD',
    type: 'Routine OPD Consultation', reason: 'Essential Hypertension & Dyslipidemia Review', icd: 'ICD-10: I10, E78.5',
    doctor: 'Dr. Rahul Mehta', credentials: 'MD, DM (Cardiology)', department: 'Cardiology OPD', chamber: 'Suite 302', branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus',
    artifacts: ['1 Rx Issued', 'EHR Signed'], status: 'Signed & Locked',
    complaint: 'Three-month post-procedure review. No exertional angina, no dyspnoea, wound healed.',
    soap: { subjective: 'Patient reports complete resolution of pre-operative exertional angina. Sternal wound healed with clean granulated scar without signs of dehiscence.', objective: 'BP 118/76 mmHg, HR 72 regular. Chest clear. No pedal oedema.', assessment: 'Stable post-CABG recovery. Hypertension controlled on Olmesartan 20 mg.', plan: 'Continue dual antiplatelet therapy. Fasting lipid profile and renal panel before next visit.' },
  },
  { id: 'ENC-2026-0741', patientId: PATIENT, appointmentId: 'APT-2026-0741', date: '2026-09-20', time: '09:00', minutes: 45, mode: 'Procedure', type: 'Pre-Operative PAC Clearance', reason: 'Surgical & Anesthesia Protocol Assessment', icd: 'PAC-Fit Grade II', doctor: 'Dr. Julian Vance', credentials: 'MD, FRCS (Cardiothoracic)', department: 'Cardio-Thoracic Surgery', chamber: 'Suite 401 · OT Block', branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus', artifacts: ['3 Lab Orders', 'PAC Certified'], status: 'Signed & Locked', complaint: 'Pre-operative anaesthesia fitness assessment.', soap: null },
  { id: 'ENC-2026-0610', patientId: PATIENT, appointmentId: 'APT-2026-0610', date: '2026-09-04', time: '16:10', minutes: 18, mode: 'Tele', type: 'Tele-Consultation', reason: 'Remote Lipid Profile Review & Dose Titration (Atorvastatin)', icd: 'Tele-Medicine Compliance Act v2', doctor: 'Dr. Rahul Mehta', credentials: 'MD, DM (Cardiology)', department: 'Tele-Health Virtual Suite', chamber: 'Digital Chamber V-03', branch: 'Central Digital Hub', campus: 'Begumpet Remote Hub', artifacts: ['Digital e-Rx', 'Audio/Video Logged'], status: 'Tele-Completed', complaint: 'Remote review of lipid profile results.', soap: null },
  { id: 'ENC-2026-0488', patientId: PATIENT, appointmentId: 'APT-2026-0488', date: '2026-08-18', time: '14:30', minutes: 32, mode: 'Procedure', type: 'Diagnostic Echo Doppler 2D', reason: 'LVEF Assessment (62% Normal wall motion)', icd: 'Modality: USG-ECHO-CAR', doctor: 'Dr. Sarita V. Nambiar', credentials: 'MD (Radiodiagnosis & Imaging)', department: 'Non-Invasive Imaging', chamber: 'Room B-12', branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus', artifacts: ['DICOM Linked (14)', 'Report Validated'], status: 'Validated', complaint: 'Post-procedure LV function assessment.', soap: null },
  { id: 'ENC-2026-0312', patientId: PATIENT, appointmentId: 'APT-2026-0312', date: '2026-07-14', time: '10:00', minutes: 20, mode: 'OPD', type: 'Preventive Executive Health Checkup', reason: 'Annual Comprehensive & Metabolic Panel', icd: 'ICD-10: Z00.00', doctor: 'Dr. Amitav Ghosh', credentials: 'MD (Internal Medicine)', department: 'Internal Medicine', chamber: 'Suite 108', branch: 'Begumpet Annex', campus: 'Central Clinic', artifacts: ['Comprehensive Panel', 'EHR Archived'], status: 'Signed & Locked', complaint: 'Annual preventive health screen.', soap: null },
  { id: 'ENC-2026-0190', patientId: PATIENT, appointmentId: null, date: '2026-06-22', time: '15:45', minutes: 25, mode: 'OPD', type: 'Post-Surgical Suture Evaluation', reason: 'Sternal wound healing check, clean granulated margins', icd: 'ICD-10: Z48.812', doctor: 'Dr. Rajesh K. Nair', credentials: 'MS, MCh (CTS)', department: 'Cardio-Thoracic Surgery', chamber: 'Suite 403', branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus', artifacts: ['Wound Photo Attached', 'Cleared for Rehab'], status: 'Signed & Locked', complaint: 'Wound healing check.', soap: null },
]

const vital = (id, encounterId, date, time, sys, dia, pulse, extras = {}) => ({
  id, patientId: PATIENT, encounterId, date, time, by: 'Nurse Priya Nair (NUR-4029)', bp: { sys, dia }, pulse, resp: 16, temp: 98.4, spo2: 99,
  weight: 64.2, height: 168, rbs: 108, pain: 0, site: 'Right Arm, Upper Brachial', posture: 'Seated, back supported, 5 min rest verified', device: 'Welch Allyn Connex Spot Monitor', ...extras,
})

export const SEED_VITALS = [
  vital('VIT-0894', 'ENC-2026-0894', '2026-10-05', '11:15', 118, 76, 72),
  vital('VIT-0741', 'ENC-2026-0741', '2026-09-20', '09:20', 132, 84, 78, { temp: 98.2, spo2: 98 }),
  vital('VIT-0488', 'ENC-2026-0488', '2026-08-18', '14:40', 126, 80, 74),
  vital('VIT-0312', 'ENC-2026-0312', '2026-07-14', '10:05', 122, 78, 70, { weight: 65.1 }),
]

export const SEED_DIAGNOSES = [
  { id: 'DX-001', patientId: PATIENT, encounterId: null, name: 'Essential (Primary) Hypertension', icd: 'I10', snomed: '38341003', designation: 'Primary', verification: 'Confirmed', status: 'Active', recorded: '2024-10-14', recordedBy: 'Dr. Rahul Mehta', severity: 'Mild-Mod', description: 'Maintained & controlled on Olmesartan 20mg OD. Systolic consistently tracked within acceptable boundaries (target < 130/80 mmHg).' },
  { id: 'DX-002', patientId: PATIENT, encounterId: null, name: 'Atherosclerotic Heart Disease (Post-CABG)', icd: 'I25.10', snomed: '53741008', designation: 'Primary', verification: 'Confirmed', status: 'Active', recorded: '2026-09-20', recordedBy: 'Dr. Julian Vance', severity: 'Significant / Surgical Followup', description: '3-Month Post-Surgical Followup. Quadruple bypass (LIMA-LAD, SVG-OM1, SVG-OM2, SVG-RCA). Post-op telemetry reveals stable graft perfusion without signs of ischemia.', careStage: 'Phase II Cardiac Rehabilitation' },
  { id: 'DX-003', patientId: PATIENT, encounterId: null, name: 'Laparoscopic Appendectomy', icd: 'Z90.49', snomed: '80146002', designation: 'Secondary', verification: 'Confirmed', status: 'Resolved', recorded: '2018-03-01', recordedBy: 'Apollo Hyderabad', severity: 'Resolved surgical event', description: 'Post-op recovery uneventful.' },
]
