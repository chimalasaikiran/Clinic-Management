// Partner directory and coverage options for the insurance setup. Selecting a partner here
// records intent only; it does not establish an empanelment or cashless agreement.
export const PARTNERS = [
  { id: 'hdfc-ergo', name: 'HDFC ERGO General Insurance', type: 'Insurer' },
  { id: 'medi-assist', name: 'Medi Assist Insurance TPA', type: 'TPA' },
  { id: 'star-health', name: 'Star Health and Allied Insurance', type: 'Insurer' },
  { id: 'icici-lombard', name: 'ICICI Lombard General Insurance', type: 'Insurer' },
  { id: 'niva-bupa', name: 'Niva Bupa Health Insurance', type: 'Insurer' },
  { id: 'bajaj-allianz', name: 'Bajaj Allianz General Insurance', type: 'Insurer' },
  { id: 'paramount', name: 'Paramount Health Services TPA', type: 'TPA' },
  { id: 'vidal', name: 'Vidal Health TPA', type: 'TPA' },
]

export const BILLING_METHODS = [
  { id: 'cashless', label: 'Cashless billing' },
  { id: 'reimbursement', label: 'Reimbursement support' },
]

export const COVERAGE_BRANCHES = [
  { id: 'bangalore-central', name: 'Bangalore Central', detail: 'Current workspace · Karnataka, IN' },
  { id: 'whitefield', name: 'Whitefield', detail: 'Branch · Karnataka, IN' },
]

export const COVERAGE_SERVICES = [
  { id: 'opd', label: 'OPD consultations', short: 'OPD' },
  { id: 'diagnostics', label: 'Diagnostics', short: 'Diagnostics' },
  { id: 'daycare', label: 'Day care', short: 'Day care' },
]

export const MAX_AGREEMENT_SIZE = 10 * 1024 * 1024
