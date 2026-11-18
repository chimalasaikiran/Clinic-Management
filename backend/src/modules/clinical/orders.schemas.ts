import { z } from 'zod'
import { uuid } from '../../common/validation/validation'

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)
const note = (message: string, max = 2000) => z.string({ error: message }).trim().min(10, message).max(max, `Use at most ${max} characters.`)

export const ORDER_CATEGORIES = ['Laboratory', 'Imaging', 'Special Diagnostics'] as const
// Anything other than routine makes the order urgent.
export const ROUTINE_PRIORITY = 'Routine (Outpatient OPD)'
export const REVIEW_OUTCOMES = ['action', 'routine', 'normal', 'escalate'] as const

export const createOrderSchema = z
  .object({
    encounterId: uuid.optional(),
    branchId: uuid.optional(),
    indication: text(2000, 'Enter the clinical indication and justification.'),
    items: z
      .array(
        z.object({
          code: text(40, 'Choose an investigation.'),
          name: text(240, 'Choose an investigation.'),
          category: z.enum(ORDER_CATEGORIES),
          loinc: z.string().trim().max(20).nullish().transform((value) => value || null),
          destination: text(240, 'Give the performing destination.'),
          priority: text(60, 'Choose a priority.'),
        }),
        { error: 'Select at least one investigation.' },
      )
      .min(1, 'Select at least one investigation.')
      .max(20),
  })
  .refine((value) => value.encounterId || value.branchId, { message: 'Choose the branch for an order outside a consultation.', path: ['branchId'] })

export const collectSchema = z.object({ note: z.string().trim().max(1000).default('') })

export const resultSchema = z.object({
  summary: text(4000, 'Enter the result.'),
  flag: z.enum(['normal', 'abnormal', 'critical'], { error: 'Choose whether the result is normal, abnormal or critical.' }),
})

export const reviewSchema = z.object({
  outcome: z.enum(REVIEW_OUTCOMES, { error: 'Select the clinical assessment outcome.' }),
  note: note('Add a clinical note (at least 10 characters).'),
})

export const cancelOrderSchema = z.object({ reason: note('Give the reason for cancelling (at least 10 characters).', 1000) })

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type ResultInput = z.infer<typeof resultSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
