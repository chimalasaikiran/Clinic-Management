const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TIMEOUT_MS = 15000

export const apiConfigured = () => Boolean(BASE_URL)

// Absolute address of an API path, for what cannot go through api() (EventSource streams).
export const apiUrl = (path) => `${BASE_URL}${path}`

export class ApiError extends Error {
  constructor(status, code, message, details = [], retryAfter = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }

  // { fieldName: 'message' } for showing server validation errors under form inputs.
  fieldErrors() {
    return Object.fromEntries(this.details.filter((detail) => detail.field).map((detail) => [detail.field, detail.issue]))
  }
}

// Codes that mean an existing session is over and the user must sign in again.
const SESSION_ENDED = new Set(['SESSION_INVALID', 'SESSION_EXPIRED', 'ACCOUNT_DISABLED'])

let session = { getOrgId: () => null, onSessionEnded: () => {} }

// Wired up by AuthProvider so requests carry the active organisation and a lost session is noticed.
// The active organisation, for addresses that cannot carry the header (image tags, event streams).
export const currentOrgId = () => session.getOrgId()

export function configureApi(handlers) {
  session = { ...session, ...handlers }
}

async function errorFrom(response) {
  const payload = await response.json().catch(() => null)
  const error = payload?.error
  const retryAfter = Number(response.headers.get('Retry-After')) || null
  return new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Something went wrong. Please try again.', error?.details ?? [], retryAfter)
}

// The session lives in an HttpOnly cookie set by the backend; `credentials: 'include'` sends it, and
// JavaScript never sees it. `org: false` for calls that are not about one organisation. `meta: true` returns
// { data, meta } for list endpoints that report paging. A Blob or File body (an image upload) is sent as it is,
// with its own type; `headers` adds request headers such as the file name.
export async function api(path, { method = 'GET', body, org = true, meta = false, headers: extra = {} } = {}) {
  const raw = typeof Blob !== 'undefined' && body instanceof Blob
  const headers = { Accept: 'application/json', ...extra }
  if (body !== undefined) headers['Content-Type'] = raw ? body.type : 'application/json'
  const orgId = org ? session.getOrgId() : null
  if (orgId) headers['X-Org-Id'] = orgId

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach ClinicOS. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const error = await errorFrom(response)
    if (SESSION_ENDED.has(error.code)) session.onSessionEnded(error.code)
    throw error
  }
  if (response.status === 204) return null
  const payload = await response.json()
  return meta ? { data: payload.data, meta: payload.meta ?? null } : payload.data
}
