import { api } from '../../lib/api'
import { queryString } from '../patients/api'

const post = (path, body) => api(path, { method: 'POST', body })

export const staffApi = {
  list: (params) => api(`/v1/staff${queryString(params)}`, { meta: true }),
  summary: () => api('/v1/staff/summary'),
  get: (id) => api(`/v1/staff/${id}`),
  history: (id) => api(`/v1/staff/${id}/history`),
  create: (body) => post('/v1/staff', body),
  update: (id, body) => api(`/v1/staff/${id}`, { method: 'PATCH', body }),
  setBranches: (id, branchIds, primaryBranchId) => api(`/v1/staff/${id}/branches`, { method: 'PUT', body: { branchIds, primaryBranchId } }),
  invite: (id, email, roleIds) => post(`/v1/staff/${id}/invite`, { email, roleIds }),
  attendance: (id, month, branchId) => api(`/v1/staff/${id}/attendance${queryString({ month, branchId })}`),
  recordAttendance: (id, body) => post(`/v1/staff/${id}/attendance`, body),
  correctAttendance: (id, recordId, body) => api(`/v1/staff/${id}/attendance/${recordId}`, { method: 'PATCH', body }),
  leaves: (id) => api(`/v1/staff/${id}/leaves`),
  createLeave: (id, body) => post(`/v1/staff/${id}/leaves`, body),
  cancelLeave: (id, leaveId) => api(`/v1/staff/${id}/leaves/${leaveId}`, { method: 'DELETE' }),
}
