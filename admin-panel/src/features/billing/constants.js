export const ORG = { name: 'Aura Health', scope: 'All locations (3)' }

export const BRANCHES = [
  { id: 'main', name: 'Main Clinic (HQ)', short: 'HQ' },
  { id: 'kondapur', name: 'Kondapur', short: 'Kondapur' },
  { id: 'banjara', name: 'Banjara Hills', short: 'Banjara Hills' },
]

export const SERVICE_CATEGORIES = ['Consultation', 'Diagnostic & Lab', 'Therapy & Allied Health', 'Procedure']
export const SERVICE_DEPARTMENTS = ['Cardiology', 'Diagnostic & Imaging', 'General Medicine', 'Pediatrics', 'Physiotherapy']
export const TAX_TREATMENTS = ['Exempt', 'No tax / Not applicable', 'Taxable', 'Not configured']

// Organisation-level tax configurations a service may point to; only Exempt and Taxable need one.
export const TAX_CONFIGS = {
  Exempt: ['Healthcare services — Exempt'],
  Taxable: ['Standard rate 18% — Taxable', 'Reduced rate 5% — Taxable'],
}

export const BILLING_MODELS = ['Pay-as-you-go', 'Consolidated', 'Hybrid']
export const DATE_RANGES = [
  { id: 'custom', label: '01 Sep – 21 Oct 2026', from: '2026-09-01', to: '2026-10-21' },
  { id: 'month', label: 'October 2026', from: '2026-10-01', to: '2026-10-31' },
  { id: 'all', label: 'All recorded dates', from: '0000-01-01', to: '9999-12-31' },
]

export const SERVICE_PAGE_SIZE = 10

// "Now" for audit entries in the sample data.
export const NOW_STAMP = '21 Oct 2026 · 11:30 IST'
