import { z } from 'zod'
import { clockTime, isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'

const version = z.number().int().min(1)
const text = (label: string, max: number) => z.string({ error: `Enter ${label}.` }).trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`)
export const CONTENT_CATEGORIES = ['Prevention', 'Health education', 'Clinic announcements', 'Offers'] as const
const targets = z.array(z.enum(['facebook', 'instagram'])).min(1, 'Choose Facebook, Instagram or both.').max(2).transform((list) => [...new Set(list)])

export const contentSchema = z.object({
  title: text('a title', 120),
  category: z.enum(CONTENT_CATEGORIES, { error: 'Choose a category.' }),
  branchId: uuid,
  ownerMembershipId: uuid,
  caption: text('the caption', 2000),
  targets,
  cta: text('the call to action', 120),
  url: z.string().trim().max(500).regex(/^https:\/\/\S+\.\S+$/, 'Enter an https:// destination URL.'),
  altText: text('alt text for the image', 1000),
  mediaId: uuid.nullish().transform((value) => value ?? null),
  templateId: uuid.nullish().transform((value) => value ?? null),
  // Intended time, in clinic time; submitting can change it.
  date: isoDate,
  time: clockTime,
  rightsReviewed: z.boolean().default(false),
})

export const updateContentSchema = contentSchema.extend({ version })

export const submitContentSchema = z.object({
  date: isoDate,
  time: clockTime,
  // The submitter confirms the image may be used and the wording was checked.
  rightsReviewed: z.literal(true, { error: 'Confirm the image rights and wording were reviewed.' }),
  version,
})

export const decideContentSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: optionalText(500),
  version,
}).refine((value) => value.decision === 'approve' || Boolean(value.note), { path: ['note'], message: 'Say what needs to change.' })

export const resolvePublicationSchema = z.object({ outcome: z.enum(['published', 'failed']), note: text('what the provider shows', 300) })

export const listContentSchema = pagination(500).extend({
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'in_review', 'scheduled', 'publishing', 'published', 'failed']).optional(),
  target: z.enum(['facebook', 'instagram']).optional(),
  branchId: uuid.optional(),
})

export const contentTemplateSchema = z.object({
  title: text('a title', 120),
  category: z.enum(CONTENT_CATEGORIES, { error: 'Choose a category.' }),
  body: text('the template copy', 2000),
  cta: text('the call to action', 120),
  targets,
})

export const updateContentTemplateSchema = contentTemplateSchema.extend({ archived: z.boolean().default(false), version })

export type ContentInput = z.infer<typeof contentSchema>
export type UpdateContentInput = z.infer<typeof updateContentSchema>
export type SubmitContentInput = z.infer<typeof submitContentSchema>
export type DecideContentInput = z.infer<typeof decideContentSchema>
export type ListContentQuery = z.infer<typeof listContentSchema>
export type ContentTemplateInput = z.infer<typeof contentTemplateSchema>
export type UpdateContentTemplateInput = z.infer<typeof updateContentTemplateSchema>
