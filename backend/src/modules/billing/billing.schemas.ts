import { z } from 'zod'
import { isoDate, optionalText, uuid } from '../../common/validation/validation'
import { BILLING_MODELS, PAYERS, PAYMENT_CHANNELS, REFUND_METHODS, REFUND_REASONS, RESOLUTION_TYPES, SERVICE_CATEGORIES, SETTINGS_OPTIONS, TAX_CONFIGS } from './billing.constants'

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)
const note = (message: string, max = 1000) => z.string({ error: message }).trim().min(10, message).max(max, `Use at most ${max} characters.`)
const freeText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`).default('')

// Rupee amounts with at most two decimals, as sent by the forms.
const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
const amount = (message: string) =>
  z.number({ error: message }).positive(message).max(10_000_000, 'Enter an amount below ₹1,00,00,000.').refine(twoDecimals, 'Use at most two decimal places.')
const price = z.number({ error: 'Enter the default price.' }).min(0, 'A price cannot be negative.').max(10_000_000).refine(twoDecimals, 'Use at most two decimal places.')
const percent = (message: string) => z.number({ error: message }).min(0, message).max(100, message)
const version = z.number({ error: 'Reload the record and try again.' }).int().positive()

const TAX_TREATMENTS = ['exempt', 'no_tax', 'taxable', 'not_configured'] as const

export const serviceSchema = z
  .object({
    code: text(40, 'Enter a unique service code.').transform((value) => value.toUpperCase()),
    name: text(200, 'Enter the service name.'),
    category: z.enum(SERVICE_CATEGORIES, { error: 'Choose the service category.' }),
    department: optionalText(120),
    // Left out of a request, the setting keeps its current value.
    patientBookable: z.boolean().optional(),
    description: freeText(2000),
    unit: optionalText(40),
    status: z.enum(['active', 'inactive']),
    price,
    taxTreatment: z.enum(TAX_TREATMENTS),
    taxConfig: optionalText(80),
    // Branches offering the service; a null price uses the default.
    prices: z.array(z.object({ branchId: uuid, price: price.nullable() })).max(100),
  })
  .superRefine((value, ctx) => {
    const configs = value.taxTreatment === 'exempt' || value.taxTreatment === 'taxable' ? TAX_CONFIGS[value.taxTreatment] : null
    if (configs && !(value.taxConfig && value.taxConfig in configs)) ctx.addIssue({ code: 'custom', path: ['taxConfig'], message: 'Choose the applicable organization tax configuration.' })
    if (value.status === 'active' && value.taxTreatment === 'not_configured') ctx.addIssue({ code: 'custom', path: ['taxTreatment'], message: 'Choose a tax treatment before activating. “Not configured” is not a tax decision.' })
    if (value.status === 'active' && value.prices.length === 0) ctx.addIssue({ code: 'custom', path: ['prices'], message: 'Select at least one location before activating this service.' })
    if (value.patientBookable && !value.department) ctx.addIssue({ code: 'custom', path: ['department'], message: 'Choose a department. It decides which therapists can take bookings made in the patient app.' })
    if (new Set(value.prices.map((entry) => entry.branchId)).size !== value.prices.length) ctx.addIssue({ code: 'custom', path: ['prices'], message: 'List each location once.' })
  })
export type ServiceInput = z.infer<typeof serviceSchema>

export const updateServiceSchema = z.object({ version, service: serviceSchema })

export const serviceStatusSchema = z.object({ status: z.enum(['active', 'inactive']), reason: freeText(500), version })

export const settingsSchema = z.object({
  billingModel: z.enum(BILLING_MODELS),
  cashEnabled: z.boolean(),
  bankEnabled: z.boolean(),
  upiEnabled: z.boolean(),
  advancePolicy: z.enum(['', ...SETTINGS_OPTIONS.advancePolicy]),
  partialPolicy: z.enum(['', ...SETTINGS_OPTIONS.partialPolicy]),
  allocationPolicy: z.enum(['', ...SETTINGS_OPTIONS.allocationPolicy]),
  invoiceDocument: z.enum(['', ...SETTINGS_OPTIONS.invoiceDocument]),
  receiptDocument: z.enum(['', ...SETTINGS_OPTIONS.receiptDocument]),
  // Null on the first save, when no settings row exists yet.
  version: version.nullable(),
}).refine((value) => value.cashEnabled || value.bankEnabled || value.upiEnabled, { message: 'Keep at least one payment method enabled.', path: ['cashEnabled'] })
export type SettingsInput = z.infer<typeof settingsSchema>

const chargeFields = {
  serviceId: uuid,
  encounterId: uuid.nullish(),
  payer: z.enum(PAYERS, { error: 'Choose the payer.' }),
  model: z.enum(BILLING_MODELS, { error: 'Choose the billing model.' }),
  quantity: z.number({ error: 'Quantity must be greater than 0.' }).int('Use a whole number.').min(1, 'Quantity must be greater than 0.').max(1000),
  discountPct: percent('Enter a discount between 0 and 100 percent.'),
  note: freeText(1000),
}

export const createChargeSchema = z.object({ patientId: uuid, ...chargeFields, confirm: z.boolean() })
export type CreateChargeInput = z.infer<typeof createChargeSchema>
export const updateChargeSchema = z.object({ ...chargeFields, confirm: z.boolean(), version })
export type UpdateChargeInput = z.infer<typeof updateChargeSchema>

export const createInvoiceSchema = z
  .object({
    patientId: uuid,
    encounterId: uuid.nullish(),
    payer: z.enum(PAYERS, { error: 'Choose the invoice recipient / payer.' }),
    model: z.enum(BILLING_MODELS, { error: 'Choose the billing model explicitly; none is assumed.' }),
    invoiceDate: isoDate,
    dueDate: isoDate,
    // Applied to every line when given; otherwise each charge keeps its own discount.
    discountPct: percent('Enter a discount between 0 and 100 percent.').nullish(),
    chargeIds: z.array(uuid).max(100).default([]),
    // Services added straight from the catalogue, without a charge.
    items: z.array(z.object({ serviceId: uuid, quantity: z.number().int().min(1).max(1000) })).max(50).default([]),
    publicNote: freeText(1000),
    internalNote: freeText(1000),
  })
  .refine((value) => value.dueDate >= value.invoiceDate, { message: 'The due date cannot be before the invoice date.', path: ['dueDate'] })
  .refine((value) => value.chargeIds.length + value.items.length > 0, { message: 'Select at least one eligible charge.', path: ['chargeIds'] })
  .refine((value) => new Set(value.chargeIds).size === value.chargeIds.length, { message: 'Select each charge once.', path: ['chargeIds'] })
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

const allocation = z.object({ invoiceId: uuid, amount: amount('Enter an amount greater than zero.') })

export const createPaymentSchema = z
  .object({
    patientId: uuid,
    amount: amount('Enter an amount greater than ₹0.'),
    channel: z.enum(Object.keys(PAYMENT_CHANNELS) as [keyof typeof PAYMENT_CHANNELS], { error: 'Choose a payment method.' }),
    payer: z.enum(PAYERS, { error: 'Choose the payer.' }),
    purpose: z.enum(['charges', 'advance']),
    txnReference: optionalText(120),
    narration: freeText(500),
    allocations: z.array(allocation).max(50).default([]),
  })
  .refine((value) => value.channel === 'Cash Desk' || value.txnReference, { message: 'Enter the transaction reference for this method.', path: ['txnReference'] })
  .refine((value) => new Set(value.allocations.map((entry) => entry.invoiceId)).size === value.allocations.length, { message: 'Allocate to each invoice once.', path: ['allocations'] })
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export const allocateSchema = allocation
export type AllocateInput = z.infer<typeof allocateSchema>

export const createRefundSchema = z.object({
  paymentId: uuid,
  amount: amount('Enter an amount greater than ₹0.'),
  reason: z.enum(REFUND_REASONS, { error: 'Choose the reason for the refund.' }),
  method: z.enum(REFUND_METHODS, { error: 'Choose the refund method.' }),
  internalReference: text(80, 'Enter an internal reference.'),
  notes: freeText(1000),
  releasesAllocations: z.boolean().default(false),
})
export type CreateRefundInput = z.infer<typeof createRefundSchema>

export const refundDecisionSchema = z.object({ note: freeText(1000), version })
export const refundRejectSchema = z.object({ note: note('Give the reason for rejecting the refund.'), version })
export const refundProcessSchema = z.object({ outcomeReference: text(120, 'Enter the bank or gateway refund reference.'), note: freeText(1000), version })
export const refundFailSchema = z.object({ note: note('Describe why the refund failed.'), version })

export const importStatementSchema = z.object({
  source: text(60, 'Name the bank or gateway this statement is from.'),
  fileName: text(200, 'Choose a statement file.'),
  // The CSV file's text. Columns: date, reference, amount and optionally time and narration.
  csv: z.string({ error: 'Choose a statement file.' }).min(1, 'The statement file is empty.').max(1_000_000, 'Use a statement file under 1 MB.'),
})
export type ImportStatementInput = z.infer<typeof importStatementSchema>

export const lineDecisionSchema = z.object({ note: freeText(500) })
export const exceptionEvidenceSchema = z.object({ evidence: text(500, 'Describe the evidence you checked.'), version })
export const exceptionResolveSchema = z.object({
  resolutionType: z.enum(RESOLUTION_TYPES, { error: 'Choose how the exception was resolved.' }),
  note: note('Explain the resolution.'),
  evidence: text(500, 'Record the evidence that supports the resolution.'),
  version,
})
export const versionSchema = z.object({ version })

export const ledgerQuerySchema = z.object({ patientId: uuid.optional() })
