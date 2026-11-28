import { api } from '../../lib/api'
import { queryString } from '../patients/api'

// Requests patients send from the app (backend/src/modules/patient-requests): refills for the pharmacy and
// clinicians, help requests for the front desk.
export const requestsApi = {
  refills: (query = {}) => api(`/v1/refill-requests${queryString(query)}`, { meta: true }),
  decideRefill: (id, body) => api(`/v1/refill-requests/${id}/decision`, { method: 'POST', body }),
  tickets: (query = {}) => api(`/v1/support-tickets${queryString(query)}`, { meta: true }),
  ticket: (id) => api(`/v1/support-tickets/${id}`),
  reply: (id, body) => api(`/v1/support-tickets/${id}/replies`, { method: 'POST', body }),
  setStatus: (id, status) => api(`/v1/support-tickets/${id}/status`, { method: 'POST', body: { status } }),
}
