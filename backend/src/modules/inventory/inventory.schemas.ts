import { z } from 'zod'
import { isoDate, optionalText, uuid } from '../../common/validation/validation'

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)
const freeText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`).default('')
const count = (message: string) => z.number({ error: message }).int('Use a whole number.').min(0, message).max(10_000_000)
const positive = (message: string) => z.number({ error: message }).int('Use a whole number.').min(1, message).max(10_000_000)
const version = z.number({ error: 'Reload the record and try again.' }).int().positive()

export const SCHEDULES = ['H', 'H1', 'X'] as const

export const itemSchema = z
  .object({
    code: text(40, 'Enter the item code.').transform((value) => value.toUpperCase()),
    name: text(160, 'Enter the item name.'),
    category: text(60, 'Choose the category.'),
    unit: text(30, 'Enter the unit, e.g. tablet.'),
    unitPlural: text(30, 'Enter the plural unit, e.g. tablets.'),
    dosageForm: optionalText(80),
    brand: optionalText(160),
    pack: optionalText(80),
    storage: optionalText(120),
    schedule: z.enum(SCHEDULES).nullish().transform((value) => value ?? null),
    medicineCode: optionalText(60),
    strength: optionalText(40),
    unitPrice: z.number({ error: 'Enter the unit price.' }).min(0).max(10_000_000),
    safetyLevel: count('Enter the safety level.'),
    reorderLevel: count('Enter the reorder level.'),
    targetLevel: count('Enter the target level.'),
    preferredSupplierId: uuid.nullish().transform((value) => value ?? null),
    supplierIds: z.array(uuid).max(20).default([]),
    active: z.boolean().default(true),
  })
  .refine((value) => !value.medicineCode || value.strength, { message: 'Give the strength of a medicine linked to the prescribing catalogue.', path: ['strength'] })
  .refine((value) => value.targetLevel === 0 || value.targetLevel >= value.reorderLevel, { message: 'The target level cannot be below the reorder level.', path: ['targetLevel'] })
export type ItemInput = z.infer<typeof itemSchema>
export const updateItemSchema = z.object({ version, item: itemSchema })

export const locationSchema = z.object({
  branchId: uuid,
  code: text(20, 'Enter a short code, e.g. MAIN-RX.').transform((value) => value.toUpperCase()),
  name: text(120, 'Enter the location name.'),
  detail: freeText(160),
  kind: z.enum(['store', 'pharmacy'], { error: 'Choose store or pharmacy.' }),
})
export type LocationInput = z.infer<typeof locationSchema>
export const locationActiveSchema = z.object({ active: z.boolean() })

export const supplierSchema = z.object({
  name: text(160, 'Enter the supplier name.'),
  code: optionalText(20),
  contact: freeText(120),
  phone: freeText(30),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]).default(''),
  categories: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  address: freeText(240),
  city: freeText(80),
  state: freeText(80),
  postal: freeText(12),
  country: freeText(80),
  gstin: z.string().trim().toUpperCase().refine((value) => value === '' || /^[0-9]{2}[A-Z0-9]{13}$/.test(value), 'Enter a 15-character GSTIN.').default(''),
  registration: freeText(80),
  terms: freeText(40),
  notes: freeText(1000),
  active: z.boolean().default(true),
})
export type SupplierInput = z.infer<typeof supplierSchema>
export const updateSupplierSchema = z.object({ version, supplier: supplierSchema })
export const supplierActiveSchema = z.object({ active: z.boolean(), reason: freeText(500), version })

export const requestSchema = z.object({
  submit: z.boolean(),
  locationId: uuid,
  priority: z.enum(['Normal', 'Urgent']),
  requiredBy: isoDate.nullish().transform((value) => value ?? null),
  reason: text(120, 'Choose the reason for the request.'),
  notes: freeText(1000),
  lines: z.array(z.object({ itemId: uuid, requested: positive('Request at least one unit.') }), { error: 'Add at least one item.' }).min(1, 'Add at least one item.').max(50)
    .refine((lines) => new Set(lines.map((line) => line.itemId)).size === lines.length, 'List each item once.'),
})
export type RequestInput = z.infer<typeof requestSchema>
export const updateRequestSchema = requestSchema.extend({ version })
export const reviewRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  // Units to approve now, by request line item.
  approve: z.record(uuid, count('Enter the quantity to approve.')).default({}),
  reason: freeText(1000),
  version,
}).refine((value) => value.decision === 'approve' || value.reason.length >= 5, { message: 'Give the reason for rejecting the request.', path: ['reason'] })
export const cancelSchema = z.object({ reason: freeText(500), version })

export const transferSchema = z.object({
  mode: z.enum(['draft', 'create']),
  fromLocationId: uuid,
  toLocationId: uuid,
  lines: z.array(z.object({ batchId: uuid, qty: positive('Transfer at least one unit.') })).min(1, 'Add at least one batch.').max(50),
  reason: text(120, 'Choose the reason for the transfer.'),
  notes: freeText(1000),
  plannedOn: isoDate.nullish().transform((value) => value ?? null),
}).refine((value) => value.fromLocationId !== value.toLocationId, { message: 'Choose a different destination.', path: ['toLocationId'] })
export type TransferInput = z.infer<typeof transferSchema>
export const updateTransferSchema = transferSchema.and(z.object({ version }))
export const receiveTransferSchema = z.object({ received: z.array(count('Enter the quantity received.')).max(50), version })
export const versionSchema = z.object({ version })

export const orderSchema = z.object({
  supplierId: uuid,
  storeId: uuid,
  expectedOn: isoDate.nullish().transform((value) => value ?? null),
  supplierRef: freeText(80),
  terms: freeText(40),
  notes: freeText(1000),
  draft: z.boolean().default(false),
  lines: z.array(z.object({ itemId: uuid, ordered: positive('Order at least one unit.'), rate: z.number().min(0).max(10_000_000) })).min(1, 'Add at least one item.').max(50)
    .refine((lines) => new Set(lines.map((line) => line.itemId)).size === lines.length, 'List each item once.'),
})
export type OrderInput = z.infer<typeof orderSchema>

const receiptBatch = z.object({ batchNo: text(40, 'Enter the batch number.'), expiry: isoDate, qty: positive('Enter the accepted quantity.'), bin: freeText(40) })
export const receiptSchema = z.object({
  mode: z.enum(['draft', 'record', 'post']),
  supplierId: uuid,
  orderId: uuid.nullish().transform((value) => value ?? null),
  storeId: uuid,
  challan: freeText(80),
  invoice: freeText(80),
  bay: freeText(40),
  verified: z.boolean().default(false),
  attachments: z.number().int().min(0).max(50).default(0),
  lines: z.array(z.object({ itemId: uuid, ordered: count('Enter the ordered quantity.').default(0), received: count('Enter the received quantity.'), rejected: count('Enter the rejected quantity.').default(0), batches: z.array(receiptBatch).max(20) })).min(1, 'Add at least one item.').max(50),
  discrepancies: z.array(z.object({ kind: text(60, 'Describe the discrepancy.'), qty: count('Enter the quantity.'), state: z.enum(['Unresolved', 'Documented', 'Resolved']), note: freeText(1000), resolution: optionalText(120) })).max(50).default([]),
}).superRefine((value, ctx) => {
  value.lines.forEach((line, index) => {
    if (line.rejected > line.received) ctx.addIssue({ code: 'custom', path: ['lines', index, 'rejected'], message: 'Rejected units cannot exceed those received.' })
    const batched = line.batches.reduce((sum, batch) => sum + batch.qty, 0)
    if (value.mode !== 'draft' && batched !== line.received - line.rejected) ctx.addIssue({ code: 'custom', path: ['lines', index, 'batches'], message: 'Batch quantities must add up to the accepted units.' })
  })
})
export type ReceiptInput = z.infer<typeof receiptSchema>
export const resolveDiscrepancySchema = z.object({ discrepancyId: uuid, disposition: text(120, 'Choose how the discrepancy was resolved.'), note: text(1000, 'Record the supplier response.') })

export const adjustmentSchema = z.object({
  mode: z.enum(['draft', 'post', 'reject']),
  batchId: uuid,
  proposed: z.number().int().refine((value) => value !== 0, 'Enter a non-zero change.'),
  reason: text(200, 'Choose the reason.'),
  evidence: text(300, 'Record the evidence, e.g. a count sheet number.'),
})
export type AdjustmentInput = z.infer<typeof adjustmentSchema>

export const dispenseSchema = z.object({
  locationId: uuid,
  // Units to dispense now, by prescription item.
  quantities: z.record(uuid, count('Enter the quantity to dispense.')),
  registerConfirmed: z.boolean().default(false),
  consentConfirmed: z.boolean().default(false),
})
export type DispenseInput = z.infer<typeof dispenseSchema>

export const caseSchema = z.object({
  type: z.enum(['Return', 'Discrepancy']),
  draft: z.boolean().default(false),
  subtype: text(60, 'Choose the source or category.'),
  itemId: uuid,
  batchId: uuid.nullish().transform((value) => value ?? null),
  qty: count('Enter the quantity.'),
  origin: text(120, 'Record where the stock came from.'),
  originNote: freeText(160),
  reason: text(120, 'Choose the reason.'),
  reasonNote: freeText(160),
  location: text(120, 'Choose the location.'),
  expected: count('Enter the expected quantity.').nullish().transform((value) => value ?? null),
  observed: count('Enter the observed quantity.').nullish().transform((value) => value ?? null),
  notes: freeText(2000),
  evidence: z.number().int().min(0).max(50).default(0),
  assigneeId: uuid.nullish().transform((value) => value ?? null),
})
export type CaseInput = z.infer<typeof caseSchema>
export const caseDecisionSchema = z.object({
  decision: z.enum(['restock', 'reject', 'resolve']),
  note: text(1000, 'Record the outcome of the review.'),
  // For a discrepancy: also correct stock by the observed − expected variance.
  adjust: z.boolean().default(false),
  locationId: uuid.nullish().transform((value) => value ?? null),
  version,
})
