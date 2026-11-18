// Payroll vocabulary shared by the screens, with the API values each label stands for.

export const EMPLOYMENT = { full_time: 'Full-time', part_time: 'Part-time', contract_locum: 'Contract locum', consultant: 'Consultant' }
export const EMPLOYMENT_TYPES = Object.values(EMPLOYMENT)
export const employmentId = (label) => Object.keys(EMPLOYMENT).find((id) => EMPLOYMENT[id] === label)

// `unit` is what a rate is paid per.
export const PAY_MODELS = {
  monthly: { label: 'Monthly fixed', unit: 'mo', quantity: 'Paid days' },
  visit: { label: 'Per visit', unit: 'visit', quantity: 'Completed visits' },
  shift: { label: 'Per shift', unit: 'shift', quantity: 'Shifts worked' },
  hourly: { label: 'Hourly', unit: 'hr', quantity: 'Hours worked' },
}

export const STAFF_STATUS = { ready: 'Ready', needs_review: 'Needs review', on_hold: 'On hold' }
export const STAFF_STATUSES = Object.values(STAFF_STATUS)
export const staffStatusId = (label) => Object.keys(STAFF_STATUS).find((id) => STAFF_STATUS[id] === label)

export const ADJUSTMENT_CATEGORIES = {
  addition: ['Overtime / extra hours', 'Performance incentive', 'Clinic bonus', 'Travel allowance', 'Other approved addition'],
  deduction: ['Unpaid leave', 'Equipment or badge recovery', 'Other approved deduction'],
}
export const ADJUSTMENT_STATUS = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected' }
export const ADJUSTMENT_STATUSES = Object.values(ADJUSTMENT_STATUS)

// Lifecycle: Pending approval → Pending disbursal → Awaiting acknowledgement → Active → Settled (or Rejected).
// Only Active advances are recovered through payroll.
export const ADVANCE_STATUS = {
  pending_approval: 'Pending approval', pending_disbursal: 'Pending disbursal', awaiting_acknowledgement: 'Awaiting acknowledgement', active: 'Active', settled: 'Settled', rejected: 'Rejected',
}
export const ADVANCE_STATUSES = Object.values(ADVANCE_STATUS)
export const DISBURSAL_METHODS = ['Bank transfer (NEFT)', 'Bank transfer (RTGS)', 'Cheque']
export const ADVANCE_CATEGORIES = ['Medical emergency', 'Personal emergency / relocation', 'Education', 'Equipment purchase', 'Other']

// An advance may not exceed this multiple of monthly gross, and one instalment this share of it (the server checks too).
export const ADVANCE_LIMIT_MULTIPLE = 2
export const RECOVERY_CAP = 0.35

// The organisation's branches, filled in by PayrollProvider from the payroll state.
export const PAYROLL_BRANCHES = []
export function setBranches(branches) {
  PAYROLL_BRANCHES.splice(0, PAYROLL_BRANCHES.length, ...branches)
}
