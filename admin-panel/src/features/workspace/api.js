import { api } from '../../lib/api'
import { queryString } from '../patients/api'

// What the header and sidebar read: the branches, open items for the alerts (backend/src/modules/dashboard),
// the search (backend/src/modules/search) and the backend's readiness check (backend/src/modules/health).
export const workspaceApi = {
  branches: () => api('/v1/branches'),
  alerts: ({ branchId } = {}) => api(`/v1/alerts${queryString({ branchId })}`),
  search: (q) => api(`/v1/search${queryString({ q })}`),
  health: () => api('/health/ready', { org: false }),
}
