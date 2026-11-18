// Fixed option lists for the patient forms and directory filters.
export const PATIENT_FILTERS = {
  status: ['Active', 'Inactive'],
  gender: ['Female', 'Male', 'Other'],
  visit: [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ],
}

export const TITLE_PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Master', 'Baby', 'Dr.']
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const CONSULT_LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada']
export const INTAKE_UNITS = ['General OPD / Day Surgery Intake', 'Cardiology OPD', 'Paediatrics OPD', 'Emergency Triage']
export const RELATIONSHIPS = ['Spouse', 'Mother', 'Father', 'Brother', 'Sister', 'Son', 'Daughter', 'Guardian', 'Friend']
