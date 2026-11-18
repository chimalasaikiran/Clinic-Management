import { api } from '../../lib/api'

const post = (path, body) => api(path, { method: 'POST', body })
const put = (path, body) => api(path, { method: 'PUT', body })
const patch = (path, body) => api(path, { method: 'PATCH', body })

// Payroll endpoints (backend/src/modules/payroll). PayrollProvider reloads the state after each change, so every
// screen shows the figures the server worked out.
export const payrollApi = {
  state: () => api('/v1/payroll/state'),

  saveSettings: (body) => put('/v1/payroll/settings', body),
  createProfile: (body) => post('/v1/payroll/profiles', body),
  updateProfile: (id, body) => patch(`/v1/payroll/profiles/${id}`, body),
  verifyBank: (id, version) => post(`/v1/payroll/profiles/${id}/verify-bank`, { version }),

  startCycle: (month) => post('/v1/payroll/cycles', { month }),
  setScope: (id, body) => put(`/v1/payroll/cycles/${id}/scope`, body),
  include: (id, entryIds, included) => post(`/v1/payroll/cycles/${id}/include`, { entryIds, included }),
  approve: (id, version) => post(`/v1/payroll/cycles/${id}/approve`, { version }),
  process: (id, version) => post(`/v1/payroll/cycles/${id}/process`, { version }),
  updateEntry: (id, body) => patch(`/v1/payroll/entries/${id}`, body),
  recordPayment: (id, body) => post(`/v1/payroll/entries/${id}/payment`, body),

  createAdjustment: (body) => post('/v1/payroll/adjustments', body),
  decideAdjustments: (body) => post('/v1/payroll/adjustments/decide', body),
  createAdvance: (body) => post('/v1/payroll/advances', body),
  advanceAction: (id, body) => post(`/v1/payroll/advances/${id}/action`, body),
}
