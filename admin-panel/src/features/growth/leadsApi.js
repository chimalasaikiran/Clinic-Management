import { api } from '../../lib/api'
import { queryString } from '../patients/api'

// The leads endpoints (backend/src/modules/leads).
export const leadsApi = {
  list: (query) => api(`/v1/leads${queryString(query)}`, { meta: true }),
  get: (id) => api(`/v1/leads/${id}`),
  owners: (branchId) => api(`/v1/leads/owners${queryString({ branchId })}`),
  duplicates: (mobile, excludeId) => api(`/v1/leads/duplicates${queryString({ mobile, excludeId })}`),
  performance: (query) => api(`/v1/leads/performance${queryString(query)}`),
  create: (body) => api('/v1/leads', { method: 'POST', body }),
  update: (id, body) => api(`/v1/leads/${id}`, { method: 'PATCH', body }),
  recordInteraction: (id, body) => api(`/v1/leads/${id}/interactions`, { method: 'POST', body }),
  setDisposition: (id, body) => api(`/v1/leads/${id}/disposition`, { method: 'POST', body }),
  convert: (id, body) => api(`/v1/leads/${id}/convert`, { method: 'POST', body }),
  convertToNewPatient: (id, body) => api(`/v1/leads/${id}/convert/new-patient`, { method: 'POST', body }),
}
