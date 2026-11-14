// The attending clinician whose queue "My Clinical Work" shows in this prototype.
export const ATTENDING = { id: 'rahul-mehta', name: 'Dr. Rahul Mehta, MD, DM' }

// What each simulated access scope may do. Owner access alone never grants clinical sign-off.
export const ROLE_SCOPES = [
  { id: 'dual', label: 'Doctor + Owner (Dual Scope)', sign: true, triage: true },
  { id: 'owner', label: 'Owner Only (Management Scope)', sign: false, triage: false },
  { id: 'attending', label: 'Attending Clinician', sign: true, triage: true },
  { id: 'nurse', label: 'Clinical Nurse / Triage', sign: false, triage: true },
]

export const CARE_CATEGORIES = ['Secondary Prevention & Cardiac Rehab', 'Chronic Disease Management', 'Post-Operative Recovery', 'Maternal & Child Health']
export const GOAL_CADENCES = ['Every 30 Days', 'Quarterly (90 Days)', 'Weekly Telemetry Aggregation']
export const INTERVENTION_TYPES = [
  { id: 'follow-up', label: 'Clinical follow-up', tone: 'info' },
  { id: 'medication', label: 'Medication review', tone: 'brand' },
  { id: 'diagnostic', label: 'Diagnostic monitoring', tone: 'warning' },
  { id: 'lifestyle', label: 'Lifestyle & rehab', tone: 'success' },
]
export const DEFAULT_RED_FLAGS = [
  'Sudden onset or radiating retrosternal chest tightness / pain unrelieved by rest.',
  'Resting dyspnea, orthopnea, or respiratory distress exceeding baseline.',
  'Sudden bilateral lower limb edema or acute weight increase (>1.5 kg over 48 hours).',
  'Persistent fever above 38°C or localized sternotomy erythema / purulence.',
].join('\n')

export const GOAL_STATUSES = ['Improving / On Target', 'Unchanged', 'Worsening', 'Achieved', 'Unable to Assess']
export const ADHERENCE_STATUSES = ['Completed', 'Partially Completed', 'Not Completed']
export const BARRIERS = ['Mild financial hesitation on brand-name statins', 'Occasional night-shift sleep disruption', 'Transportation barrier to Physio Centre', 'Dietary salt restriction fatigue']
export const NEXT_STEPS = ['Maintain Current Protocol & Monitor', 'Adjust Medication Regimen', 'Schedule Early Review Visit', 'Refer to Specialist']

export const INCIDENT_CATEGORIES = [
  { id: 'medication', label: 'Medication / Prescription Error', hint: 'Wrong drug, dosage, allergy interaction, look-alike sound-alike (LASA)' },
  { id: 'procedure', label: 'Clinical Procedure / Care Incident', hint: 'Delayed triage, unmonitored reaction, wrong site, wrong patient check' },
  { id: 'diagnostic', label: 'Diagnostic / Lab / Specimen Error', hint: 'Mislabeled specimen, delayed critical results, unread telemetry alarm' },
  { id: 'fall', label: 'Fall / Physical Injury / Environmental', hint: 'Patient slip, unassisted transfer fall, facility hazard or barrier slip' },
  { id: 'device', label: 'Medical Device / Equipment Failure', hint: 'ECG lead loss, infusion pump rate error, defibrillator check failure' },
  { id: 'documentation', label: 'Documentation / Consent / Breach', hint: 'Informed consent omission, DISHA EHR access breach, identity mismatch' },
]
export const SEVERITY_LEVELS = [
  { level: 1, name: 'Near Miss / Good Catch', hint: 'Hazard intercepted before reaching the patient; zero harm incurred.' },
  { level: 2, name: 'No Harm Event', hint: 'Reached patient but caused no harm; monitoring conducted.' },
  { level: 3, name: 'Minor / Temp Harm', hint: 'Required immediate localized first-aid or symptom relief intervention.' },
  { level: 4, name: 'Moderate Harm', hint: 'Required active treatment, extended stay, or intensive observation.' },
  { level: 5, name: 'Sentinel / Critical', hint: 'Life-threatening or permanent harm; activates immediate Director page.' },
]
export const OCCURRED_PRESETS = [{ id: 'now', label: 'Just Now (<15m)' }, { id: 'today', label: 'Earlier Today' }, { id: 'shift', label: 'Past Shift / Date' }]
export const FACILITY_ZONES = ['Chamber 101 (Cardiology OPD)', 'Chamber 102 (Cardiology OPD)', 'Chamber 103 (General Medicine)', 'Reception & Waiting Lounge', 'Pharmacy Dispensary', 'Central Stores', 'Diagnostics & Imaging']
export const FACILITY_BRANCHES = ['Downtown Metro Branch (#BLR-METRO-04)', 'Kondapur Satellite Clinic', 'Metro North Clinic']
export const CONTRIBUTING_FACTORS = ['High Clinical Volume / Fatigue', 'UI / Alert Fatigue / Warning Bypass', 'Incomplete Triage Handover', 'Verbal Order Miscommunication', 'Pharmacy Packaging Similarity (LASA)', 'System Integration Latency']
export const OTHER_PERSONNEL = ['Nurse Priya Nair (Staff #ST-402)', 'Dr. Sahil Roy (Cardiology Intern)', 'Ramesh Pillai, B.Pharm', 'Priya Nair (Reception)']
