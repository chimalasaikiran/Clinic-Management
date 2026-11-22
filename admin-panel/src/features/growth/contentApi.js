import { api, apiUrl, currentOrgId } from '../../lib/api'
import { queryString } from '../patients/api'

const send = (path, method, body) => api(path, { method, body })

// The content, media, business profile, review and integration endpoints
// (backend/src/modules/content, reviews and integrations).
export const contentApi = {
  posts: (query) => api(`/v1/content${queryString(query)}`, { meta: true }),
  post: (id) => api(`/v1/content/${id}`),
  owners: () => api('/v1/content/owners'),
  createPost: (body) => send('/v1/content', 'POST', body),
  updatePost: (id, body) => send(`/v1/content/${id}`, 'PATCH', body),
  submitPost: (id, body) => send(`/v1/content/${id}/submit`, 'POST', body),
  decidePost: (id, body) => send(`/v1/content/${id}/decision`, 'POST', body),
  withdrawPost: (id, version) => send(`/v1/content/${id}/withdraw`, 'POST', { version }),
  retryPost: (id, version) => send(`/v1/content/${id}/retry`, 'POST', { version }),
  resolvePublication: (id, target, body) => send(`/v1/content/${id}/publications/${target}/resolve`, 'POST', body),
  templates: () => api('/v1/content/templates'),
  createTemplate: (body) => send('/v1/content/templates', 'POST', body),
  updateTemplate: (id, body) => send(`/v1/content/templates/${id}`, 'PATCH', body),
  uploadImage: (file) => api('/v1/media', { method: 'POST', body: file, headers: { 'X-File-Name': encodeURIComponent(file.name || 'image') } }),

  profile: (branchId) => api(`/v1/branch-profiles/${branchId}`),
  saveProfile: (branchId, body) => send(`/v1/branch-profiles/${branchId}`, 'PUT', body),
  syncProfile: (branchId, version) => send(`/v1/branch-profiles/${branchId}/sync`, 'POST', { confirm: true, version }),
  googleLocations: () => api('/v1/integrations/google/locations'),

  reviews: (query) => api(`/v1/reviews${queryString(query)}`, { meta: true }),
  review: (id) => api(`/v1/reviews/${id}`),
  saveResponse: (id, body) => send(`/v1/reviews/${id}/response`, 'PUT', body),
  submitResponse: (id, version) => send(`/v1/reviews/${id}/response/submit`, 'POST', { version }),
  decideResponse: (id, body) => send(`/v1/reviews/${id}/response/decision`, 'POST', body),
  addReviewNote: (id, text) => send(`/v1/reviews/${id}/notes`, 'POST', { text }),
  syncReviews: (branchId) => send(`/v1/reviews/sync/${branchId}`, 'POST'),
  report: (query) => api(`/v1/reviews/report${queryString(query)}`),
  escalations: (query) => api(`/v1/reviews/escalations${queryString(query)}`, { meta: true }),
  escalationOwners: () => api('/v1/reviews/escalations/owners'),
  createEscalation: (body) => send('/v1/reviews/escalations', 'POST', body),
  updateEscalation: (id, body) => send(`/v1/reviews/escalations/${id}`, 'PATCH', body),

  integrations: () => api('/v1/integrations'),
  saveIntegration: (provider, body) => send(`/v1/integrations/${provider}`, 'PUT', body),
  disconnectIntegration: (provider) => send(`/v1/integrations/${provider}`, 'DELETE'),

  // For <img src>: image tags cannot send the organisation header, so it goes in the address.
  imageUrl: (mediaId) => apiUrl(`/v1/media/${mediaId}${queryString({ orgId: currentOrgId() })}`),
}
