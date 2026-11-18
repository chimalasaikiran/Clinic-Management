import { localToday } from '../patients/format'

// Option lists shared with the API (backend/src/modules/billing/billing.constants.ts), which validates against them.
export const SERVICE_CATEGORIES = ['Consultation', 'Diagnostic & Lab', 'Therapy & Allied Health', 'Procedure', 'Consumables & Supplies']
export const SERVICE_DEPARTMENTS = ['Cardiology', 'Diagnostic & Imaging', 'General Medicine', 'Pediatrics', 'Physiotherapy']

// Tax treatments as the API stores them and as the screens name them. Exempt is not the same as no tax.
export const TAX_TREATMENTS = [
  ['exempt', 'Exempt'],
  ['no_tax', 'No tax / Not applicable'],
  ['taxable', 'Taxable'],
  ['not_configured', 'Not configured'],
]
export const TAX_LABEL = Object.fromEntries(TAX_TREATMENTS)
export const TAX_VALUE = Object.fromEntries(TAX_TREATMENTS.map(([value, label]) => [label, value]))

// Organisation-level tax configurations a service may point to; only Exempt and Taxable need one.
export const TAX_CONFIGS = {
  Exempt: ['Healthcare services — Exempt'],
  Taxable: ['Standard rate 18% — Taxable', 'Reduced rate 5% — Taxable'],
}
export const GST_RATE = { 'Standard rate 18% — Taxable': 18, 'Reduced rate 5% — Taxable': 5 }

export const BILLING_MODELS = ['Pay-as-you-go', 'Consolidated', 'Hybrid']
export const PAYERS = ['Patient Direct (Self)', 'Family / Caregiver', 'Insurance / TPA', 'Corporate Account']

// Payment channels and the configuration switch (cash, bank, upi) each one belongs to.
export const PAYMENT_CHANNELS = [
  { channel: 'Cash Desk', label: 'Cash', group: 'cash', hint: 'Cash: optional note' },
  { channel: 'UPI / QR', label: 'UPI', group: 'upi', hint: 'UPI: UTR / transaction ID' },
  { channel: 'Card / POS', label: 'Card', group: 'upi', hint: 'Card: authorization reference' },
  { channel: 'NEFT / IMPS', label: 'Bank transfer', group: 'bank', hint: 'Transfer: UTR / NEFT reference' },
  { channel: 'Cheque / DD', label: 'Cheque / DD', group: 'bank', hint: 'Cheque or draft number' },
  { channel: 'Gateway', label: 'Configured gateway', group: 'upi', hint: 'Gateway: provider transaction ID' },
]

export const REFUND_REASON_OPTIONS = ['Unused advance', 'Service cancelled', 'Duplicate payment', 'Payer adjustment', 'Overcharge correction']
export const REFUND_METHODS = ['Original payment method', 'Bank transfer', 'Cash (branch desk)']
export const RESOLUTION_TYPES = ['Explained source difference', 'Source record corrected upstream', 'Duplicate source line', 'Write-off approved (separate record)']

export const SERVICE_PAGE_SIZE = 10

const pad = (value) => String(value).padStart(2, '0')
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// Date filters for the registers, worked out from today's date on this device.
export function dateRanges(today = localToday()) {
  const [year, month, day] = today.split('-').map(Number)
  const monthStart = `${year}-${pad(month)}-01`
  const monthEnd = iso(new Date(year, month, 0))
  const lastMonthStart = iso(new Date(year, month - 2, 1))
  const lastMonthEnd = iso(new Date(year, month - 1, 0))
  const thirtyAgo = iso(new Date(year, month - 1, day - 29))
  const label = (from) => new Date(`${from}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return [
    { id: 'all', label: 'All recorded dates', from: '0000-01-01', to: '9999-12-31' },
    { id: 'month', label: label(monthStart), from: monthStart, to: monthEnd },
    { id: 'last-month', label: label(lastMonthStart), from: lastMonthStart, to: lastMonthEnd },
    { id: '30d', label: 'Last 30 days', from: thirtyAgo, to: today },
  ]
}
export const DATE_RANGES = dateRanges()
