import type { MessageChannel, MessageStatus } from '../../generated/prisma/client'

export const CHANNEL_LABELS: Record<MessageChannel, string> = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' }

// Variables a template may use; ClinicOS fills preferred_name, staff supply the rest when sending.
export const TEMPLATE_VARIABLES = ['preferred_name', 'appointment_date', 'appointment_time', 'service_name', 'clinic_name'] as const

// Reminders about a patient's own care may use the patient's notification settings; everything else is
// marketing and needs a recorded opt-in.
export const CARE_CATEGORIES = ['Reminder']

const WHATSAPP_WINDOW_MS = 24 * 3_600_000
const MAX_ATTEMPTS = 5

// A 10-digit Indian mobile from "+91 98480 22110", "919848022110" or "09848022110"; a lower-cased email otherwise.
export function normaliseAddress(channel: MessageChannel, raw: string): string | null {
  const value = raw.trim()
  if (channel === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : null
  const digits = value.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

// The provider's form of an address: WhatsApp and MSG91 take the country code without "+".
export const providerAddress = (channel: MessageChannel, address: string) => (channel === 'email' ? address : `91${address}`)

// Variable names in the order they first appear: the order WhatsApp {{1}}, {{2}} and MSG91 var1, var2 use.
export function templateVariables(body: string): string[] {
  return [...new Set([...body.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]!))]
}

export const unknownVariables = (body: string) => templateVariables(body).filter((name) => !(TEMPLATE_VARIABLES as readonly string[]).includes(name))

export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/{{\s*(\w+)\s*}}/g, (token, name: string) => values[name] ?? token)
}

// The variables still missing a value, so a message is never sent with "{{appointment_date}}" in it.
export const missingVariables = (body: string, values: Record<string, string>) => templateVariables(body).filter((name) => !values[name]?.trim())

// WhatsApp only allows a free-text message within 24 hours of the contact's last message.
export const whatsappWindowOpen = (lastInboundAt: Date | null, now = new Date()) => Boolean(lastInboundAt && now.getTime() - lastInboundAt.getTime() < WHATSAPP_WINDOW_MS)

export type SendBlock =
  | 'CONSENT_WITHDRAWN'
  | 'CONSENT_REQUIRED'
  | 'TEMPLATE_REQUIRED'
  | 'TEMPLATE_NOT_APPROVED'

interface SendCheck {
  channel: MessageChannel
  // Latest recorded consent for this address and channel, if any.
  consent: 'granted' | 'withdrawn' | null
  // A free-text reply rather than a template.
  freeText: boolean
  template: { category: string; status: string; providerRef: string | null } | null
  // The patient's WhatsApp / SMS notification setting, when the contact is a patient.
  patientNotifications: boolean | null
  windowOpen: boolean
}

// Why a message may not be sent, or null when it may.
export function sendBlock(check: SendCheck): SendBlock | null {
  if (check.consent === 'withdrawn') return 'CONSENT_WITHDRAWN'
  if (check.freeText) {
    // SMS in India goes only through DLT-registered templates; WhatsApp outside the reply window likewise.
    if (check.channel === 'sms' || (check.channel === 'whatsapp' && !check.windowOpen)) return 'TEMPLATE_REQUIRED'
    // Answering someone who has just written to the clinic is not marketing.
    if (check.channel === 'whatsapp') return null
    return check.consent === 'granted' ? null : 'CONSENT_REQUIRED'
  }
  const template = check.template!
  if (template.status !== 'approved' || (check.channel !== 'email' && !template.providerRef)) return 'TEMPLATE_NOT_APPROVED'
  if (check.consent === 'granted') return null
  const care = CARE_CATEGORIES.includes(template.category) && check.patientNotifications === true
  return care ? null : 'CONSENT_REQUIRED'
}

export const BLOCK_MESSAGES: Record<SendBlock, string> = {
  CONSENT_WITHDRAWN: 'This contact has opted out of messages on this channel.',
  CONSENT_REQUIRED: 'Record the contact’s permission for this channel before sending.',
  TEMPLATE_REQUIRED: 'Use an approved template: free text is only allowed as a WhatsApp reply within 24 hours of their last message.',
  TEMPLATE_NOT_APPROVED: 'This template is not approved for sending, or has no provider template reference.',
}

// "STOP" (and the usual variants) opts the sender out of the channel; "START" opts them back in.
export function optKeyword(text: string): 'stop' | 'start' | null {
  const word = text.trim().toLowerCase().replace(/[.!]+$/, '')
  if (['stop', 'unsubscribe', 'stop all', 'opt out', 'optout', 'cancel'].includes(word)) return 'stop'
  if (['start', 'unstop', 'subscribe'].includes(word)) return 'start'
  return null
}

// Receipts can arrive out of order: a late "delivered" must not move a message that was already read back.
const RANK: Partial<Record<MessageStatus, number>> = { queued: 0, sending: 1, unknown: 1, sent: 2, delivered: 3, read: 4 }
export function advances(current: MessageStatus, next: MessageStatus) {
  if (next === 'failed') return current !== 'read' && current !== 'delivered'
  if (current === 'failed') return false
  return (RANK[next] ?? -1) > (RANK[current] ?? -1)
}

// After a temporary failure: 1, 4, 9, 16 minutes, then give up.
export function retryAt(attempts: number, now = new Date()): Date | null {
  return attempts >= MAX_ATTEMPTS ? null : new Date(now.getTime() + attempts * attempts * 60_000)
}

export const preview = (text: string) => (text.length > 140 ? `${text.slice(0, 137)}…` : text)

// Automated messages (broadcasts and workflows) wait outside 9 pm – 9 am clinic time. People replying in the inbox
// are not held back.
export const QUIET_HOURS = { from: 21 * 60, to: 9 * 60 }
export const inQuietHours = (localMinuteOfDay: number) => localMinuteOfDay >= QUIET_HOURS.from || localMinuteOfDay < QUIET_HOURS.to

// Why an automated message to one person was not queued.
export type AutomatedSkip = SendBlock | 'NO_ADDRESS' | 'VARIABLES_MISSING' | 'WEEKLY_CAP'

// Reasons recorded against a skipped person: the sending checks, plus workflow events that no longer apply.
export type SkipReason = AutomatedSkip | 'ALREADY_BOOKED' | 'LEAD_CLOSED' | 'CONVERTED' | 'PATIENT_INACTIVE'

export const SKIP_LABELS: Record<SkipReason, string> = {
  CONSENT_WITHDRAWN: 'Opted out on this channel',
  CONSENT_REQUIRED: 'No recorded permission',
  TEMPLATE_REQUIRED: 'Needs an approved template',
  TEMPLATE_NOT_APPROVED: 'Template not approved',
  NO_ADDRESS: 'No valid mobile or email',
  VARIABLES_MISSING: 'A template value is missing',
  WEEKLY_CAP: 'Weekly message limit reached',
  ALREADY_BOOKED: 'Already booked again',
  LEAD_CLOSED: 'Lead closed',
  CONVERTED: 'Lead already converted',
  PATIENT_INACTIVE: 'Patient record inactive',
}
