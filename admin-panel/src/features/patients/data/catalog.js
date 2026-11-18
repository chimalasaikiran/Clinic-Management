// Fixed option lists and reference catalogues for the patient, appointment and clinical screens (formulary,
// investigations, priorities). People come from the API: therapists, staff and referral targets.
export const APPOINTMENT_TYPES = ['Consultation', 'Follow-up', 'Procedure', 'Diagnostic Review']

export const BOOKING_SOURCES = ['Reception / In-Person Intake', 'Phone Call', 'Patient Portal', 'Referral Desk']

export const SESSIONS = [
  { id: 'morning', label: 'Morning', range: 'Until 01:00 PM', start: '00:00', end: '13:00' },
  { id: 'afternoon', label: 'Afternoon', range: '01:00 PM – 05:00 PM', start: '13:00', end: '17:00' },
  { id: 'evening', label: 'Evening', range: 'From 05:00 PM', start: '17:00', end: '24:00' },
]

export const CANCEL_REASONS = [
  { id: 'patient', title: 'Patient requested', detail: 'Patient commute or personal schedule shift' },
  { id: 'doctor', title: 'Doctor unavailable / Emergency leave', detail: 'Clinician emergency triage or surgical shift' },
  { id: 'admin', title: 'Clinic administrative / Facility', detail: 'Facility maintenance or room reallocation' },
  { id: 'duplicate', title: 'Duplicate appointment detected', detail: 'Redundant slot booked under same patient ID' },
  { id: 'conflict', title: 'Schedule conflict', detail: 'Overlapping procedure or lab appointment' },
  { id: 'other', title: 'Other non-clinical reason', detail: 'Requires mandatory operational rationale note' },
]

export const NO_SHOW_REASONS = [
  { id: 'no-arrive', title: 'Patient did not arrive (Default)', detail: 'Patient failed to show up during the scheduled 30-min window plus standard clinical grace period.' },
  { id: 'unreachable', title: 'Could not reach patient', detail: 'Reception attempted outbound verification call(s) with no response or voicemail.' },
  { id: 'unconfirmed', title: 'Patient did not confirm', detail: 'Pre-visit 24h & 2h automated WhatsApp/SMS interactive confirmations remained unacknowledged.' },
  { id: 'other', title: 'Other non-arrival reason', detail: 'Custom administrative circumstance requiring detailed log entry below.' },
]

export const RESCHEDULE_REASONS = [
  { id: 'patient', title: 'Patient requested', detail: 'Personal or schedule shift' },
  { id: 'doctor', title: 'Doctor unavailable / Leave', detail: 'Emergency roster update' },
  { id: 'admin', title: 'Clinic administrative', detail: 'Maintenance or room shift' },
  { id: 'triage', title: 'Triage priority conflict', detail: 'Urgent surgical intervention' },
  { id: 'other', title: 'Other non-clinical reason', detail: 'Requires manual notes' },
]

export const ARRIVAL_CHANNELS = ['Physical Presence at Desk 02 (Visual Verification)', 'Kiosk Self Check-in', 'ABHA QR Scan', 'Telephone Confirmation']

// Condition catalogue for the ICD-10 / SNOMED lookup.
export const CONDITIONS = [
  { icd: 'M51.1', snomed: '279039007', name: 'Lumbar disc disorder with radiculopathy' },
  { icd: 'M54.5', snomed: '279039007', name: 'Acute mechanical low back pain with left L5 lumbar radicular irritation' },
  { icd: 'I10', snomed: '38341003', name: 'Essential (primary) hypertension' },
  { icd: 'E78.5', snomed: '370992007', name: 'Dyslipidemia, unspecified' },
  { icd: 'I25.10', snomed: '53741008', name: 'Atherosclerotic heart disease of native coronary artery' },
  { icd: 'E11.9', snomed: '44054006', name: 'Type 2 diabetes mellitus without complications' },
  { icd: 'J45.909', snomed: '195967001', name: 'Unspecified asthma, uncomplicated' },
  { icd: 'R03.0', snomed: '24184005', name: 'Elevated blood pressure reading without diagnosis of hypertension' },
]

// Formulary used by the prescription composer. `drugClass` drives the allergy cross-check.
export const MEDICINES = [
  { id: 'atorvastatin', name: 'Atorvastatin', strengths: ['10 mg', '20 mg', '40 mg'], form: 'Tablet', drugClass: 'statin' },
  { id: 'olmesartan', name: 'Olmesartan Medoxomil', strengths: ['20 mg', '40 mg'], form: 'Tablet', drugClass: 'arb' },
  { id: 'metoprolol', name: 'Metoprolol Tartrate ER', strengths: ['25 mg', '50 mg'], form: 'Tablet', drugClass: 'beta-blocker' },
  { id: 'aspirin', name: 'Aspirin (Ecosprin) EC', strengths: ['75 mg'], form: 'Tablet', drugClass: 'nsaid' },
  { id: 'paracetamol', name: 'Paracetamol', strengths: ['500 mg', '650 mg'], form: 'Tablet', drugClass: 'analgesic' },
  { id: 'naproxen', name: 'Naproxen Sodium', strengths: ['250 mg', '500 mg'], form: 'Tablet', drugClass: 'nsaid' },
  { id: 'pantoprazole', name: 'Pantoprazole Gastro-Resistant', strengths: ['40 mg'], form: 'Tablet', drugClass: 'ppi' },
  { id: 'pregabalin', name: 'Pregabalin', strengths: ['75 mg', '150 mg'], form: 'Capsule', drugClass: 'neuropathic' },
  { id: 'amoxicillin', name: 'Amoxicillin', strengths: ['250 mg', '500 mg'], form: 'Capsule', drugClass: 'penicillin' },
]

export const FREQUENCIES = [
  { id: 'od', label: 'Once daily (1-0-0)', perDay: 1 },
  { id: 'bd', label: 'Twice daily (1-0-1)', perDay: 2 },
  { id: 'tds', label: 'Thrice daily (1-1-1)', perDay: 3 },
  { id: 'hs', label: 'At bedtime (0-0-1)', perDay: 1 },
  { id: 'sos', label: 'SOS (as needed)', perDay: 1 },
]

export const FOOD_RELATIONS = ['Before food', 'After food', 'With food', 'Empty stomach']
export const ROUTES_OF_ADMIN = ['Oral', 'Sublingual', 'Topical']
export const DURATIONS = [3, 5, 7, 10, 14, 30, 90]

export const ORDER_CATALOG = [
  { code: 'RAD-MRI-LUM-01', name: 'MRI Spine - Lumbar Spine with Screening Whole Spine', category: 'Imaging', loinc: '24725-4', destination: 'In-house radiology' },
  { code: 'LAB-INF-PANEL', name: 'Erythrocyte Sedimentation Rate (ESR) & High-Sensitivity C-Reactive Protein (hs-CRP)', category: 'Laboratory', loinc: '30341-2', destination: 'In-house laboratory' },
  { code: 'LAB-LIPID-01', name: 'Fasting Lipid Profile', category: 'Laboratory', loinc: '24331-1', destination: 'In-house laboratory' },
  { code: 'LAB-RFT-01', name: 'Serum Creatinine & eGFR', category: 'Laboratory', loinc: '2160-0', destination: 'In-house laboratory' },
  { code: 'CARD-ECG-12', name: '12-Lead ECG at Rest', category: 'Special Diagnostics', loinc: '11524-6', destination: 'Cardiology diagnostics' },
  { code: 'LAB-HBA1C-01', name: 'Glycated Hemoglobin (HbA1c)', category: 'Laboratory', loinc: '4548-4', destination: 'In-house laboratory' },
]
export const ORDER_CATEGORIES = ['All Enabled', 'Laboratory', 'Imaging', 'Special Diagnostics']
export const ORDER_BUNDLES = [
  { id: 'radiculopathy', label: 'Radiculopathy Workup', codes: ['RAD-MRI-LUM-01', 'LAB-INF-PANEL'] },
  { id: 'diabetic', label: 'Diabetic Profile', codes: ['LAB-HBA1C-01', 'LAB-RFT-01'] },
  { id: 'preop', label: 'Routine Pre-op', codes: ['LAB-LIPID-01', 'CARD-ECG-12'] },
]
export const ORDER_PRIORITIES = ['Routine (Outpatient OPD)', 'Urgent', 'STAT']

export const MESSAGE_PURPOSES = ['Post-Op Follow-up & Symptom Check', 'Appointment Reminder', 'Result Notification', 'Billing Notice']
export const MESSAGE_TEMPLATES = [
  { id: 'postop', purpose: 'Post-Op Follow-up & Symptom Check', label: 'POST_CABG_DAY90_SYMPTOM_SURVEY_EN_HI — DLT #14071688921104', body: "This is an automated follow-up check from {doctor}'s cardiology care team at St. Jude Surgical Health System.\n\nAs you complete your Day 90 Post-CABG milestone, please confirm your recovery status with the clinic.\n\nIf you experience sudden shortness of breath or chest discomfort, contact our 24/7 cardiac desk immediately at 040 2341 8892." },
  { id: 'reminder', purpose: 'Appointment Reminder', label: 'REMIND_APPT_V1 — DLT #14071688233', body: 'Reminder: your appointment with {doctor} is coming up. Please arrive 15 minutes early and carry your recent reports.' },
  { id: 'result', purpose: 'Result Notification', label: 'LAB_ALERT_M2 — DLT #14071688540', body: 'Your diagnostic reports ordered by {doctor} are now available. Please contact the clinic desk to review the findings.' },
  { id: 'billing', purpose: 'Billing Notice', label: 'BILL_NOTICE_V2 — DLT #14071688712', body: 'A payment of the outstanding balance on your account is due. Please contact the billing desk at the clinic for settlement options.' },
]
export const CHANNELS = ['WhatsApp', 'SMS', 'Email']

export const REFERRAL_PRIORITIES = [
  { label: 'Routine (within 2 weeks)', windowHours: 336 },
  { label: 'High / Expedited (48h)', windowHours: 48 },
  { label: 'Urgent / Emergency (same day)', windowHours: 8 },
]
export const REFERRAL_MODELS = ['Specialist Consultation & Opinion', 'Second Opinion', 'Diagnostic Procedure / Intervention', 'Shared Long-term Care Management', 'Transfer of Care']

export const FOLLOW_UP_METHODS = [
  { id: 'phone', title: 'Phone call', detail: 'Direct triage desk' },
  { id: 'hie', title: 'ABDM HIE message', detail: 'Secure clinical ping' },
  { id: 'email', title: 'Clinical email', detail: 'Electronic referral desk' },
  { id: 'other', title: 'Other contact', detail: 'In-person / liaison' },
]
export const FOLLOW_UP_OUTCOMES = [
  { id: 'awaiting', status: 'Pending Acceptance', title: 'Awaiting Clinical Review', detail: 'Receiving consultant or triage committee has received the referral pack but not finalized the decision.' },
  { id: 'accepted', status: 'Accepted', title: 'Acceptance Confirmed', detail: 'Specialist has agreed to intake the patient. Prompts for external booking token / consultation confirmation date.' },
  { id: 'info', status: 'Info Requested', title: 'Additional Information Requested', detail: 'Receiving center requires supplementary diagnostic telemetry, serum electrolytes, or clinical summary.' },
  { id: 'declined', status: 'Declined', title: 'Referral Declined / Capacity Constraint', detail: 'No specialist availability, out of scope, or bed unavailability. Automatically triggers urgent re-route to a secondary panelist.' },
  { id: 'noanswer', status: 'Pending Acceptance', title: 'No Answer / Line Busy', detail: 'Attempt unsuccessful. No verbal or automated connection achieved. Prompts expedited follow-up task.' },
]

export const ALERT_DISPOSITIONS = [
  { id: 'acknowledged', title: 'Clinical Risk Acknowledged — Benefit Outweighs Risk', detail: 'Authorize the action for a brief, defined window with mandatory ambulatory monitoring.' },
  { id: 'modify', title: 'Modify / Substitute Prescribed Therapy', detail: 'Withhold the flagged order and substitute a safer alternative.' },
  { id: 'defer', title: 'Defer to Attending Consultant Review', detail: 'Flag the encounter for senior consultant review before the order proceeds.' },
]

export const ORDER_STEPS = {
  imaging: ['Ordered', 'Completed', 'Result In', 'Review Required', 'Reviewed'],
  lab: ['Ordered', 'Phlebotomy Done', 'In Transit to Analyzer', 'Review', 'Signed'],
}
