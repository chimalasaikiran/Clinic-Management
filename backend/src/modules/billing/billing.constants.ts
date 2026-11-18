// Option lists shared with the web app (admin-panel/src/features/billing/constants.js). The API validates
// against them, so a client cannot record a payer, method or tax configuration the clinic does not use.

export const SERVICE_CATEGORIES = ['Consultation', 'Diagnostic & Lab', 'Therapy & Allied Health', 'Procedure', 'Consumables & Supplies'] as const

// The organisation tax configurations a service may use, and the GST rate each one applies.
export const TAX_CONFIGS: Record<'exempt' | 'taxable', Record<string, number>> = {
  exempt: { 'Healthcare services — Exempt': 0 },
  taxable: { 'Standard rate 18% — Taxable': 18, 'Reduced rate 5% — Taxable': 5 },
}

export const BILLING_MODELS = ['Pay-as-you-go', 'Consolidated', 'Hybrid'] as const

export const PAYERS = ['Patient Direct (Self)', 'Family / Caregiver', 'Insurance / TPA', 'Corporate Account'] as const

// Each payment channel belongs to one of the method groups the billing settings switch on and off.
export const PAYMENT_CHANNELS = {
  'Cash Desk': 'cash',
  'UPI / QR': 'upi',
  'Card / POS': 'upi',
  Gateway: 'upi',
  'NEFT / IMPS': 'bank',
  'Cheque / DD': 'bank',
} as const
export type PaymentChannel = keyof typeof PAYMENT_CHANNELS

export const REFUND_REASONS = ['Unused advance', 'Service cancelled', 'Duplicate payment', 'Payer adjustment', 'Overcharge correction'] as const
export const REFUND_METHODS = ['Original payment method', 'Bank transfer', 'Cash (branch desk)'] as const

export const RESOLUTION_TYPES = ['Explained source difference', 'Source record corrected upstream', 'Duplicate source line', 'Write-off approved (separate record)'] as const

export const SETTINGS_OPTIONS = {
  advancePolicy: ['Hold as unallocated credit', 'Apply to the next invoice'],
  partialPolicy: ['Allow partial payments', 'Require full payment'],
  allocationPolicy: ['Allocate manually only', 'Apply to the oldest invoice first'],
  invoiceDocument: ['Standard GST invoice', 'Summary invoice'],
  receiptDocument: ['Payment receipt', 'Receipt with allocation detail'],
} as const

// Every finance permission opens the ledger for reading; each kind of change needs its own.
export const FINANCE_PERMISSIONS = ['accounting.revenue', 'accounting.payments', 'accounting.invoices', 'accounting.expenses', 'accounting.settlements']
