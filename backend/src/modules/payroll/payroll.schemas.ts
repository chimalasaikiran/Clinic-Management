import { z } from 'zod'
import { isoDate, uuid } from '../../common/validation/validation'
import { isMonth } from './payroll.logic'

export const ADJUSTMENT_CATEGORIES = {
  addition: ['Overtime / extra hours', 'Performance incentive', 'Clinic bonus', 'Travel allowance', 'Other approved addition'],
  deduction: ['Unpaid leave', 'Equipment or badge recovery', 'Other approved deduction'],
} as const
export const ADVANCE_CATEGORIES = ['Medical emergency', 'Personal emergency / relocation', 'Education', 'Equipment purchase', 'Other'] as const
export const ADVANCE_SOURCES = ['Employee request', 'Admin created'] as const
export const DISBURSAL_METHODS = ['Bank transfer (NEFT)', 'Bank transfer (RTGS)', 'Cheque'] as const
export const EMPLOYMENTS = ['full_time', 'part_time', 'contract_locum', 'consultant'] as const
export const PAY_MODELS = ['monthly', 'visit', 'shift', 'hourly'] as const

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)
const freeText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`).default('')
const version = z.number({ error: 'Reload the record and try again.' }).int().positive()
const month = z.string({ error: 'Choose the month.' }).refine(isMonth, 'Choose the month.')

// Rupees with at most two decimals, converted to paise.
const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
const rupees = (message: string, max = 10_000_000) =>
  z.number({ error: message }).positive(message).max(max, `Enter an amount up to ₹${max.toLocaleString('en-IN')}.`).refine(twoDecimals, 'Use at most two decimal places.').transform((value) => Math.round(value * 100))
const rupeesOrZero = (message: string) => z.number({ error: message }).min(0, message).max(10_000_000).refine(twoDecimals, 'Use at most two decimal places.').transform((value) => Math.round(value * 100))
// Percentages with at most two decimals, converted to basis points.
const percent = (message: string) => z.number({ error: message }).min(0, message).max(100, message).refine(twoDecimals, 'Use at most two decimal places.').transform((value) => Math.round(value * 100))

export const settingsSchema = z.object({
  epfEnabled: z.boolean(),
  epfRate: percent('Enter the EPF rate.'),
  epfCap: rupeesOrZero('Enter the EPF cap, or 0 for no cap.'),
  esicEnabled: z.boolean(),
  esicRate: percent('Enter the ESIC rate.'),
  esicCeiling: rupeesOrZero('Enter the ESIC wage ceiling.'),
  ptEnabled: z.boolean(),
  ptState: text(60, 'Enter the state the professional tax is paid in.'),
  ptSlabs: z.array(z.object({ above: rupeesOrZero('Enter the monthly gross above which the slab applies.'), amount: rupeesOrZero('Enter the tax for the slab.') })).max(10)
    .refine((slabs) => new Set(slabs.map((slab) => slab.above)).size === slabs.length, 'Each slab needs a different threshold.'),
  tdsEnabled: z.boolean(),
  tdsRate: percent('Enter the TDS rate.'),
  payDay: z.number({ error: 'Choose the pay day.' }).int().min(1, 'Choose a day from 1 to 28.').max(28, 'Choose a day from 1 to 28.'),
  version: version.nullable(),
})
export type SettingsInput = z.infer<typeof settingsSchema>

export const profileSchema = z.object({
  staffId: uuid,
  employment: z.enum(EMPLOYMENTS, { error: 'Choose the employment type.' }),
  model: z.enum(PAY_MODELS, { error: 'Choose the pay model.' }),
  rate: rupees('Enter the pay rate.'),
  bankName: text(80, 'Enter the bank name.'),
  ifsc: z.string({ error: 'Enter the IFSC.' }).trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter an 11-character IFSC, e.g. HDFC0001234.'),
  accountLast4: z.string({ error: 'Enter the last 4 digits of the account.' }).trim().regex(/^\d{4}$/, 'Enter the last 4 digits of the account.'),
  active: z.boolean().default(true),
})
export type ProfileInput = z.infer<typeof profileSchema>
export const updateProfileSchema = profileSchema.omit({ staffId: true }).extend({ version })
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export const verifyBankSchema = z.object({ version })

export const cycleSchema = z.object({ month })
export const scopeSchema = z.object({
  branchIds: z.array(uuid).max(100),
  employment: z.array(z.enum(EMPLOYMENTS)).max(4),
  version,
})
export type ScopeInput = z.infer<typeof scopeSchema>

export const entrySchema = z
  .object({
    status: z.enum(['ready', 'needs_review', 'on_hold']).optional(),
    statusNote: freeText(300).optional(),
    // Paid days or units replacing the figure from the records; null goes back to the records.
    entered: z.number({ error: 'Enter a whole number.' }).int('Enter a whole number.').min(0, 'Enter zero or more.').max(10_000).nullable().optional(),
    enteredReason: z.string().trim().max(300, 'Use at most 300 characters.').optional(),
    version,
  })
export type EntryInput = z.infer<typeof entrySchema>
export const includeSchema = z.object({ entryIds: z.array(uuid).min(1).max(1000), included: z.boolean() })
export const cycleVersionSchema = z.object({ version })
export const paymentSchema = z.object({ reference: text(60, 'Enter the bank reference (UTR) of the transfer.'), version })

export const adjustmentSchema = z
  .object({
    staffId: uuid,
    month,
    direction: z.enum(['addition', 'deduction'], { error: 'Choose addition or deduction.' }),
    category: text(60, 'Choose a category.'),
    label: freeText(120),
    amount: rupees('Enter an amount greater than zero.', 1_000_000),
    reason: text(1000, 'Give a reason for this adjustment.'),
    documentRef: z.string().trim().max(80).optional().transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    if (!(ADJUSTMENT_CATEGORIES[value.direction] as readonly string[]).includes(value.category)) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Choose a category for this kind of adjustment.' })
  })
export type AdjustmentInput = z.infer<typeof adjustmentSchema>
export const adjustmentDecisionSchema = z
  .object({ ids: z.array(uuid).min(1).max(200), decision: z.enum(['approved', 'rejected']), comment: freeText(500) })
  .refine((value) => value.decision === 'approved' || value.comment.length >= 3, { path: ['comment'], message: 'Give the reason for rejecting.' })

export const advanceSchema = z.object({
  staffId: uuid,
  source: z.enum(ADVANCE_SOURCES),
  principal: rupees('Enter an amount greater than zero.'),
  installments: z.number({ error: 'Choose 1 to 12 instalments.' }).int().min(1, 'Choose 1 to 12 instalments.').max(12, 'Choose 1 to 12 instalments.'),
  startMonth: month,
  category: z.enum(ADVANCE_CATEGORIES, { error: 'Choose a reason category.' }),
  method: z.enum(DISBURSAL_METHODS).nullable().default(null),
  disbursalDate: isoDate.nullable().default(null),
  notes: freeText(1000),
})
export type AdvanceInput = z.infer<typeof advanceSchema>
export const advanceActionSchema = z
  .object({ action: z.enum(['approve', 'reject', 'disburse', 'acknowledge']), note: freeText(500), version })
  .refine((value) => value.action !== 'reject' || value.note.length >= 3, { path: ['note'], message: 'Give the reason for rejecting.' })
export type AdvanceActionInput = z.infer<typeof advanceActionSchema>
