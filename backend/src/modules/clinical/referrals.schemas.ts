import { z } from 'zod'
import { uuid } from '../../common/validation/validation'

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)
const optional = (max: number) => z.string().trim().max(max).default('')
const note = (message: string) => z.string({ error: message }).trim().min(10, message).max(2000, 'Use at most 2000 characters.')

// Priority tiers and the hours the receiving side has to respond.
export const REFERRAL_PRIORITIES = {
  'Routine (within 2 weeks)': 336,
  'High / Expedited (48h)': 48,
  'Urgent / Emergency (same day)': 8,
} as const

// What a follow-up call found out, and the status it leaves the referral in.
export const FOLLOW_UP_OUTCOMES = {
  awaiting: { status: 'pending_acceptance', title: 'Awaiting Clinical Review' },
  accepted: { status: 'accepted', title: 'Acceptance Confirmed' },
  info: { status: 'info_requested', title: 'Additional Information Requested' },
  declined: { status: 'declined', title: 'Referral Declined / Capacity Constraint' },
  noanswer: { status: 'pending_acceptance', title: 'No Answer / Line Busy' },
} as const

export const FOLLOW_UP_METHODS = { phone: 'Phone call', hie: 'ABDM HIE message', email: 'Clinical email', other: 'Other contact' } as const

const shared = {
  encounterId: uuid.optional(),
  priority: z.enum(Object.keys(REFERRAL_PRIORITIES) as [keyof typeof REFERRAL_PRIORITIES], { error: 'Choose a priority tier.' }),
  model: text(80, 'Choose the referral model.'),
  specialty: text(120, 'Give the specialty.'),
  indication: text(500, 'Enter the primary clinical indication.'),
  narrative: note('Add a clinical narrative (at least 10 characters).'),
  questions: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  attachedRecords: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
}

export const createReferralSchema = z.discriminatedUnion('direction', [
  // To one of the clinic's own therapists, or to an outside clinician or facility.
  z
    .object({
      direction: z.literal('outgoing'),
      ...shared,
      targetPractitionerId: uuid.optional(),
      facility: optional(240),
      facilityNote: optional(240),
    })
    .refine((value) => value.targetPractitionerId || value.facility, { message: 'Choose a destination specialist or facility.', path: ['facility'] }),
  // Received from elsewhere, recorded by the clinic for triage.
  z.object({
    direction: z.literal('incoming'),
    ...shared,
    clinician: text(160, 'Give the referring clinician.'),
    clinicianNote: optional(240),
    facility: text(240, 'Give the requested branch or service.'),
    facilityNote: optional(240),
  }),
])

export const followUpSchema = z.object({
  method: z.enum(Object.keys(FOLLOW_UP_METHODS) as [keyof typeof FOLLOW_UP_METHODS]),
  representative: text(160, 'Enter the receiving representative.'),
  staff: text(160, 'Enter the recording staff member.'),
  outcome: z.enum(Object.keys(FOLLOW_UP_OUTCOMES) as [keyof typeof FOLLOW_UP_OUTCOMES], { error: 'Select a contact outcome.' }),
  notes: note('Record the conversation (at least 10 characters).'),
})

export const triageSchema = z.object({
  decision: z.enum(['accept', 'decline']),
  note: z.string().trim().max(1000).default(''),
})

export type CreateReferralInput = z.infer<typeof createReferralSchema>
export type FollowUpInput = z.infer<typeof followUpSchema>
