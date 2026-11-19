import { stampOf } from './leadsView'

export const CHANNELS = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' }
export const LOCALES = { en: 'English · en', hi: 'Hindi · hi', te: 'Telugu · te' }
export const TEMPLATE_CATEGORIES = ['Reminder', 'Follow-up', 'Review request', 'Prevention']
export const TEMPLATE_STATUS = { draft: 'Draft', approved: 'Approved', retired: 'Retired' }
export const TEMPLATE_VARIABLES = ['preferred_name', 'appointment_date', 'appointment_time', 'service_name', 'clinic_name']
// Filled in by ClinicOS when sending; staff supply the rest.
export const AUTOMATIC_VARIABLES = ['preferred_name', 'clinic_name']
export const CONSENT_SOURCES = { verbal: 'Told us (phone or in person)', written_form: 'Signed form', web_form: 'Website form', inbound_reply: 'Replied asking to hear from us', stop_reply: 'Replied STOP', start_reply: 'Replied START' }

export const MESSAGE_STATUS = {
  queued: ['Queued', 'neutral'],
  sending: ['Sending', 'neutral'],
  sent: ['Sent', 'info'],
  delivered: ['Delivered', 'success'],
  read: ['Read', 'success'],
  failed: ['Failed', 'danger'],
  unknown: ['Outcome unknown', 'warning'],
  received: ['Received', 'neutral'],
}

export const CHANNEL_STATUS = { not_connected: ['Not connected', 'warning'], connected: ['Connected', 'success'], error: ['Needs attention', 'danger'] }

export const BLOCK_HINTS = {
  CHANNEL_NOT_CONNECTED: 'Connect this channel on the Channels screen first.',
  CONSENT_REQUIRED: 'Record the contact’s permission in Communication history first.',
  CONSENT_WITHDRAWN: 'This contact opted out on this channel.',
  TEMPLATE_REQUIRED: 'Choose an approved template.',
}

// Who the conversation is with, as far as the person viewing may see.
export function contactName(conversation) {
  if (conversation.lead) return conversation.lead.fullName
  if (conversation.patient?.fullName) return conversation.patient.fullName
  if (conversation.patient) return 'Linked patient'
  return 'Unknown contact'
}

const mask = (channel, address) => (channel === 'email' ? address.replace(/^(.).*(@.*)$/, '$1•••$2') : `•••••${address.slice(-5)}`)

export function toConversationView(conversation) {
  return {
    id: conversation.id,
    number: conversation.number,
    channel: CHANNELS[conversation.channel],
    channelId: conversation.channel,
    address: conversation.address,
    // Lists show only the last digits, so a phone number is not on screen for everyone walking past.
    maskedAddress: mask(conversation.channel, conversation.address),
    contact: contactName(conversation),
    lead: conversation.lead,
    patient: conversation.patient,
    linked: Boolean(conversation.lead || conversation.patient),
    branch: conversation.branch?.name ?? 'No branch yet',
    status: conversation.status === 'open' ? 'Open' : 'Resolved',
    unread: conversation.unread,
    owner: conversation.owner,
    last: stampOf(conversation.lastMessageAt ?? conversation.createdAt),
    preview: conversation.preview ?? 'No messages yet',
    replyWindowOpen: conversation.replyWindowOpen,
    version: conversation.version,
  }
}

export function toMessageView(message) {
  const [label, tone] = MESSAGE_STATUS[message.status]
  return {
    id: message.id,
    inbound: message.direction === 'inbound',
    body: message.body,
    subject: message.subject,
    status: message.status,
    statusLabel: label,
    tone,
    at: stampOf(message.createdAt),
    template: message.template ? `${message.template.code} · ${message.template.name} · v${message.templateVersion}` : null,
    sentBy: message.sentBy,
    error: message.errorMessage,
    errorCode: message.errorCode,
    attempts: message.attempts,
    nextAttemptAt: stampOf(message.nextAttemptAt),
    receipts: [['Sent', message.sentAt], ['Delivered', message.deliveredAt], ['Read', message.readAt], ['Failed', message.failedAt]].filter(([, at]) => at).map(([name, at]) => ({ name, at: stampOf(at) })),
  }
}

export const templateVariables = (body) => [...new Set([...body.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]))]
export const unknownVariables = (body) => templateVariables(body).filter((name) => !TEMPLATE_VARIABLES.includes(name))
export const renderTemplate = (body, values) => body.replace(/{{\s*(\w+)\s*}}/g, (token, name) => values[name] || token)
