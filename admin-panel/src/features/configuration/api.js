import { api, apiUrl, currentOrgId } from '../../lib/api'
import { queryString } from '../patients/api'

const send = (path, method, body) => api(path, { method, body })

// The organisation profile, branches, hours, departments and insurance endpoints (backend/src/modules/configuration).
export const configApi = {
  organisation: () => api('/v1/organisation'),
  updateOrganisation: (body) => send('/v1/organisation', 'PATCH', body),
  saveContact: (body) => send('/v1/organisation/contact', 'PUT', body),
  saveOperations: (body) => send('/v1/organisation/operations', 'PUT', body),
  saveSpecialties: (body) => send('/v1/organisation/specialties', 'PUT', body),
  completeSetup: () => send('/v1/organisation/complete', 'POST'),
  uploadLogo: (file) => api('/v1/organisation/logo', { method: 'PUT', body: file, headers: { 'X-File-Name': encodeURIComponent(file.name || 'logo') } }),
  logoUrl: () => apiUrl(`/v1/organisation/logo${queryString({ orgId: currentOrgId() })}`),

  branches: () => api('/v1/configuration/branches'),
  branch: (id) => api(`/v1/configuration/branches/${id}`),
  createBranch: (body) => send('/v1/configuration/branches', 'POST', body),
  updateBranch: (id, body) => send(`/v1/configuration/branches/${id}`, 'PATCH', body),
  setPatientApp: (id, body) => send(`/v1/configuration/branches/${id}/patient-app`, 'PUT', body),
  setHours: (id, sessions) => send(`/v1/configuration/branches/${id}/hours`, 'PUT', { sessions }),
  addClosure: (id, body) => send(`/v1/configuration/branches/${id}/closures`, 'POST', body),
  removeClosure: (id, closureId) => send(`/v1/configuration/branches/${id}/closures/${closureId}`, 'DELETE'),

  departments: (query) => api(`/v1/departments${queryString(query)}`),
  department: (id) => api(`/v1/departments/${id}`),
  createDepartment: (body) => send('/v1/departments', 'POST', body),
  updateDepartment: (id, body) => send(`/v1/departments/${id}`, 'PATCH', body),
  addDepartmentMembers: (id, body) => send(`/v1/departments/${id}/members`, 'POST', body),

  insurance: () => api('/v1/insurance'),
  setAcceptance: (accepts) => send('/v1/insurance/acceptance', 'PUT', { accepts }),
  addPartner: (body) => send('/v1/insurance/partners', 'POST', body),
  setPartnerActive: (id, active) => send(`/v1/insurance/partners/${id}`, 'PATCH', { active }),
  uploadAgreement: (file) => api('/v1/insurance/documents', { method: 'POST', body: file, headers: { 'X-File-Name': encodeURIComponent(file.name || 'agreement.pdf') } }),
  documentUrl: (id) => apiUrl(`/v1/insurance/documents/${id}${queryString({ orgId: currentOrgId() })}`),
  createAgreement: (body) => send('/v1/insurance/agreements', 'POST', body),
  updateAgreement: (id, body) => send(`/v1/insurance/agreements/${id}`, 'PATCH', body),
  activateAgreement: (id, version) => send(`/v1/insurance/agreements/${id}/activate`, 'POST', { confirm: true, version }),
  endAgreement: (id, version) => send(`/v1/insurance/agreements/${id}/end`, 'POST', { confirm: true, version }),
}
