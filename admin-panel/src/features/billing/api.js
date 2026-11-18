import { api } from '../../lib/api'
import { queryString } from '../patients/api'

const post = (path, body) => api(path, { method: 'POST', body })

// Billing & finance endpoints (backend/src/modules/billing). Every change returns ids only; the provider reloads
// the ledger afterwards so all screens show the same, server-computed state.
export const billingApi = {
  ledger: (patientId) => api(`/v1/billing/ledger${queryString({ patientId })}`),

  createService: (service) => post('/v1/billing/services', service),
  updateService: (id, version, service) => api(`/v1/billing/services/${id}`, { method: 'PATCH', body: { version, service } }),
  setServiceStatus: (id, body) => post(`/v1/billing/services/${id}/status`, body),
  saveSettings: (body) => api('/v1/billing/settings', { method: 'PUT', body }),

  createCharge: (body) => post('/v1/billing/charges', body),
  updateCharge: (id, body) => api(`/v1/billing/charges/${id}`, { method: 'PATCH', body }),
  createInvoice: (body) => post('/v1/billing/invoices', body),

  recordPayment: (body) => post('/v1/billing/payments', body),
  allocate: (paymentId, body) => post(`/v1/billing/payments/${paymentId}/allocations`, body),

  requestRefund: (body) => post('/v1/billing/refunds', body),
  approveRefund: (id, body) => post(`/v1/billing/refunds/${id}/approve`, body),
  rejectRefund: (id, body) => post(`/v1/billing/refunds/${id}/reject`, body),
  processRefund: (id, body) => post(`/v1/billing/refunds/${id}/process`, body),
  failRefund: (id, body) => post(`/v1/billing/refunds/${id}/fail`, body),

  importStatement: (body) => post('/v1/billing/statements', body),
  confirmLine: (id, note = '') => post(`/v1/billing/statement-lines/${id}/confirm`, { note }),
  rejectLine: (id, note = '') => post(`/v1/billing/statement-lines/${id}/reject`, { note }),
  reviewException: (id, version) => post(`/v1/billing/exceptions/${id}/review`, { version }),
  recordEvidence: (id, body) => post(`/v1/billing/exceptions/${id}/evidence`, body),
  resolveException: (id, body) => post(`/v1/billing/exceptions/${id}/resolve`, body),
}
