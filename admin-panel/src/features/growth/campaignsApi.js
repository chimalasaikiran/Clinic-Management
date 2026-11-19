import { api } from '../../lib/api'
import { queryString } from '../patients/api'

const send = (path, method, body) => api(path, { method, body })

// The audience, campaign and workflow endpoints (backend/src/modules/campaigns).
export const campaignsApi = {
  audiences: (query) => api(`/v1/audiences${queryString(query)}`, { meta: true }),
  audience: (id) => api(`/v1/audiences/${id}`),
  countAudience: (body) => send('/v1/audiences/count', 'POST', body),
  createAudience: (body) => send('/v1/audiences', 'POST', body),
  updateAudience: (id, body) => send(`/v1/audiences/${id}`, 'PATCH', body),

  campaigns: (query) => api(`/v1/campaigns${queryString(query)}`, { meta: true }),
  campaign: (id) => api(`/v1/campaigns/${id}`),
  campaignOptions: () => api('/v1/campaigns/options'),
  owners: () => api('/v1/campaigns/owners'),
  createCampaign: (body) => send('/v1/campaigns', 'POST', body),
  updateCampaign: (id, body) => send(`/v1/campaigns/${id}`, 'PATCH', body),
  addSpend: (id, body) => send(`/v1/campaigns/${id}/spend`, 'POST', body),
  previewBroadcast: (id, body) => send(`/v1/campaigns/${id}/broadcasts/preview`, 'POST', body),
  launchBroadcast: (id, body) => send(`/v1/campaigns/${id}/broadcasts`, 'POST', body),
  cancelBroadcast: (id, broadcastId) => send(`/v1/campaigns/${id}/broadcasts/${broadcastId}/cancel`, 'POST'),

  workflows: () => api('/v1/workflows'),
  workflow: (id) => api(`/v1/workflows/${id}`),
  createWorkflow: (body) => send('/v1/workflows', 'POST', body),
  updateWorkflow: (id, body) => send(`/v1/workflows/${id}`, 'PATCH', body),
  activateWorkflow: (id, version) => send(`/v1/workflows/${id}/activate`, 'POST', { version, confirm: true }),
  pauseWorkflow: (id, version) => send(`/v1/workflows/${id}/pause`, 'POST', { version }),
  runs: (query) => api(`/v1/workflows/runs${queryString(query)}`, { meta: true }),
}
