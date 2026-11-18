import { api } from '../../lib/api'
import { queryString } from '../patients/api'

// Owner report endpoints (backend/src/modules/reports).
export const reportsApi = {
  operations: ({ from, to, branchId }) => api(`/v1/reports/operations${queryString({ from, to, branchId })}`),
}
