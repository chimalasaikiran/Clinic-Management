import { api, apiUrl } from '../../lib/api'
import { queryString } from '../patients/api'

// What the header and sidebar read: the branches, open items for the alerts (backend/src/modules/dashboard),
// the search (backend/src/modules/search) and the backend's readiness check (backend/src/modules/health).
export const workspaceApi = {
  branches: () => api('/v1/branches'),
  alerts: ({ branchId } = {}) => api(`/v1/alerts${queryString({ branchId })}`),
  search: (q) => api(`/v1/search${queryString({ q })}`),
  notifications: () => api('/v1/notifications', { meta: true }),
  markNotificationsRead: (body) => api('/v1/notifications/read', { method: 'POST', body }),
  // Live "something changed" events; null where the browser has no EventSource.
  stream: (orgId) => (typeof EventSource === 'undefined' ? null : new EventSource(apiUrl(`/v1/events/stream${queryString({ orgId })}`), { withCredentials: true })),
  health: () => api('/health/ready', { org: false }),
}
