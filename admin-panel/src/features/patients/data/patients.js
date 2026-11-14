// Sample patient master list standing in for the patients API.
// `id` is the lower-cased MRN and is what the routes use.
export const PATIENTS = [
  {
    id: 'pt-000184', mrn: 'PT-000184', name: 'Ananya Sharma', initials: 'AS', tone: 'teal', age: 34, gender: 'Female', dob: '1992-04-18',
    abha: '14-8821-9012-3456', mobile: '+91 98452 11029', contactNote: 'Verified SMS OTP', branch: 'Main Surgical Pavilion',
    lastVisit: '2026-10-05', lastDoctor: 'Dr. Ananya Rao · Cardiology', status: 'Active', bloodGroup: 'O+', regDate: '2024-10-14',
    careTeam: 'Dr. Julian Vance (Lead)', careTeamNote: 'Dr. Ananya Rao (Cardiology)', consent: 'Consent Up to date (v3.2)', consentNote: 'Zero Allergies Flagged',
    email: 'ananya.sharma@healthmail.in', address: 'Flat 402, Oakwood Regency, Phase II, Kondapur, Hyderabad, Telangana — 500084',
    emergencyName: 'Rohit Sharma', emergencyRelation: 'Spouse', emergencyPhone: '+91 98452 77102', abhaAddress: 'ananya.sharma@abdm',
  },
  { id: 'pt-000219', mrn: 'PT-000219', name: 'Rajeshwar K. Sundaram', initials: 'RS', tone: 'slate', age: 58, gender: 'Male', abha: '91-4412-8831-0921', mobile: '+91 94440 82910', contactNote: 'Verified Primary', branch: 'Main Surgical Pavilion', lastVisit: '2026-10-12', lastDoctor: 'Dr. Julian Vance · Cardio Surgery', status: 'Active', bloodGroup: 'B+', regDate: '2024-11-02' },
  { id: 'pt-000305', mrn: 'PT-000305', name: 'Priya Venkataraman', initials: 'PV', tone: 'teal', age: 29, gender: 'Female', abha: '32-1109-4482-7712', mobile: '+91 97112 04821', contactNote: 'Verified SMS OTP', branch: 'Kondapur Satellite Clinic', lastVisit: '2026-10-10', lastDoctor: 'Dr. Sarita V. Nambiar · OB-GYN', status: 'Active', bloodGroup: 'A+', regDate: '2025-01-19' },
  { id: 'pt-000412', mrn: 'PT-000412', name: 'Vikramaditya Malhotra', initials: 'VM', tone: 'slate', age: 47, gender: 'Male', abha: '48-9921-0021-3391', mobile: '+91 98201 94812', contactNote: 'Verified Primary', branch: 'Main Surgical Pavilion', lastVisit: '2026-10-08', lastDoctor: 'Dr. Vikramaditya Sen · Ortho', status: 'Active', bloodGroup: 'O-', regDate: '2025-03-04' },
  { id: 'pt-000528', mrn: 'PT-000528', name: 'Deepa R. Nair', initials: 'DN', tone: 'teal', age: 42, gender: 'Female', abha: '88-1290-7744-1102', mobile: '+91 98471 22934', contactNote: 'Verified SMS OTP', branch: 'Metro North Clinic', lastVisit: '2026-10-05', lastDoctor: 'Dr. Rajesh Kannan · Neurology', status: 'Active', bloodGroup: 'B+', regDate: '2025-05-21' },
  { id: 'pt-000671', mrn: 'PT-000671', name: 'Mohammed Zeeshan', initials: 'MZ', tone: 'slate', age: 63, gender: 'Male', abha: '74-6631-9012-4410', mobile: '+91 98490 12847', contactNote: 'Verified Primary', branch: 'Main Surgical Pavilion', lastVisit: '2026-10-02', lastDoctor: 'Dr. Ananya Rao · Cardiology', status: 'Active', bloodGroup: 'AB+', regDate: '2025-06-30' },
  { id: 'pt-000789', mrn: 'PT-000789', name: 'Kavita S. Deshpande', initials: 'KD', tone: 'amber', age: 8, gender: 'Female', ageTag: 'Paediatric', abha: '55-4301-8892-1209', mobile: '+91 99224 81092', contactNote: 'Guardian: S. Deshpande', branch: 'Kondapur Satellite Clinic', lastVisit: '2026-09-28', lastDoctor: 'Dr. Kavita Deshmukh · Paediatrics', status: 'Inactive', statusNote: 'Review due', bloodGroup: 'A+', regDate: '2025-08-12' },
  { id: 'pt-000844', mrn: 'PT-000844', name: 'Harish Chandra Patel', initials: 'HP', tone: 'slate', age: 71, gender: 'Male', ageTag: 'Senior', abha: '29-8812-3341-9908', mobile: '+91 98791 00293', contactNote: 'Verified Primary', branch: 'Main Surgical Pavilion', lastVisit: '2026-09-24', lastDoctor: 'Dr. Julian Vance · Cardio Surgery', status: 'Active', bloodGroup: 'O+', regDate: '2025-09-02' },
]

export const PATIENT_TOTAL = 1842
export const FIRST_NEW_MRN = 1843

export const PATIENT_FILTERS = {
  branch: ['Main Surgical Pavilion', 'Kondapur Satellite Clinic', 'Metro North Clinic'],
  department: ['Cardiology', 'Cardio Surgery', 'Ortho', 'Neurology', 'Paediatrics', 'OB-GYN'],
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
