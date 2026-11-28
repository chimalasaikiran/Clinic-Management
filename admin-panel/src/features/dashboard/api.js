import { api } from '../../lib/api'
import { queryString } from '../patients/api'

// The dashboard endpoints (backend/src/modules/dashboard).
export const dashboardApi = {
  day: ({ date, branchId } = {}) => api(`/v1/dashboard/day${queryString({ date, branchId })}`),
  overview: ({ date, branchId } = {}) => api(`/v1/dashboard${queryString({ date, branchId })}`),
}
