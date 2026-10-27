export const TOTAL_ONBOARDING_STEPS = 7

export const ONBOARDING_STEPS = {
  signup: { current: 2, metaLabel: 'Identity', headerLabel: 'Account Initialization', badge: 'counter' },
  verify: {
    current: 3,
    metaLabel: 'Credential Verification',
    headerLabel: 'Credential Verification',
    badge: 'counter',
  },
  clinic: { current: 4, metaLabel: 'Practice Architecture', headerLabel: 'Clinic Profile', badge: 'counter' },
  contact: { current: 5, metaLabel: 'Practice Contact', headerLabel: 'Practice Contact', badge: 'dot' },
  operations: {
    current: 6,
    metaLabel: 'Operational Information',
    headerLabel: 'Operational Info',
    badge: 'dot',
  },
  specialties: {
    current: 7,
    metaLabel: 'Clinical Specialties',
    headerLabel: 'Clinical Specialties',
    badge: 'dot',
  },
}
