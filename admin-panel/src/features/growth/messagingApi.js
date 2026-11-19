import { api, apiUrl } from '../../lib/api'
import { queryString } from '../patients/api'

const send = (path, method, body) => api(path, { method, body })

// The messaging endpoints (backend/src/modules/messaging).
export const messagingApi = {
  channels: () => api('/v1/messaging/channels'),
  saveChannel: (channel, body) => send(`/v1/messaging/channels/${channel}`, 'PUT', body),
  disconnect: (channel) => send(`/v1/messaging/channels/${channel}`, 'DELETE'),
  templates: () => api('/v1/messaging/templates'),
  createTemplate: (body) => send('/v1/messaging/templates', 'POST', body),
  updateTemplate: (id, body) => send(`/v1/messaging/templates/${id}`, 'PATCH', body),
  consent: (channel, address) => api(`/v1/messaging/consents${queryString({ channel, address })}`),
  recordConsent: (body) => send('/v1/messaging/consents', 'POST', body),
  problems: (query) => api(`/v1/messaging/messages${queryString(query)}`, { meta: true }),
  retry: (id) => send(`/v1/messaging/messages/${id}/retry`, 'POST'),
  resolve: (id, body) => send(`/v1/messaging/messages/${id}/resolve`, 'POST', body),
  conversations: (query) => api(`/v1/conversations${queryString(query)}`, { meta: true }),
  conversation: (id) => api(`/v1/conversations/${id}`),
  start: (body) => send('/v1/conversations', 'POST', body),
  updateConversation: (id, body) => send(`/v1/conversations/${id}`, 'PATCH', body),
  link: (id, body) => send(`/v1/conversations/${id}/link`, 'POST', body),
  addNote: (id, text) => send(`/v1/conversations/${id}/notes`, 'POST', { text }),
  sendMessage: (id, body) => send(`/v1/conversations/${id}/messages`, 'POST', body),
  // Live "something changed" events for the inbox; null where the browser has no EventSource.
  stream: (orgId) => (typeof EventSource === 'undefined' ? null : new EventSource(apiUrl(`/v1/messaging/stream${queryString({ orgId })}`), { withCredentials: true })),
}
