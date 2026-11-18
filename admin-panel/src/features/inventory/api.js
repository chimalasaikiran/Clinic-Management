import { api } from '../../lib/api'

const post = (path, body) => api(path, { method: 'POST', body })
const put = (path, body) => api(path, { method: 'PUT', body })
const patch = (path, body) => api(path, { method: 'PATCH', body })

// Inventory and pharmacy endpoints (backend/src/modules/inventory). Changes return ids; StockProvider reloads
// the state afterwards so every screen shows the stock the server holds.
export const inventoryApi = {
  state: () => api('/v1/inventory/state'),

  createItem: (item) => post('/v1/inventory/items', item),
  updateItem: (id, version, item) => patch(`/v1/inventory/items/${id}`, { version, item }),
  createLocation: (body) => post('/v1/inventory/locations', body),
  setLocationActive: (id, active) => put(`/v1/inventory/locations/${id}/active`, { active }),
  createSupplier: (supplier) => post('/v1/inventory/suppliers', supplier),
  updateSupplier: (id, version, supplier) => patch(`/v1/inventory/suppliers/${id}`, { version, supplier }),
  setSupplierActive: (id, body) => put(`/v1/inventory/suppliers/${id}/active`, body),

  createRequest: (body) => post('/v1/inventory/requests', body),
  updateRequest: (id, body) => patch(`/v1/inventory/requests/${id}`, body),
  cancelRequest: (id, body) => post(`/v1/inventory/requests/${id}/cancel`, body),
  reviewRequest: (id, body) => post(`/v1/inventory/requests/${id}/review`, body),
  transferForRequest: (id) => post(`/v1/inventory/requests/${id}/transfer`),

  createTransfer: (body) => post('/v1/inventory/transfers', body),
  updateTransfer: (id, body) => patch(`/v1/inventory/transfers/${id}`, body),
  dispatchTransfer: (id, version) => post(`/v1/inventory/transfers/${id}/dispatch`, { version }),
  receiveTransfer: (id, body) => post(`/v1/inventory/transfers/${id}/receive`, body),
  cancelTransfer: (id, version) => post(`/v1/inventory/transfers/${id}/cancel`, { version }),

  createOrder: (body) => post('/v1/inventory/orders', body),
  createReceipt: (body) => post('/v1/inventory/receipts', body),
  updateReceipt: (id, body) => put(`/v1/inventory/receipts/${id}`, body),
  resolveDiscrepancy: (id, body) => post(`/v1/inventory/receipts/${id}/resolve`, body),
  postReceipt: (id) => post(`/v1/inventory/receipts/${id}/post`),
  createAdjustment: (body) => post('/v1/inventory/adjustments', body),
  updateAdjustment: (id, body) => put(`/v1/inventory/adjustments/${id}`, body),

  dispense: (prescriptionId, body) => post(`/v1/pharmacy/prescriptions/${prescriptionId}/dispense`, body),
  createCase: (body) => post('/v1/pharmacy/cases', body),
  decideCase: (id, body) => post(`/v1/pharmacy/cases/${id}/decide`, body),
}
