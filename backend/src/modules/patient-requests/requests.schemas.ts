import { z } from 'zod'
import { pagination, uuid } from '../../common/validation/validation'

const optionalNote = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullish()
    .transform((value) => value || null)

// ── Refills ──

export const refillRequestSchema = z.object({ note: optionalNote(500) })

export const refillDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'decline'], { error: 'Choose approve or decline.' }),
    note: optionalNote(500),
    version: z.number().int().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'decline' && (!value.note || value.note.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Tell the patient why (at least 5 characters). They will see this.' })
    }
  })

export const refillQueueSchema = pagination(100).extend({
  status: z.enum(['requested', 'approved', 'declined', 'cancelled', 'all']).default('requested'),
  branchId: uuid.optional(),
})

// ── Help requests ──

export const SUPPORT_CATEGORIES = ['Account & Login', 'Appointments', 'Clinic Connect', 'Health Records', 'Prescriptions & Reports', 'Notifications', 'Privacy & Data', 'Technical Problem', 'Other'] as const

const messageBody = (min: number) =>
  z
    .string({ error: 'Write your message.' })
    .trim()
    .min(min, min > 1 ? `Write at least ${min} characters.` : 'Write your message.')
    .max(2000, 'Use at most 2000 characters.')

export const openTicketSchema = z.object({
  // The connected clinic record the request is about (a link from GET /patient/links).
  linkId: uuid,
  category: z.enum(SUPPORT_CATEGORIES, { error: 'Choose the closest topic.' }),
  subject: z.string({ error: 'Enter a subject.' }).trim().min(3, 'Enter a subject.').max(120, 'Use at most 120 characters.'),
  body: messageBody(20),
})

export const patientMessageSchema = z.object({ body: messageBody(1) })

export const staffReplySchema = z.object({
  body: messageBody(1),
  // Reply and close the request in one step.
  resolve: z.boolean().default(false),
})

export const ticketStatusSchema = z.object({ status: z.enum(['open', 'resolved']) })

export const ticketQueueSchema = pagination(100).extend({
  status: z.enum(['open', 'answered', 'resolved', 'active', 'all']).default('active'),
  branchId: uuid.optional(),
  query: z.string().trim().max(100).optional(),
})

export const patientListSchema = pagination(50)

export type RefillDecisionInput = z.infer<typeof refillDecisionSchema>
export type RefillQueueQuery = z.infer<typeof refillQueueSchema>
export type OpenTicketInput = z.infer<typeof openTicketSchema>
export type StaffReplyInput = z.infer<typeof staffReplySchema>
export type TicketQueueQuery = z.infer<typeof ticketQueueSchema>
export type PatientListQuery = z.infer<typeof patientListSchema>
