// Sample clinical records for PT-000184: safety alerts, allergies, notes, care plan, prescriptions, orders and referrals.
const PATIENT = 'pt-000184'

export const SEED_ALERTS = [
  {
    id: 'ALT-88102', patientId: PATIENT, kind: 'ALLERGY: PENICILLIN', title: 'Penicillin allergy — anaphylactoid reaction', severity: 'Critical', status: 'Active',
    detail: 'Severe anaphylactoid wheals / dyspnea recorded by Dr. Julian Vance.',
    statement: 'A documented severe penicillin reaction blocks any beta-lactam order. Prescription and order entry are interlocked until a clinician acknowledges this alert.',
    evidence: [
      { label: 'Allergy record', detail: 'ALL-04281-01 · Penicillin · Severe (Grade 3)' },
      { label: 'Source clinician', detail: 'Dr. Julian Vance (Chief Medical Proprietor), recorded 14 Oct 2024' },
      { label: 'Verification', detail: 'Specialist in-vivo verified' },
    ],
    audit: [{ time: '14 Oct 2024', text: 'Allergy documented', by: 'Dr. Julian Vance' }],
  },
  {
    id: 'ALT-88103', patientId: PATIENT, orderId: 'ORD-2026-1184', kind: 'PENDING DIAGNOSTIC', title: 'Post-op 2D echo awaiting clinician review', severity: 'High', status: 'Active',
    detail: 'Post-op 2D echo Doppler (LVEF 58%) awaiting attending review & clearance.',
    statement: 'A resulted diagnostic is waiting for sign-off. Review the report in Orders & Results to clear this flag.',
    evidence: [{ label: 'Order', detail: 'ORD-2026-1184 · 2D Echocardiogram with Color Doppler · Result received' }],
    audit: [],
  },
  {
    id: 'ALT-88104', patientId: PATIENT, kind: 'CLINICAL FLAG: FALL RISK', title: 'Fall risk — Grade II active', severity: 'Moderate', status: 'Active',
    detail: 'Protocol Grade II active during current 3-month post-CABG recovery trajectory.',
    statement: 'Fall-risk precautions apply during the post-CABG recovery window and are reviewed at each visit.',
    evidence: [{ label: 'Care plan', detail: 'Post-CABG Cardiovascular Rehabilitation & Secondary Prevention' }],
    audit: [],
  },
]

export const ALERT_DISPOSITIONS = [
  { id: 'acknowledged', title: 'Clinical Risk Acknowledged — Benefit Outweighs Risk', detail: 'Authorize the action for a brief, defined window with mandatory ambulatory monitoring.' },
  { id: 'modify', title: 'Modify / Substitute Prescribed Therapy', detail: 'Withhold the flagged order and substitute a safer alternative.' },
  { id: 'defer', title: 'Defer to Attending Consultant Review', detail: 'Flag the encounter for senior consultant review before the order proceeds.' },
]

export const SEED_ALLERGIES = [
  {
    id: 'ALL-04281-01', patientId: PATIENT, name: 'Penicillin', drugClass: 'penicillin', classLabel: 'Beta-lactam Antibiotic', severity: 'Severe', status: 'Clinical: Active',
    reaction: 'Anaphylactoid Wheals / Dyspnea', recorded: '14 Oct 2024', verification: 'Verified',
    substance: 'Amoxicillin Trihydrate', exposure: 'Approx. 45 min post-ingestion',
    reactions: [
      { title: 'Acute Angioedema', detail: 'Marked facial and periorbital edema with breathing compromise.' },
      { title: 'Generalized Urticaria', detail: 'Severe pruritic wheals spreading across trunk and limbs.' },
      { title: 'Wheezing & Stridor', detail: 'Grade 3 anaphylactoid wheeze requiring intramuscular adrenaline.' },
    ],
    crossReactivity: 'Direct cross-reactive agents (prohibited): Ampicillin, Penicillin G / V, Piperacillin-Tazobactam, Amoxicillin-Clavulanic Acid. Cephalosporins: 1st and 2nd generation carry approx. 2% to 5% cross-reactivity risk — contraindicated without supervised challenge.',
    provenance: [
      { label: 'Documenting clinician', value: 'Dr. Arvind Swaminathan, MD (Consultant Allergist & Immunologist)' },
      { label: 'Facility', value: 'Manipal Comprehensive Allergy Care Hub' },
      { label: 'Verification mode', value: 'In-vivo intradermal & serum IgE — Skin Prick Test positive (wheal 12 mm)' },
    ],
    evidence: 'Skin Prick Test (SPT) + Penicillin IgE Summary Report.pdf',
    audit: [
      { time: '08 Oct 2026, 10:20 IST', text: 'Triage inpatient re-verification', by: 'Dr. Ananya Rao, MD' },
      { time: '14 Mar 2025', text: 'ABHA national locker synchronized', by: 'Federated ABDM gateway' },
      { time: '14 Mar 2024', text: 'Initial specialist documentation', by: 'Dr. Arvind Swaminathan' },
    ],
  },
  {
    id: 'ALL-04281-02', patientId: PATIENT, name: 'NSAIDs (Ibuprofen / Naproxen)', drugClass: 'nsaid', classLabel: 'Analgesic / Anti-inflammatory', severity: 'Moderate', status: 'Clinical: Active',
    reaction: 'Severe Gastric Mucosal Bleed Risk', recorded: '20 Sep 2026', verification: 'Post-Surg',
    substance: 'Naproxen / Ibuprofen', exposure: 'Post-operative day 3',
    reactions: [{ title: 'Gastric mucosal bleed', detail: 'Upper GI bleed on post-operative NSAID cover; resolved with PPI therapy.' }],
    crossReactivity: 'Avoid all non-selective NSAIDs. Low-dose aspirin is continued under PPI cover by the treating cardiologist.',
    provenance: [{ label: 'Documenting clinician', value: 'Dr. Julian Vance (Cardio-Thoracic Surgery)' }, { label: 'Facility', value: 'Main Surgical Pavilion' }],
    evidence: null,
    audit: [{ time: '20 Sep 2026', text: 'Documented after post-operative GI bleed', by: 'Dr. Julian Vance' }],
  },
]

export const SEED_NOTES = [
  {
    id: 'NOTE-0894', patientId: PATIENT, encounterId: 'ENC-2026-0894', title: 'Post-CABG 3-Month Outpatient Review', author: 'Dr. Rahul Mehta, MD, DM', department: 'Cardiology OPD, Kondapur',
    date: '2026-10-05', status: 'Signed & ABDM Synced', quote: 'Patient reports complete resolution of pre-operative exertional angina. Sternal wound healed with clean granulated scar without signs of dehiscence. BP today 122/78 mmHg.',
    hash: '9a8c...4b12 · FHIR DocumentReference',
    sections: [
      { heading: 'Chief complaint', body: 'Three-month post-CABG follow-up. No chest pain on exertion.' },
      { heading: 'Findings', body: 'BP 118/76 mmHg, HR 72 regular. Cardiovascular exam normal. Sternal wound healed.' },
      { heading: 'Assessment', body: 'Stable post-CABG recovery; hypertension controlled.' },
      { heading: 'Plan', body: 'Continue dual antiplatelet therapy (DAPT) without bleeding diathesis. Repeat fasting lipid profile and renal panel before next visit.' },
    ],
    addenda: [],
  },
  {
    id: 'NOTE-0488', patientId: PATIENT, encounterId: 'ENC-2026-0488', title: 'Diagnostic Ultrasound & Echo Doppler Note', author: 'Dr. Sarita V. Nambiar, MD', department: 'Department of Imaging',
    date: '2026-08-18', status: 'Signed & Archived', quote: 'Normal LV cavity dimensions. Regional wall motion abnormality in basal inferolateral segment consistent with pre-CABG infarct scar. Overall LVEF preserved at 58%.',
    hash: 'RAD-ECHO-2026-441 · DICOM Ref',
    sections: [
      { heading: 'Findings', body: 'Normal LV cavity dimensions. Regional wall motion abnormality in basal inferolateral segment consistent with pre-CABG infarct scar.' },
      { heading: 'Impression', body: 'Overall LVEF preserved at 58%. No pericardial effusion.' },
    ],
    addenda: [],
  },
]

export const SEED_CARE_PLANS = [
  {
    id: 'CP-2026-CABG', patientId: PATIENT, category: 'Secondary Prevention & Cardiac Rehab', title: 'Post-CABG Cardiovascular Rehabilitation & Secondary Prevention', updated: '2026-10-05', updatedBy: 'Dr. Rahul Mehta', status: 'On Track', compliance: 72,
    lead: 'Dr. Rahul Mehta', timeline: '05 Oct 2026 – 05 Jan 2027', nextReview: '2026-10-19',
    milestones: [
      { no: '01', title: 'Cardiac Rehab METs', detail: 'Phase II exercise tolerance target: 5 METs on treadmill protocol.' },
      { no: '02', title: 'Lipid Spectrum Target', detail: 'Stringent secondary prevention target: LDL < 55 mg/dL (Current 68 mg/dL).' },
      { no: '03', title: 'Renal & Hepatic Panel', detail: 'Monthly serum creatinine & eGFR tracking due to RAAS inhibition.' },
    ],
    interventions: [
      { title: 'Supervised cardiac rehabilitation', detail: 'Twice weekly, 6 weeks, with Dr. Preeti Deshmukh', state: 'Scheduled' },
      { title: 'Statin intensification', detail: 'Atorvastatin 40 mg nightly with lipid review in 6 weeks', state: 'In progress' },
      { title: 'Renal function surveillance', detail: 'Monthly creatinine and eGFR', state: 'Instructed' },
    ],
    progress: [{ time: '05 Oct 2026', title: 'Plan reviewed at 3-month visit', detail: 'Compliance recorded at 72% of milestones.' }],
  },
]

const rxItem = (id, name, strength, extra) => ({ id, name, strength, form: 'Tablet', route: 'Oral', ...extra })

export const SEED_PRESCRIPTIONS = [
  {
    id: 'RX-2026-0894-A', patientId: PATIENT, encounterId: 'ENC-2026-0894', date: '2026-10-05', time: '11:40', prescriber: 'Dr. Rahul Mehta', department: 'Cardiology (OPD)', registration: 'NMC #61820', branch: 'Main Surgical Pavilion',
    indication: 'Post-CABG secondary prevention and blood pressure control', status: 'Active', dispensing: 'Partially Dispensed (1 Pending)', hash: 'sha256:7f3b09c0201a4e12a3f890c918a2',
    items: [
      rxItem('i1', 'Atorvastatin Tablets', '40 mg', { drugClass: 'Lipid Lowering · HMG-CoA Reductase Inhibitor', frequency: 'Once Daily', frequencyNote: 'At Bedtime (Post-dinner)', durationDays: 90, quantity: 90, refills: 2, indication: 'Post-CABG Secondary Prevention & Plaque Stabilization', dispensing: { state: 'Dispensed', note: 'Kondapur In-House Pharmacy · Batch #AT-9921 (Exp: 08/2028)' } }),
      rxItem('i2', 'Olmesartan Medoxomil', '20 mg', { drugClass: 'Angiotensin II Receptor Blocker (ARB)', frequency: 'Once Daily', frequencyNote: 'Morning, with food', durationDays: 60, quantity: 60, refills: 1, indication: 'Post-CABG Blood Pressure Management & Afterload Reduction', dispensing: { state: 'Dispensed', note: 'Kondapur Main Pharmacy · Slip #DISP-4089' } }),
      rxItem('i3', 'Metoprolol Tartrate ER (Succinate)', '25 mg', { drugClass: 'Selective Beta-1 Adrenoceptor Blocker', frequency: 'Twice Daily', frequencyNote: 'Morning & Night (12 hrs interval)', durationDays: 30, quantity: 60, refills: 0, indication: 'Rate Control & Prevention of Post-Surgical Tachyarrhythmias', dispensing: { state: 'Pending Pickup', note: 'Kondapur Outpatient Pharmacy · Slip #DISP-4102 (Wing B Counter 3)' } }),
    ],
    events: [
      { time: '11:43 AM', title: 'Prescription draft created', actor: 'Dr. Rahul Mehta', note: 'Linked to ENC-2026-0894.' },
      { time: '11:48 AM', title: 'Prescription finalized & digitally signed', actor: 'Dr. Rahul Mehta (NMC #61820)', note: 'Class 3 DSC signature applied.' },
      { time: '11:49 AM', title: 'Transmitted to dispensing pharmacy', actor: 'ClinicOS FHIR Bridge', note: 'Encrypted FHIR R4 bundle.' },
      { time: '12:10 PM', title: 'Pharmacy acknowledged & partially dispensed', actor: 'Pharmacist K. Ramesh', note: '2 of 3 lines dispensed; Metoprolol awaiting pickup.' },
    ],
  },
  { id: 'RX-2026-0741-C', patientId: PATIENT, encounterId: 'ENC-2026-0741', date: '2026-09-20', time: '10:15', prescriber: 'Dr. Julian Vance', department: 'Cardio Surgery', registration: 'NMC #58213', branch: 'Main Surgical Pavilion', indication: 'Antiplatelet and statin continuation', status: 'Active', dispensing: 'Dispensed', hash: 'sha256:2c91a0d34b6e19f05d7a', items: [rxItem('i1', 'Aspirin (Ecosprin) Enteric Coated', '75 mg', { drugClass: 'Antiplatelet Agent · Cyclooxygenase-1 Inhibitor', frequency: 'Once Daily', frequencyNote: 'After lunch (Postprandial)', durationDays: 90, quantity: 90, refills: 2, indication: 'Graft Patency Protection & Antiplatelet Maintenance', dispensing: { state: 'Dispensed', note: 'Dispensed at PAC / Discharge · Refill batch queued' } })], events: [{ time: '10:20 AM', title: 'Prescription finalized & digitally signed', actor: 'Dr. Julian Vance', note: '' }] },
  { id: 'RX-2026-0488-B', patientId: PATIENT, encounterId: 'ENC-2026-0488', date: '2026-08-18', time: '14:50', prescriber: 'Dr. Sarita V. Nambiar', department: 'Imaging / OPD', registration: 'NMC #70112', branch: 'Main Surgical Pavilion', indication: 'Gastroprotective cover', status: 'Completed', dispensing: 'Fully Dispensed', hash: 'sha256:8be2f1c7740d3a96e1b0', items: [rxItem('i1', 'Pantoprazole', '40 mg', { frequency: 'Once Daily', frequencyNote: 'Before breakfast', durationDays: 7, quantity: 7, refills: 0, indication: 'Gastroprotective cover', dispensing: { state: 'Dispensed', note: 'Dispensed' } })], events: [] },
  { id: 'RX-2026-0312-A', patientId: PATIENT, encounterId: 'ENC-2026-0312', date: '2026-07-14', time: '10:20', prescriber: 'Dr. Amitav Ghosh', department: 'Internal Medicine', registration: 'NMC #66420', branch: 'Begumpet Annex', indication: 'Blood pressure control', status: 'Discontinued (Replaced)', dispensing: 'Dispensed', hash: 'sha256:4d7a09b1e2c36f85a1d0', replacedNote: 'Switched to Olmesartan due to mild intolerance', items: [rxItem('i1', 'Telmisartan', '40 mg', { frequency: 'Once Daily', frequencyNote: 'Morning', durationDays: 30, quantity: 30, refills: 0, indication: 'Blood pressure control', dispensing: { state: 'Dispensed', note: 'Dispensed' } })], events: [] },
  { id: 'RX-2026-0190-D', patientId: PATIENT, encounterId: 'ENC-2026-0190', date: '2026-06-22', time: '16:05', prescriber: 'Dr. Rajesh K. Nair', department: 'Cardiothoracic (CTS)', registration: 'NMC #61102', branch: 'Main Surgical Pavilion', indication: 'Post-op prophylaxis', status: 'Completed', dispensing: 'Fully Dispensed', hash: 'sha256:19c3e7a0d5f2b8641c90', items: [rxItem('i1', 'Cefuroxime Axetil', '500 mg', { frequency: 'Twice Daily', frequencyNote: 'After food', durationDays: 10, quantity: 20, refills: 0, indication: 'Post-op prophylaxis', dispensing: { state: 'Dispensed', note: 'Dispensed' } })], events: [] },
]

export const ORDER_STEPS = {
  imaging: ['Ordered', 'Completed', 'Result In', 'Review Required', 'Reviewed'],
  lab: ['Ordered', 'Phlebotomy Done', 'In Transit to Analyzer', 'Review', 'Signed'],
}

export const SEED_ORDERS = [
  {
    id: 'ORD-2026-1184', patientId: PATIENT, encounterId: 'ENC-2026-0894', date: '2026-10-12', time: '08:30', title: '2D Echocardiogram with Color Doppler', category: 'Cardiovascular Imaging', kind: 'imaging', status: 'Awaiting Review', stage: 3,
    ordering: 'Dr. Rahul Mehta, MD, DM (Cardiology OPD)', performing: 'St. Jude In-House Diagnostic Imaging Pavilion', performingNote: 'Wing B, Ultrasound Suite 4 (Operator: Dr. Sarita V. Nambiar)', reference: '1.2.840.113619.2.417.1029.20261012',
    findings: { headline: 'Abnormal Wall Motion (Monitored)', text: 'LVEF 58% (Reference normal >55%). Mild basal inferolateral wall hypokinesis consistent with prior CABG surgical revascularization. Normal diastolic filling pattern. No pericardial effusion or aortic root regurgitation.', range: 'LVEF 55–70%', baseline: 'Prior Aug Baseline: 55% (+3% trend)' },
    document: { name: 'Echo_Doppler_Sharma_Final.pdf', meta: '2.4 MB · Digital Signature Validated' },
  },
  {
    id: 'ORD-2026-1142', patientId: PATIENT, encounterId: 'ENC-2026-0894', date: '2026-10-12', time: '07:45', title: 'Comprehensive Lipid Profile + High-Sensitivity CRP (hs-CRP)', category: 'Clinical Biochemistry', kind: 'lab', status: 'Processing', stage: 1,
    ordering: 'Dr. Rahul Mehta, MD, DM', performing: 'Metropolis Healthcare Central Lab Hub', performingNote: 'Partner API Integration: #MTR-9941',
    specimen: {
      accession: 'SPEC-8829104', note: 'Venous blood specimen drew at 07:50 AM IST by Phlebotomist K. Sunitha. Barcode scanned into cold-chain logistic container #METRO-COLD-08. Temperature logged at 4.2°C.', turnaround: 'Today by 04:30 PM IST',
      container: 'Gold SST Vaticutainer (5 mL) · Serum with gel clot activator', tests: ['Lipid Profile, Comprehensive', 'High-Sensitivity CRP'], phlebotomist: 'K. Sunitha', temperature: '4.2°C Ambient (OK)', destination: 'Metropolis Core Pathology & Biochemistry Lab',
      events: [
        { time: '07:50 AM', title: 'Event 03 · Specimen collected & labelled', detail: 'Venipuncture performed at the right antecubital fossa. Patient identity verified by wristband barcode and ABHA OTP match.' },
        { time: '07:52 AM', title: 'Event 04 · Dispatched in transit', detail: 'Specimen bagged in a sealed biohazard pouch and handed to the logistics runner for delivery to the core lab.' },
      ],
    },
  },
  {
    id: 'ORD-2026-0891', patientId: PATIENT, encounterId: 'ENC-2026-0741', date: '2026-09-20', time: '11:15', title: 'Pre-Operative Coagulation Profile (PT/INR, aPTT, Fibrinogen)', category: 'Hematology & Coagulation', kind: 'lab', status: 'Completed & Signed', stage: 4,
    ordering: 'Dr. Julian Vance, MD, FRCS', performing: 'In-House Pathology Core (Analyzer Sysmex CS-2500)', reviewedBy: 'Dr. Julian Vance, MD, FRCS', reviewedAt: '20 Sep 2026 at 02:40 PM IST',
    summary: 'PT/INR: 1.08 (0.9–1.2) · aPTT: 28.4 sec (25–35) · Platelets: 245 × 10^3/uL', summaryTone: 'All Values Normal Range',
    analytes: [
      { name: 'PT / INR', value: '1.08', unit: '', range: '0.9 – 1.2', flag: 'Normal' },
      { name: 'aPTT', value: '28.4', unit: 'sec', range: '25 – 35', flag: 'Normal' },
      { name: 'Fibrinogen', value: '310', unit: 'mg/dL', range: '200 – 400', flag: 'Normal' },
      { name: 'Platelets', value: '245', unit: '10^3/uL', range: '150 – 450', flag: 'Normal' },
    ],
  },
  { id: 'ORD-2026-0612', patientId: PATIENT, encounterId: 'ENC-2026-0488', date: '2026-08-18', time: '14:15', title: 'Post-CABG Baseline 2D Echo Doppler', category: 'Cardiovascular Imaging', kind: 'imaging', status: 'Completed & Reviewed', stage: 4, ordering: 'Dr. Sarita V. Nambiar, MD', performing: 'Diagnostic Imaging Pavilion', reviewedBy: 'Dr. Rahul Mehta, MD, DM', reviewedAt: '19 Aug 2026', summary: 'LVEF 55% · Post-revascularization baseline recorded · No valve regurgitation · Trace pericardial effusion noted resolving.', summaryTone: 'Baseline findings' },
  { id: 'ORD-2026-0310', patientId: PATIENT, encounterId: 'ENC-2026-0312', date: '2026-07-14', time: '10:00', title: 'Glycated Hemoglobin (HbA1c) & Fasting Plasma Glucose', category: 'Biochemistry', kind: 'lab', status: 'Completed & Reviewed', stage: 4, ordering: 'Dr. Amitav Ghosh, MD', performing: 'In-House Endocrinology Lab', reviewedBy: 'Dr. Amitav Ghosh, MD', reviewedAt: '14 Jul 2026', summary: 'HbA1c: 5.6% (Non-diabetic reference <5.7%) · Fasting Glucose: 94 mg/dL (Normal 70–99).', summaryTone: 'All Values Normal Range' },
]

export const SEED_REFERRALS = [
  {
    id: 'REF-2026-084', patientId: PATIENT, date: '2026-10-04', time: '14:10', specialty: 'Cardiac Electrophysiology', indication: 'Post-CABG asymptomatic NSVT runs on Holter telemetry', direction: 'Outgoing',
    clinician: 'Dr. Rahul Mehta, MD', clinicianNote: 'Cardiology · Kondapur', facility: 'City Heart Centre', facilityNote: 'Dr. K. S. Someshwar (EP)', status: 'Pending Acceptance', priority: 'High / Expedited (48h)',
    outcome: 'No appointment scheduled yet', sla: { windowHours: 48, elapsedHours: 54 },
    clinicalIndication: 'Post-CABG Day 90 Holter telemetry non-sustained ventricular tachycardia (NSVT) runs (Asymptomatic 6-beat bursts, HR 142 bpm). Urgent electrophysiology mapping & ablation assessment requested.',
    attachments: 4,
    log: [
      { time: '12 Oct 2026, 17:15 IST', title: 'HIE Direct Ping', text: 'Automated system ping ACK-200 received from receiving gateway. Referral package validated in destination triage buffer; no manual consultant acceptance yet.' },
      { time: '12 Oct 2026, 11:36 IST', title: 'Telephonic Outreach', text: 'Liaison Staff Priya Nair dialed City Heart Centre Arrhythmia Suite. Reception confirmed receipt of ABDM bundle.' },
    ],
  },
  { id: 'REF-2026-079', patientId: PATIENT, date: '2026-09-28', time: '11:30', specialty: 'Supervised Cardiac Rehab', indication: 'Structured exercise conditioning', direction: 'Outgoing', clinician: 'Dr. Rahul Mehta, MD', clinicianNote: 'Cardiology · Kondapur', facility: 'Kondapur Rehab Suite', facilityNote: 'Physiotherapy & Rehab', status: 'Scheduled', outcome: '12 Oct 2026 · 10:30 AM', outcomeNote: 'Phase II Protocol Verified', clinicalIndication: 'Phase II supervised cardiac rehabilitation after CABG.', attachments: 2, log: [] },
  { id: 'REF-2026-062', patientId: PATIENT, date: '2026-09-15', time: '09:15', specialty: 'Pulmonary Function Test', indication: 'Spirometry post-op clearance baseline', direction: 'Outgoing', clinician: 'Dr. Rahul Mehta, MD', clinicianNote: 'Cardiology · Kondapur', facility: 'St. Jude Diagnostic', facilityNote: 'Pulmonology Wing', status: 'Completed', outcome: 'FEV1/FVC Normal (82%)', outcomeNote: 'Post-Op Clearance Issued', clinicalIndication: 'Post-op spirometry for clearance.', attachments: 1, log: [] },
  { id: 'REF-2026-051', patientId: PATIENT, date: '2026-08-02', time: '16:45', specialty: 'Diabetic Retinopathy Screen', indication: 'Annual fundus photo and OCT macula', direction: 'Outgoing', clinician: 'Dr. Julian Vance, MD', clinicianNote: 'Internal Medicine', facility: "Dr. Mohan's Eye Centre", facilityNote: 'Retina & Vitreous Clinic', status: 'Completed', outcome: 'Mild Non-Proliferative NPDR', outcomeNote: 'No edema · Follow-up in 12m', clinicalIndication: 'Annual retinopathy screen.', attachments: 1, log: [] },
  { id: 'REF-2026-038', patientId: PATIENT, date: '2026-07-14', time: '10:00', specialty: 'Pre-CABG Second Opinion', indication: 'Coronary angiogram review prior to...', direction: 'Incoming', clinician: 'Dr. Suresh K. Reddy', clinicianNote: 'Apollo Health City', facility: 'Main Pavilion', facilityNote: 'Dr. Rahul Mehta (Cardiology)', status: 'Closed', outcome: 'Consultation completed', outcomeNote: 'Admitted for CABG', clinicalIndication: 'Second opinion for CABG candidacy.', attachments: 2, log: [] },
  { id: 'REF-2026-019', patientId: PATIENT, date: '2026-05-10', time: '15:20', specialty: 'Cardiac Dietetics Consult', indication: 'Post-revascularization macronutrient and...', direction: 'Outgoing', clinician: 'Dr. Rahul Mehta, MD', clinicianNote: 'Cardiology · Kondapur', facility: 'Dietetics Unit', facilityNote: 'Ms. Rashmi Nair, RD', status: 'Completed', outcome: '1,600 kcal Diet Plan', outcomeNote: 'Low sodium protocol active', clinicalIndication: 'Post-revascularization dietary plan.', attachments: 1, log: [] },
  {
    id: 'IN-REF-2026-192', patientId: PATIENT, date: '2026-10-13', time: '09:40', specialty: 'Surgical Oncology · Breast Clinic', indication: 'Stage IIIA invasive ductal carcinoma — surgical resection consult', direction: 'Incoming',
    clinician: 'Dr. Meera Kulkarni, MS', clinicianNote: 'Apex Cancer Institute, Banjara Hills', facility: 'St. Jude Main Surgical Pavilion', facilityNote: 'Breast Oncology', status: 'Awaiting Review', priority: 'Urgent — Fast-Track 24h',
    outcome: 'Awaiting clinical triage', sla: { windowHours: 24, elapsedHours: 2 },
    clinicalIndication: 'Patient has completed 6 cycles of neoadjuvant AC-T chemotherapy with substantial objective tumor shrinkage. Referred urgently for definitive post-chemo surgical resection and evaluation for immediate oncoplastic tissue rearrangement.',
    attachments: 3, checklist: ['Patient identity matched & validated', 'Referring provider credentials verified', 'Specialty & target surgical scope confirmed', 'Core diagnostic biopsy and restaging imaging reviewed', 'Operating chamber & admission timing staged (optional)'], log: [],
  },
]
