import { z } from 'zod'
import { clockTime, isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'

const version = z.number().int().min(1)
const text = (label: string, max: number) => z.string({ error: `Enter ${label}.` }).trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`)
const httpsUrl = (label: string) => z.union([z.literal(''), z.string().trim().max(500).regex(/^https:\/\/\S+\.\S+$/, `Enter an https:// ${label}.`)]).nullish().transform((value) => value || null)

export const PROFILE_CATEGORIES = ['Medical clinic', 'Dental clinic', 'Physiotherapy clinic', 'Preventive healthcare clinic', 'Diagnostic centre', 'Multi-specialty clinic'] as const

const specialHours = z
  .object({
    date: isoDate,
    closed: z.boolean().default(false),
    opensAt: clockTime.nullish().transform((value) => value ?? null),
    closesAt: clockTime.nullish().transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    if (value.closed) return
    if (!value.opensAt || !value.closesAt) ctx.addIssue({ code: 'custom', path: ['opensAt'], message: 'Enter opening and closing times, or mark the day closed.' })
    else if (value.closesAt <= value.opensAt) ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Closing time must be after opening.' })
  })

export const profileSchema = z.object({
  businessName: text('the business name', 120),
  street: text('the street address', 240),
  city: text('the city', 80),
  state: text('the state', 80),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter the 6-digit PIN code.'),
  description: z.string().trim().max(750, 'Google allows at most 750 characters.').default(''),
  primaryCategory: z.enum(PROFILE_CATEGORIES, { error: 'Choose the primary category.' }),
  secondaryCategory: z.enum(PROFILE_CATEGORIES).nullish().transform((value) => value ?? null),
  phone: z.union([z.literal(''), z.string().trim().regex(/^[6-9]\d{9}$|^0\d{9,10}$/, 'Enter a 10-digit mobile or a landline with STD code.')]).nullish().transform((value) => value || null),
  websiteUrl: httpsUrl('website address'),
  reviewUrl: httpsUrl('review link'),
  googleLocation: z.union([z.literal(''), z.string().trim().regex(/^locations\/\d{5,30}$/, 'Choose the Google location.')]).nullish().transform((value) => value || null),
  specialHours: z.array(specialHours).max(60).default([]).refine((list) => new Set(list.map((entry) => entry.date)).size === list.length, 'Each date can have one special-hours entry.'),
  // The current version, or omitted when creating the profile.
  version: version.optional(),
})

export const syncProfileSchema = z.object({ confirm: z.literal(true, { error: 'Confirm what will be published to Google.' }), version })

export const listReviewsSchema = pagination(100).extend({
  q: z.string().trim().max(100).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  response: z.enum(['none', 'draft', 'in_review', 'posting', 'posted', 'failed', 'replied']).optional(),
  escalated: z.enum(['true', 'false']).optional(),
  branchId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
})

export const responseSchema = z.object({ text: text('the reply', 4000), version: version.optional() })
export const submitResponseSchema = z.object({ version })
export const decideResponseSchema = z.object({ decision: z.enum(['approve', 'reject']), note: optionalText(500), version })
  .refine((value) => value.decision === 'approve' || Boolean(value.note), { path: ['note'], message: 'Say what needs to change.' })
export const noteSchema = z.object({ text: text('the note', 2000) })

const SEVERITIES = ['low', 'medium', 'high'] as const
const STATUSES = ['open', 'in_progress', 'resolved'] as const

export const escalationSchema = z.object({
  reviewId: uuid,
  topic: text('the topic', 120),
  severity: z.enum(SEVERITIES, { error: 'Choose the severity.' }),
  ownerMembershipId: uuid,
  dueDate: isoDate,
  dueTime: clockTime.default('17:00'),
  note: z.string().trim().max(2000).default(''),
})

export const updateEscalationSchema = z.object({
  topic: text('the topic', 120),
  severity: z.enum(SEVERITIES),
  ownerMembershipId: uuid,
  dueDate: isoDate,
  dueTime: clockTime,
  status: z.enum(STATUSES),
  note: z.string().trim().max(2000).default(''),
  version,
})

export const listEscalationsSchema = pagination(100).extend({
  q: z.string().trim().max(100).optional(),
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(STATUSES).optional(),
  ownerId: uuid.optional(),
  reviewId: uuid.optional(),
})

export const reportSchema = z.object({ from: isoDate, to: isoDate, branchId: uuid.optional(), rating: z.coerce.number().int().min(1).max(5).optional() })
  .refine((value) => value.from <= value.to, { path: ['to'], message: 'The end date must not be before the start date.' })

export type ProfileInput = z.infer<typeof profileSchema>
export type ListReviewsQuery = z.infer<typeof listReviewsSchema>
export type EscalationInput = z.infer<typeof escalationSchema>
export type UpdateEscalationInput = z.infer<typeof updateEscalationSchema>
export type ListEscalationsQuery = z.infer<typeof listEscalationsSchema>
export type ReportQuery = z.infer<typeof reportSchema>
