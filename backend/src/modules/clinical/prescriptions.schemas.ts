import { z } from 'zod'
import { uuid } from '../../common/validation/validation'

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)

const item = z.object({
  medicineCode: text(60, 'Choose a medication from the formulary.'),
  name: text(160, 'Choose a medication from the formulary.'),
  strength: text(40, 'Choose a strength.'),
  form: text(40, 'Give the dosage form.'),
  route: text(40, 'Choose a route.'),
  drugClass: z.string().trim().max(60).nullish().transform((value) => value || null),
  // Units per administration, for example 1 (tablet).
  dose: z.number({ error: 'Enter a dose.' }).int().min(1, 'Enter a dose between 1 and 20.').max(20, 'Enter a dose between 1 and 20.'),
  frequency: text(80, 'Choose a frequency.'),
  frequencyPerDay: z.number().int().min(1).max(6),
  food: text(40, 'Choose the food relationship.'),
  durationDays: z.number({ error: 'Choose a duration.' }).int().min(1).max(365),
  instructions: z.string().trim().max(1000).default(''),
  indication: text(500, 'Give the indication.'),
})

export const createPrescriptionSchema = z
  .object({
    // During a consultation the prescription belongs to its encounter (and branch); otherwise name the branch.
    encounterId: uuid.optional(),
    branchId: uuid.optional(),
    indication: text(500, 'Give the indication.'),
    precautionAcknowledged: z.boolean().default(false),
    items: z.array(item, { error: 'Add at least one medication before authorizing.' }).min(1, 'Add at least one medication before authorizing.').max(20),
  })
  .refine((value) => value.encounterId || value.branchId, { message: 'Choose the branch for a prescription outside a consultation.', path: ['branchId'] })

export const discontinueSchema = z.object({
  reason: z.string({ error: 'Give the reason for discontinuing.' }).trim().min(10, 'Give the reason for discontinuing (at least 10 characters).').max(1000),
})

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>
