import { z } from 'zod'
import { clockTime, indianMobile, isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'
import { createPatientSchema } from '../patients/patients.schemas'

const SOURCES = ['website', 'phone', 'front_desk', 'walk_in'] as const
const OPEN_STAGES = ['new', 'contacted', 'qualified'] as const
const INTERACTIONS = ['phone_call', 'whatsapp', 'sms', 'email', 'in_person'] as const
const OUTCOMES = ['connected', 'no_answer', 'interested', 'not_interested'] as const

const fullName = z.string({ error: 'Enter the lead’s full name.' }).trim().min(1, 'Enter the lead’s full name.').max(120, 'Use at most 120 characters.')
const email = z
  .union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address or leave it empty.'))])
  .nullish()
  .transform((value) => value || null)
const version = z.number().int().min(1)
const nextAction = optionalText(200)

const contact = {
  fullName,
  mobile: indianMobile,
  email,
  interest: optionalText(120),
  branchId: uuid,
  ownerMembershipId: uuid,
  // Set after staff have looked at another lead with the same mobile number and decided to keep both.
  confirmedNotDuplicate: z.boolean().default(false),
}

const needsAction = (value: { nextDueDate?: string | null; nextAction: string | null }) => !value.nextDueDate || Boolean(value.nextAction)

export const createLeadSchema = z
  .object({
    ...contact,
    source: z.enum(SOURCES, { error: 'Choose where the enquiry came from.' }),
    stage: z.enum(OPEN_STAGES).default('new'),
    nextAction,
    nextDueDate: isoDate.nullish(),
    nextDueTime: clockTime.default('10:00'),
  })
  .refine(needsAction, { path: ['nextAction'], message: 'Describe the next action for this follow-up.' })

export const updateLeadSchema = z.object({
  ...contact,
  // Converted is reached only through conversion; a converted lead keeps its stage.
  stage: z.enum([...OPEN_STAGES, 'closed', 'converted']),
  version,
})

export const interactionSchema = z
  .object({
    type: z.enum(INTERACTIONS, { error: 'Choose the interaction type.' }),
    occurredDate: isoDate,
    occurredTime: clockTime,
    outcome: z.enum(OUTCOMES, { error: 'Choose one outcome.' }),
    notes: z.string({ error: 'Add notes for this interaction.' }).trim().min(1, 'Add notes for this interaction.').max(2000, 'Use at most 2000 characters.'),
    ownerMembershipId: uuid,
    decision: z.enum(['keep', 'complete', 'reschedule']),
    nextAction,
    nextDueDate: isoDate.nullish(),
    nextDueTime: clockTime.default('11:00'),
    reason: optionalText(500),
    version,
  })
  .superRefine((value, ctx) => {
    if (value.decision !== 'reschedule') return
    if (!value.nextAction) ctx.addIssue({ code: 'custom', path: ['nextAction'], message: 'Describe the next action.' })
    if (!value.nextDueDate) ctx.addIssue({ code: 'custom', path: ['nextDueDate'], message: 'Choose the next follow-up date.' })
    if (!value.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Give a reschedule reason.' })
  })

export const dispositionSchema = z
  .object({
    disposition: z.enum(['defer', 'unresponsive', 'not_interested']),
    nextAction,
    nextDueDate: isoDate.nullish(),
    nextDueTime: clockTime.default('11:00'),
    ownerMembershipId: uuid,
    reason: optionalText(500),
    version,
  })
  .superRefine((value, ctx) => {
    if (!value.nextAction) ctx.addIssue({ code: 'custom', path: ['nextAction'], message: 'Describe the next action.' })
    if (value.disposition !== 'defer') return
    if (!value.nextDueDate) ctx.addIssue({ code: 'custom', path: ['nextDueDate'], message: 'Choose when to contact them again.' })
    if (!value.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Give a reason for deferring.' })
  })

export const convertSchema = z.object({ patientId: uuid, version })

export const convertNewPatientSchema = createPatientSchema.extend({ leadVersion: version })

export const listLeadsSchema = pagination(100).extend({
  q: z.string().trim().max(100).optional(),
  stage: z.enum([...OPEN_STAGES, 'converted', 'closed']).optional(),
  source: z.enum(SOURCES).optional(),
  ownerId: uuid.optional(),
  due: z.enum(['overdue', 'due_today', 'upcoming', 'open']).optional(),
  branchId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(['follow-up', 'newest', 'name']).default('follow-up'),
})

export const performanceSchema = z.object({
  from: isoDate,
  to: isoDate,
  branchId: uuid.optional(),
  source: z.enum(SOURCES).optional(),
}).refine((value) => value.from <= value.to, { path: ['to'], message: 'The end date must not be before the start date.' })

export const duplicatesSchema = z.object({ mobile: indianMobile, excludeId: uuid.optional() })
export const ownersSchema = z.object({ branchId: uuid.optional() })

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type InteractionInput = z.infer<typeof interactionSchema>
export type DispositionInput = z.infer<typeof dispositionSchema>
export type ConvertNewPatientInput = z.infer<typeof convertNewPatientSchema>
export type ListLeadsQuery = z.infer<typeof listLeadsSchema>
export type PerformanceQuery = z.infer<typeof performanceSchema>
