// Reference catalogues the patient screens pick from. They stand in for the Configuration module's
// branches, services and staff APIs.
export const FACILITIES = ['Main Surgical Pavilion · Kondapur Branch', 'Kondapur Satellite Clinic', 'Metro North Clinic']
export const REGISTRATION_BRANCHES = ['Main Surgical Pavilion (Kondapur)', 'Kondapur Satellite Clinic', 'Metro North Clinic']

export const DEPARTMENTS = ['Cardiology', 'Cardio-Thoracic Surgery', 'General Medicine', 'Physical Medicine & Rehab', 'Radiology & Diagnostics', 'Internal Medicine']

export const DOCTORS = [
  { id: 'rahul-mehta', name: 'Dr. Rahul Mehta, MD, DM', short: 'Dr. Rahul Mehta', initials: 'RM', department: 'Cardiology', specialty: 'Interventional Cardiology', suite: 'Suite 302 (Wing B)' },
  { id: 'ananya-rao', name: 'Dr. Ananya Rao, MD', short: 'Dr. Ananya Rao', initials: 'AR', department: 'Cardiology', specialty: 'Cardiology', suite: 'Suite 204' },
  { id: 'julian-vance', name: 'Dr. Julian Vance, MD, FRCS', short: 'Dr. Julian Vance', initials: 'JV', department: 'Cardio-Thoracic Surgery', specialty: 'Cardio-Thoracic Surgery', suite: 'Suite 401' },
  { id: 'sarita-nambiar', name: 'Dr. Sarita V. Nambiar, MD', short: 'Dr. Sarita V. Nambiar', initials: 'SN', department: 'General Medicine', specialty: 'General Medicine', suite: 'Suite 108' },
  { id: 'preeti-deshmukh', name: 'Dr. Preeti Deshmukh, BPT', short: 'Dr. Preeti Deshmukh', initials: 'PD', department: 'Physical Medicine & Rehab', specialty: 'Physiotherapy', suite: 'Chamber 104' },
  { id: 'amitav-ghosh', name: 'Dr. Amitav Ghosh, MD', short: 'Dr. Amitav Ghosh', initials: 'AG', department: 'Radiology & Diagnostics', specialty: 'Radiology & Diagnostics', suite: 'Room B-12' },
  { id: 'rajesh-nair', name: 'Dr. Rajesh K. Nair, MD', short: 'Dr. Rajesh K. Nair', initials: 'RN', department: 'Internal Medicine', specialty: 'Internal Medicine', suite: 'Floor 1 Wing A' },
]

export const APPOINTMENT_TYPES = ['Consultation', 'Follow-up', 'Procedure', 'Diagnostic Review']

export const SERVICES = [
  { code: 'SRV-CARD-001', name: 'Cardiology Consultation', department: 'Cardiology', minutes: 30, price: 1500 },
  { code: 'SRV-CARD-004', name: 'Cardio + 2D Echo Screen', department: 'Cardiology', minutes: 45, price: 3200 },
  { code: 'SRV-CARD-009', name: 'Comprehensive Post-CABG Review', department: 'Cardiology', minutes: 45, price: 2800 },
  { code: 'SRV-CTS-001', name: 'Cardio-Thoracic Consultation', department: 'Cardio-Thoracic Surgery', minutes: 30, price: 2200 },
  { code: 'SRV-GM-001', name: 'General Medicine Consultation', department: 'General Medicine', minutes: 30, price: 800 },
  { code: 'SRV-PMR-001', name: 'Rehabilitation Evaluation', department: 'Physical Medicine & Rehab', minutes: 45, price: 1200 },
  { code: 'SRV-RAD-001', name: 'Diagnostic Imaging Review', department: 'Radiology & Diagnostics', minutes: 30, price: 1000 },
  { code: 'SRV-IM-001', name: 'Internal Medicine Consultation', department: 'Internal Medicine', minutes: 30, price: 900 },
]

export const BOOKING_SOURCES = ['Reception / In-Person Intake', 'Phone Call', 'Patient Portal', 'Referral Desk']

export const SESSIONS = [
  { id: 'morning', label: 'Morning', range: '09:00 AM – 01:00 PM', start: '09:00', end: '13:00' },
  { id: 'afternoon', label: 'Afternoon', range: '02:00 PM – 05:00 PM', start: '14:00', end: '17:00' },
  { id: 'evening', label: 'Evening', range: '05:00 PM – 08:30 PM', start: '17:00', end: '20:30' },
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
  { code: 'RAD-MRI-LUM-01', name: 'MRI Spine - Lumbar Spine with Screening Whole Spine', category: 'Imaging', loinc: '24725-4', destination: 'Main In-house Radiology Wing (Suite B-02)' },
  { code: 'LAB-INF-PANEL', name: 'Erythrocyte Sedimentation Rate (ESR) & High-Sensitivity C-Reactive Protein (hs-CRP)', category: 'Laboratory', loinc: '30341-2', destination: 'Central Phlebotomy Unit (Room 102)' },
  { code: 'LAB-LIPID-01', name: 'Fasting Lipid Profile', category: 'Laboratory', loinc: '24331-1', destination: 'St. Jude Pathology Lab · Routine Ambulatory' },
  { code: 'LAB-RFT-01', name: 'Serum Creatinine & eGFR', category: 'Laboratory', loinc: '2160-0', destination: 'St. Jude Pathology Lab · Routine Ambulatory' },
  { code: 'CARD-ECG-12', name: '12-Lead ECG at Rest', category: 'Special Diagnostics', loinc: '11524-6', destination: 'Cardiology Special Diagnostics Suite' },
  { code: 'LAB-HBA1C-01', name: 'Glycated Hemoglobin (HbA1c)', category: 'Laboratory', loinc: '4548-4', destination: 'In-House Endocrinology Lab' },
]
export const ORDER_CATEGORIES = ['All Enabled', 'Laboratory', 'Imaging', 'Special Diagnostics']
export const ORDER_BUNDLES = [
  { id: 'radiculopathy', label: 'Radiculopathy Workup', codes: ['RAD-MRI-LUM-01', 'LAB-INF-PANEL'] },
  { id: 'diabetic', label: 'Diabetic Profile', codes: ['LAB-HBA1C-01', 'LAB-RFT-01'] },
  { id: 'preop', label: 'Routine Pre-op', codes: ['LAB-LIPID-01', 'CARD-ECG-12'] },
]
export const ORDER_PRIORITIES = ['Routine (Outpatient OPD)', 'Urgent', 'STAT']

export const CHARGE_CATALOG = [
  { code: 'SVC-CRD-001', name: 'Outpatient Cardiology Consult', note: 'SAC 999312 · Cardiology OPD', price: 1500, gstPct: 0, discountPct: 0, type: 'service' },
  { code: 'RAD-ECHO-004', name: '2D Echocardiography Doppler', note: 'SAC 999315 · Imaging & Diagnostics', price: 3500, gstPct: 0, discountPct: 0, type: 'service' },
  { code: 'SVC-ECG-002', name: 'Resting 12-Lead ECG', note: 'SAC 999315 · Special Diagnostics', price: 600, gstPct: 0, discountPct: 0, type: 'service' },
  { code: 'MED-SUP-201', name: 'ECG Sterile Electrodes & Gel Kit', note: 'HSN 9018 · Consumable Supply', price: 450, gstPct: 12, discountPct: 10, type: 'consumable' },
  { code: 'MED-SUP-114', name: 'Disposable Syringe Pack (5)', note: 'HSN 9018 · Consumable Supply', price: 120, gstPct: 12, discountPct: 0, type: 'consumable' },
]

export const PAYMENT_CHANNELS = ['UPI / QR', 'Cash Desk', 'Card / POS', 'NEFT / IMPS', 'Cheque / DD']
export const REFUND_REASONS = ['Service Cancelled / Not Rendered', 'Duplicate Payment', 'Overcharge Correction', 'Insurance Settlement Adjustment']

export const MESSAGE_PURPOSES = ['Post-Op Follow-up & Symptom Check', 'Appointment Reminder', 'Result Notification', 'Billing Notice']
export const MESSAGE_TEMPLATES = [
  { id: 'postop', purpose: 'Post-Op Follow-up & Symptom Check', label: 'POST_CABG_DAY90_SYMPTOM_SURVEY_EN_HI — DLT #14071688921104', body: "This is an automated follow-up check from {doctor}'s cardiology care team at St. Jude Surgical Health System.\n\nAs you complete your Day 90 Post-CABG milestone, please confirm your recovery status with the clinic.\n\nIf you experience sudden shortness of breath or chest discomfort, contact our 24/7 cardiac desk immediately at 040 2341 8892." },
  { id: 'reminder', purpose: 'Appointment Reminder', label: 'REMIND_APPT_V1 — DLT #14071688233', body: 'Reminder: your appointment with {doctor} is coming up. Please arrive 15 minutes early and carry your recent reports.' },
  { id: 'result', purpose: 'Result Notification', label: 'LAB_ALERT_M2 — DLT #14071688540', body: 'Your diagnostic reports ordered by {doctor} are now available. Please contact the clinic desk to review the findings.' },
  { id: 'billing', purpose: 'Billing Notice', label: 'BILL_NOTICE_V2 — DLT #14071688712', body: 'A payment of the outstanding balance on your account is due. Please contact the billing desk at the clinic for settlement options.' },
]
export const CHANNELS = ['WhatsApp', 'SMS', 'Email']

export const REFERRAL_TARGETS = [
  { id: 'rahul-mehta', group: 'Internal ClinicOS network', name: 'Dr. Rahul Mehta, MD, DM', specialty: 'Interventional Cardiology', facility: 'Main Surgical Pavilion — Advanced Cardiac Suite', clinicianNote: 'Cardiology · Kondapur' },
  { id: 'julian-vance', group: 'Internal ClinicOS network', name: 'Dr. Julian Vance, MD, FRCS', specialty: 'Cardio-Thoracic Surgery', facility: 'Main Surgical Pavilion — Surgical Suite 401', clinicianNote: 'Cardio-Thoracic Surgery' },
  { id: 'preeti-deshmukh', group: 'Internal ClinicOS network', name: 'Dr. Preeti Deshmukh, BPT', specialty: 'Physiotherapy & Rehab', facility: 'Kondapur Rehab Suite', clinicianNote: 'Physical Medicine & Rehab' },
  { id: 'city-heart', group: 'External verified facility', name: 'Dr. K. S. Someshwar', specialty: 'Cardiac Electrophysiology', facility: 'City Heart Centre — Advanced Arrhythmia Suite', clinicianNote: 'Senior Interventional Electrophysiologist' },
  { id: 'mohan-eye', group: 'External verified facility', name: "Dr. Mohan's Eye Centre", specialty: 'Retina & Vitreous', facility: "Dr. Mohan's Eye Centre", clinicianNote: 'Retina & Vitreous Clinic' },
]

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
