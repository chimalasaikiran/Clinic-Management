import { api } from '../../lib/api'

// Builds "?a=1&b=2" from the defined, non-empty values only.
export function queryString(params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const post = (path, body) => api(path, { method: 'POST', body })

export const patientsApi = {
  list: (params) => api(`/v1/patients${queryString(params)}`, { meta: true }),
  get: (id) => api(`/v1/patients/${id}`),
  create: (body) => post('/v1/patients', body),
  update: (id, body) => api(`/v1/patients/${id}`, { method: 'PATCH', body }),
  setStatus: (id, status, note) => api(`/v1/patients/${id}/status`, { method: 'PATCH', body: { status, note } }),
  duplicates: (mobile, excludeId) => api(`/v1/patients/duplicates${queryString({ mobile, excludeId })}`),
}

export const appointmentsApi = {
  list: (params) => api(`/v1/appointments${queryString(params)}`, { meta: true }),
  get: (id) => api(`/v1/appointments/${id}`),
  create: (body) => post('/v1/appointments', body),
  confirm: (id) => post(`/v1/appointments/${id}/confirm`),
  checkIn: (id, note) => post(`/v1/appointments/${id}/check-in`, { note }),
  start: (id) => post(`/v1/appointments/${id}/start`),
  complete: (id) => post(`/v1/appointments/${id}/complete`),
  reschedule: (id, body) => post(`/v1/appointments/${id}/reschedule`, body),
  cancel: (id, reason, note) => post(`/v1/appointments/${id}/cancel`, { reason, note }),
  noShow: (id, reason, note) => post(`/v1/appointments/${id}/no-show`, { reason, note }),
}

export const practitionersApi = {
  list: (params) => api(`/v1/practitioners${queryString(params)}`),
  get: (id) => api(`/v1/practitioners/${id}`),
  candidates: () => api('/v1/practitioners/candidates'),
  create: (body) => post('/v1/practitioners', body),
  update: (id, body) => api(`/v1/practitioners/${id}`, { method: 'PATCH', body }),
  setAvailability: (id, windows) => api(`/v1/practitioners/${id}/availability`, { method: 'PUT', body: { windows } }),
  slots: (id, params) => api(`/v1/practitioners/${id}/slots${queryString(params)}`),
}

export const branchesApi = {
  list: () => api('/v1/branches'),
}

export const clinicalApi = {
  chart: (patientId) => api(`/v1/patients/${patientId}/chart`),
  worklist: (date) => api(`/v1/clinical/worklist${queryString({ date })}`),
  startEncounter: (body) => post('/v1/encounters', body),
  updateEncounter: (id, body) => api(`/v1/encounters/${id}`, { method: 'PATCH', body }),
  signEncounter: (id) => post(`/v1/encounters/${id}/sign`),
  recordVitals: (patientId, body) => post(`/v1/patients/${patientId}/vitals`, body),
  addDiagnosis: (patientId, body) => post(`/v1/patients/${patientId}/diagnoses`, body),
  resolveDiagnosis: (id) => post(`/v1/diagnoses/${id}/resolve`),
  addAllergy: (patientId, body) => post(`/v1/patients/${patientId}/allergies`, body),
  raiseAlert: (patientId, body) => post(`/v1/patients/${patientId}/alerts`, body),
  acknowledgeAlert: (id, disposition, justification) => post(`/v1/alerts/${id}/acknowledge`, { disposition, justification }),
  resolveAlert: (id) => post(`/v1/alerts/${id}/resolve`),
  addAddendum: (noteId, text) => post(`/v1/notes/${noteId}/addenda`, { text }),
  prescribe: (patientId, body) => post(`/v1/patients/${patientId}/prescriptions`, body),
  discontinuePrescription: (id, reason) => post(`/v1/prescriptions/${id}/discontinue`, { reason }),
  placeOrder: (patientId, body) => post(`/v1/patients/${patientId}/orders`, body),
  collectSpecimen: (id, note = '') => post(`/v1/orders/${id}/collect`, { note }),
  recordResult: (id, body) => post(`/v1/orders/${id}/result`, body),
  reviewResult: (id, body) => post(`/v1/orders/${id}/review`, body),
  cancelOrder: (id, reason) => post(`/v1/orders/${id}/cancel`, { reason }),
  refer: (patientId, body) => post(`/v1/patients/${patientId}/referrals`, body),
  followUpReferral: (id, body) => post(`/v1/referrals/${id}/follow-up`, body),
  rerouteReferral: (id) => post(`/v1/referrals/${id}/reroute`),
  triageReferral: (id, decision, note = '') => post(`/v1/referrals/${id}/triage`, { decision, note }),
  createCarePlan: (patientId, body) => post(`/v1/patients/${patientId}/care-plans`, body),
  reviewCarePlan: (id, body) => post(`/v1/care-plans/${id}/reviews`, body),
}

export const incidentsApi = {
  list: (params = {}) => api(`/v1/incidents${queryString(params)}`, { meta: true }),
  report: (body) => post('/v1/incidents', body),
}
