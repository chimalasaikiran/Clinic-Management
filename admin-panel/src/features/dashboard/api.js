import { api } from '../../lib/api'
import { queryString } from '../patients/api'

// The owner dashboard endpoint (backend/src/modules/dashboard).
export const dashboardApi = {
  overview: ({ date, branchId } = {}) => api(`/v1/dashboard${queryString({ date, branchId })}`),
}
