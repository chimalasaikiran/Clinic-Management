import { ApiError } from '../../lib/api'

// An in-memory stand-in for the messaging endpoints, enough for the Growth messaging screens. `state.calls` records
// each request. Sending rules, encryption, the worker and webhooks are tested in backend/test/integration/messaging.test.ts.

const clone = (value) => structuredClone(value)
const NOW = () => new Date().toISOString()

export const apiChannel = (channel, overrides = {}) => ({ channel, status: 'not_connected', config: {}, saved: {}, verifiedAt: null, lastError: null, webhook: null, encryptionReady: true, version: 0, ...overrides })

export const apiTemplate = (overrides = {}) => ({
  id: 't-1', code: 'MT-0001', name: 'Follow-up check-in', category: 'Follow-up', channel: 'whatsapp', locale: 'en', subject: null,
  body: 'Hello {{preferred_name}}, are you still looking for help with {{service_name}}?', status: 'approved', providerRef: 'follow_up_v1', version: 2,
  changeNote: 'Approved by Meta', updatedAt: '2026-11-19T05:00:00.000Z', updatedBy: 'Meera Shah', variables: ['preferred_name', 'service_name'], ...overrides,
})

export const apiConversation = (overrides = {}) => ({
  id: 'c-1', number: 'CV-000001', channel: 'whatsapp', address: '9000000002', status: 'open', unread: true,
  lastMessageAt: '2026-11-19T05:30:00.000Z', lastInboundAt: new Date().toISOString(), preview: 'Do you treat frozen shoulder?', version: 1, createdAt: '2026-11-19T05:30:00.000Z',
  branch: null, lead: null, patient: null, owner: null, replyWindowOpen: true,
  messages: [{ id: 'm-1', conversationId: 'c-1', direction: 'inbound', status: 'received', body: 'Do you treat frozen shoulder?', subject: null, templateVersion: null, errorCode: null, errorMessage: null, attempts: 0, nextAttemptAt: null, sentAt: null, deliveredAt: null, readAt: null, failedAt: null, createdAt: '2026-11-19T05:30:00.000Z', template: null, sentBy: null }],
  notes: [], consent: null, channelConnected: true,
  ...overrides,
})

export function createMessagingApi({ channels = [apiChannel('whatsapp', { status: 'connected', verifiedAt: '2026-11-19T05:00:00.000Z', saved: { accessToken: true, appSecret: true }, config: { phoneNumberId: '109876543210' }, webhook: { url: 'https://api.clinic.test/v1/webhooks/whatsapp/tok', verifyToken: 'tok' }, version: 1 }), apiChannel('sms'), apiChannel('email')], templates = [apiTemplate()], conversations = [apiConversation()], consents = [] } = {}) {
  const state = { channels: clone(channels), templates: clone(templates), conversations: clone(conversations), consents: clone(consents), calls: [] }
  const record = (name, ...args) => state.calls.push([name, ...args])
  const find = (id) => {
    const conversation = state.conversations.find((entry) => entry.id === id)
    if (!conversation) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.')
    return conversation
  }
  const fresh = (conversation, version) => {
    if (version !== conversation.version) throw new ApiError(409, 'CONVERSATION_CHANGED', 'Someone else changed this conversation.')
    conversation.version += 1
  }
  const current = (channel, address) => state.consents.filter((entry) => entry.channel === channel && entry.address === address).at(-1)?.status ?? null
  // List rows carry no messages, notes or consent, like the real list.
  const summary = (conversation) => clone({ ...conversation, messages: undefined, notes: undefined, consent: undefined, channelConnected: undefined })
  const full = (conversation) => clone({ ...conversation, consent: current(conversation.channel, conversation.address) })

  const api = {
    async channels() {
      return clone(state.channels)
    },
    async saveChannel(channel, body) {
      record('saveChannel', channel, body)
      const entry = state.channels.find((item) => item.channel === channel)
      Object.assign(entry, { status: 'connected', verifiedAt: NOW(), lastError: null, config: { ...body, authKey: undefined, password: undefined, accessToken: undefined, appSecret: undefined }, version: entry.version + 1 })
      return clone(entry)
    },
    async disconnect(channel) {
      record('disconnect', channel)
      const entry = state.channels.find((item) => item.channel === channel)
      Object.assign(entry, { status: 'not_connected', verifiedAt: null, saved: {}, version: entry.version + 1 })
      return clone(entry)
    },
    async templates() {
      return clone(state.templates)
    },
    async createTemplate(body) {
      record('createTemplate', body)
      const template = apiTemplate({ ...body, id: `t-${state.templates.length + 1}`, code: `MT-${String(state.templates.length + 1).padStart(4, '0')}`, status: 'draft', providerRef: null, version: 1 })
      state.templates.push(template)
      return clone(template)
    },
    async updateTemplate(id, body) {
      record('updateTemplate', id, body)
      const template = state.templates.find((entry) => entry.id === id)
      if (body.version !== template.version) throw new ApiError(409, 'TEMPLATE_CHANGED', 'Someone else changed this template.')
      Object.assign(template, { ...body, version: template.version + 1 })
      return clone(template)
    },
    async consent(channel, address) {
      const entries = state.consents.filter((entry) => entry.channel === channel && entry.address === address).reverse()
      return clone({ channel, address, current: entries[0]?.status ?? null, entries })
    },
    async recordConsent(body) {
      record('recordConsent', body)
      state.consents.push({ id: `k-${state.consents.length + 1}`, channel: body.channel, address: body.address, status: body.status, source: body.source, note: body.note ?? null, createdAt: NOW(), recordedBy: 'Meera Shah' })
      return api.consent(body.channel, body.address)
    },
    async problems(query = {}) {
      record('problems', query)
      const rows = state.conversations.flatMap((conversation) => conversation.messages.filter((message) => (query.status ? message.status === query.status : ['failed', 'unknown'].includes(message.status))).map((message) => ({ ...message, conversation: summary(conversation) })))
      return { data: clone(rows), meta: { page: 1, pageSize: 50, total: rows.length } }
    },
    async retry(id) {
      record('retry', id)
      const message = state.conversations.flatMap((conversation) => conversation.messages).find((entry) => entry.id === id)
      if (message.status === 'unknown') throw new ApiError(409, 'OUTCOME_UNKNOWN', 'Record the outcome before retrying.')
      Object.assign(message, { status: 'queued', errorCode: null, errorMessage: null })
      return clone(message)
    },
    async resolve(id, body) {
      record('resolve', id, body)
      const message = state.conversations.flatMap((conversation) => conversation.messages).find((entry) => entry.id === id)
      Object.assign(message, body.outcome === 'sent' ? { status: 'sent' } : { status: 'failed', errorCode: 'CONFIRMED_NOT_SENT', errorMessage: body.note })
      return clone(message)
    },
    async conversations(query = {}) {
      record('conversations', query)
      const rows = state.conversations.filter((conversation) => (!query.status || conversation.status === query.status) && (!query.unread || String(conversation.unread) === query.unread))
      return { data: rows.map(summary), meta: { page: 1, pageSize: 50, total: rows.length, unread: state.conversations.filter((conversation) => conversation.unread).length, channels: Object.fromEntries(state.channels.map((entry) => [entry.channel, entry.status])) } }
    },
    async conversation(id) {
      return full(find(id))
    },
    async start(body) {
      record('start', body)
      const conversation = apiConversation({ id: `c-${state.conversations.length + 1}`, number: `CV-${String(state.conversations.length + 1).padStart(6, '0')}`, channel: body.channel, lead: { id: body.leadId, number: 'LD-000001', fullName: 'Nisha Menon' }, messages: [], unread: false, preview: null, lastInboundAt: null, replyWindowOpen: false })
      state.conversations.push(conversation)
      return full(conversation)
    },
    async updateConversation(id, body) {
      record('updateConversation', id, body)
      const conversation = find(id)
      fresh(conversation, body.version)
      const { ownerMembershipId, ...fields } = body
      Object.assign(conversation, { ...fields, version: conversation.version })
      if (ownerMembershipId !== undefined) conversation.owner = ownerMembershipId ? { membershipId: ownerMembershipId, name: ownerMembershipId === 'm-2' ? 'Priya Nair' : 'Meera Shah' } : null
      return full(conversation)
    },
    async link(id, body) {
      record('link', id, body)
      const conversation = find(id)
      fresh(conversation, body.version)
      if (body.leadId) conversation.lead = { id: body.leadId, number: 'LD-000002', fullName: 'Rohan Mehta' }
      return full(conversation)
    },
    async addNote(id, text) {
      record('addNote', id, text)
      const conversation = find(id)
      conversation.notes.unshift({ id: `n-${conversation.notes.length + 1}`, text, createdAt: NOW(), author: 'Meera Shah' })
      return full(conversation)
    },
    async sendMessage(id, body) {
      record('sendMessage', id, body)
      const conversation = find(id)
      if (current(conversation.channel, conversation.address) === 'withdrawn') throw new ApiError(422, 'CONSENT_WITHDRAWN', 'This contact has opted out of messages on this channel.')
      const template = body.templateId ? state.templates.find((entry) => entry.id === body.templateId) : null
      const text = template ? template.body.replace(/{{\s*(\w+)\s*}}/g, (token, name) => body.variables?.[name] ?? (name === 'preferred_name' ? 'there' : token)) : body.body
      conversation.messages.push({ ...apiConversation().messages[0], id: `m-${conversation.messages.length + 1}`, direction: 'outbound', status: 'queued', body: text, createdAt: NOW(), template: template ? { id: template.id, code: template.code, name: template.name } : null, templateVersion: template?.version ?? null, sentBy: 'Siddharth Verma' })
      Object.assign(conversation, { unread: false, preview: text, lastMessageAt: NOW() })
      return full(conversation)
    },
    stream: () => null,
  }
  return { api, state }
}
