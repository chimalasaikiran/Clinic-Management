import { z } from 'zod'
import { optionalText, pagination, uuid } from '../../common/validation/validation'

export const CHANNELS = ['whatsapp', 'sms', 'email'] as const
const channel = z.enum(CHANNELS, { error: 'Choose WhatsApp, SMS or email.' })
const version = z.number().int().min(1)
const text = (label: string, max: number) => z.string({ error: `Enter ${label}.` }).trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`)
// A secret field left empty on an update keeps the saved value.
const secret = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined)

export const whatsappChannelSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, 'Enter the numeric phone number ID from Meta.'),
  businessAccountId: z.string().trim().regex(/^\d{5,30}$/, 'Enter the numeric WhatsApp Business account ID.').optional().or(z.literal('').transform(() => undefined)),
  accessToken: secret(1000),
  appSecret: secret(200),
})

export const smsChannelSchema = z.object({
  senderId: z.string().trim().regex(/^[A-Z]{6}$/, 'Use the 6-letter DLT sender ID, for example AURAHC.'),
  entityId: z.string().trim().regex(/^\d{10,25}$/, 'Enter the numeric DLT principal entity ID.').optional().or(z.literal('').transform(() => undefined)),
  authKey: secret(200),
})

export const emailChannelSchema = z.object({
  host: text('the SMTP host', 200),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().default(true),
  user: text('the SMTP user name', 200),
  fromAddress: z.string().trim().toLowerCase().pipe(z.email('Enter the address messages are sent from.')),
  fromName: optionalText(80),
  password: secret(500),
})

export const templateSchema = z.object({
  name: text('a display name', 120),
  category: z.enum(['Reminder', 'Follow-up', 'Review request', 'Prevention']),
  channel,
  locale: z.enum(['en', 'hi', 'te']),
  subject: optionalText(160),
  body: text('the message body', 2000),
  providerRef: optionalText(120),
})

export const updateTemplateSchema = templateSchema.extend({
  status: z.enum(['draft', 'approved', 'retired']),
  changeNote: text('a change reason', 500),
  version,
})

export const consentSchema = z.object({
  channel,
  address: z.string().trim().min(3).max(254),
  status: z.enum(['granted', 'withdrawn']),
  source: z.enum(['verbal', 'written_form', 'web_form', 'inbound_reply'], { error: 'Choose how permission was given or withdrawn.' }),
  note: optionalText(500),
  leadId: uuid.optional(),
  patientId: uuid.optional(),
})

export const consentQuerySchema = z.object({ channel, address: z.string().trim().min(3).max(254) })

export const startConversationSchema = z
  .object({ channel, leadId: uuid.optional(), patientId: uuid.optional() })
  .refine((value) => Boolean(value.leadId) !== Boolean(value.patientId), { message: 'Start a conversation from one lead or one patient.', path: ['leadId'] })

export const listConversationsSchema = pagination(100).extend({
  q: z.string().trim().max(100).optional(),
  channel: channel.optional(),
  status: z.enum(['open', 'resolved']).optional(),
  ownerId: uuid.optional(),
  unread: z.enum(['true', 'false']).optional(),
  linked: z.enum(['true', 'false']).optional(),
  branchId: uuid.optional(),
})

export const updateConversationSchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  unread: z.boolean().optional(),
  ownerMembershipId: uuid.nullable().optional(),
  version,
})

export const linkConversationSchema = z
  .object({ leadId: uuid.optional(), patientId: uuid.optional(), version })
  .refine((value) => Boolean(value.leadId) !== Boolean(value.patientId), { message: 'Link one lead or one patient.', path: ['leadId'] })

export const sendMessageSchema = z
  .object({
    templateId: uuid.optional(),
    // Values for the template's variables other than preferred_name, which ClinicOS fills in.
    variables: z.record(z.string(), z.string().trim().max(200)).default({}),
    body: optionalText(4000),
  })
  .refine((value) => Boolean(value.templateId) !== Boolean(value.body), { message: 'Choose a template or write a reply.', path: ['body'] })

export const noteSchema = z.object({ text: text('the note', 2000) })

export const listMessagesSchema = pagination(100).extend({
  status: z.enum(['failed', 'unknown', 'queued']).optional(),
  channel: channel.optional(),
})

export const resolveMessageSchema = z.object({ outcome: z.enum(['sent', 'failed']), note: text('what you checked with the provider', 500) })

export type WhatsAppChannelInput = z.infer<typeof whatsappChannelSchema>
export type SmsChannelInput = z.infer<typeof smsChannelSchema>
export type EmailChannelInput = z.infer<typeof emailChannelSchema>
export type TemplateInput = z.infer<typeof templateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type ConsentInput = z.infer<typeof consentSchema>
export type ListConversationsQuery = z.infer<typeof listConversationsSchema>
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type ListMessagesQuery = z.infer<typeof listMessagesSchema>
