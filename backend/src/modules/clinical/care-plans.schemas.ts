import { z } from 'zod'
import { isoDate, uuid } from '../../common/validation/validation'
import { ADHERENCE_STATES, GOAL_STATUSES } from './care-plans.logic'

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)

export const createCarePlanSchema = z
  .object({
    title: text(200, 'Enter the care plan title.'),
    category: text(120, 'Choose the clinical category.'),
    leadPractitionerId: uuid,
    rationale: z.string({ error: 'Describe the clinical rationale.' }).trim().min(20, 'Describe the clinical rationale and therapeutic objectives (at least 20 characters).').max(4000),
    startDate: isoDate,
    nextReview: isoDate,
    targetDate: isoDate,
    diagnoses: z
      .array(z.object({ icd: text(20, 'Give the ICD-10 code.'), name: text(240, 'Give the diagnosis.') }), { error: 'Link at least one diagnosis or health concern.' })
      .min(1, 'Link at least one diagnosis or health concern.')
      .max(20),
    goals: z
      .array(z.object({ title: text(200, 'Name the goal.'), target: text(200, 'State the measurable target.'), protocol: z.string().trim().max(500).default(''), cadence: text(80, 'Choose a cadence.') }), {
        error: 'Add at least one measurable clinical goal.',
      })
      .min(1, 'Add at least one measurable clinical goal.')
      .max(20),
    interventions: z
      .array(z.object({ type: text(40, 'Choose a type.'), title: text(200, 'Describe the intervention.'), due: z.string().trim().max(120).default('') }), { error: 'Add at least one planned intervention.' })
      .min(1, 'Add at least one planned intervention.')
      .max(30),
    education: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    whatsapp: z.boolean().default(false),
  })
  .refine((value) => value.nextReview > value.startDate, { message: 'The interim review must fall after the start date.', path: ['nextReview'] })
  .refine((value) => value.targetDate > value.nextReview, { message: 'The target completion must fall after the interim review.', path: ['targetDate'] })

export const carePlanReviewSchema = z.object({
  // save: progress only; complete: a finished follow-up (strict rules); escalate: also raises an alert for the lead.
  mode: z.enum(['save', 'complete', 'escalate']),
  observation: z.string({ error: 'Record the progress observation.' }).trim().min(10, 'Record the general clinical progress observation (at least 10 characters).').max(2000),
  goalStatus: z.record(z.string(), z.union([z.enum(GOAL_STATUSES), z.literal('')])).default({}),
  goalNote: z.record(z.string(), z.string().trim().max(1000)).default({}),
  adherence: z.array(z.enum(ADHERENCE_STATES)).default([]),
  barriers: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  nextReview: isoDate.optional(),
  escalate: z.boolean().default(false),
  version: z.number().int().min(1),
})

export type CreateCarePlanInput = z.infer<typeof createCarePlanSchema>
export type CarePlanReviewInput = z.infer<typeof carePlanReviewSchema>
