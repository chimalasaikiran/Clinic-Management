import { api } from '../../lib/api'

const post = (path, body, options) => api(path, { method: 'POST', body, org: false, ...options })

export const authApi = {
  register: (values) => post('/v1/auth/register', values),
  confirmEmail: (email, code) => post('/v1/auth/email-verification/confirm', { email, code }),
  resendVerification: (email) => post('/v1/auth/email-verification/resend', { email }),
  requestPasswordReset: (email) => post('/v1/auth/password-reset/request', { email }),
  confirmPasswordReset: (email, code, password) => post('/v1/auth/password-reset/confirm', { email, code, password }),

  login: (email, password) => post('/v1/auth/login', { email, password }),
  logout: () => post('/v1/auth/logout'),
  logoutEverywhere: () => post('/v1/auth/logout-all'),
  session: () => api('/v1/auth/session', { org: false }),
  createOrganisation: (values) => post('/v1/organisations', values),

  previewInvitation: (token) => post('/v1/invitations/preview', { token }),
  acceptInvitationAsNewUser: (token, values) => post('/v1/invitations/accept-new', { token, ...values }),
  acceptInvitation: (token) => post('/v1/invitations/accept', { token }),
}

export const accessApi = {
  roles: () => api('/v1/roles'),
  createRole: (values) => api('/v1/roles', { method: 'POST', body: values }),
  updateRole: (id, values) => api(`/v1/roles/${id}`, { method: 'PATCH', body: values }),
  branches: () => api('/v1/branches'),
  members: () => api('/v1/members'),
  setMemberRoles: (id, roleIds) => api(`/v1/members/${id}/roles`, { method: 'PUT', body: { roleIds } }),
  invite: (email, roleIds) => api('/v1/invitations', { method: 'POST', body: { email, roleIds } }),
}
