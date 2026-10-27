export const FACILITY_TYPES = ['Multi-specialty Clinic', 'Outpatient Practice', 'Daycare Surgical Center']

export const CLINIC_CLASSIFICATIONS = [
  {
    id: 'general',
    title: 'General / Family Clinic',
    description: 'Primary care, outpatient consultations & preventative health.',
  },
  {
    id: 'specialty',
    title: 'Specialty Clinic',
    description: 'Focused exclusively on one domain or practice specialty.',
  },
  {
    id: 'multi-specialty',
    title: 'Multi-Speciality Clinic',
    description: 'Multiple clinical specialties operating within coordinated consultation suites.',
  },
  {
    id: 'diagnostic',
    title: 'Diagnostic & Daycare Centre',
    description: 'Consultation suites with pathology labs, imaging wings & daycare bays.',
  },
  {
    id: 'network-hub',
    title: 'Super-Specialty / Network Hub',
    tag: 'Tertiary surgical & multidisciplinary protocols',
    description: 'Advanced quaternary consultation suites, multi-theatre scheduling and institutional registry.',
    wide: true,
  },
]

export const OPERATING_STRUCTURES = [
  {
    id: 'solo',
    title: 'Solo Practitioner',
    description: 'Single physician leading autonomous clinical, billing & prescription flow.',
  },
  {
    id: 'collaborative',
    title: 'Collaborative Team Practice',
    description: 'Multi-doctor panel, visiting specialists, nursing coordinators & shared triage.',
  },
  {
    id: 'operations-led',
    title: 'Operations-Led Facility',
    description: 'Dedicated clinic managers, central billing desk, pharmacy desk & medical records staff.',
  },
  {
    id: 'network',
    title: 'Integrated Health Network',
    description: 'Centralized enterprise governance governing satellite clinics and diagnostic clusters.',
  },
]
