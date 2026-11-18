import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadApi() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'http://api.test/')
  return import('./api')
}

const json = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

describe('api client', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends the session cookie and the active organisation, and returns the data field', async () => {
    const { api, configureApi } = await loadApi()
    configureApi({ getOrgId: () => 'org-1' })
    fetchMock.mockResolvedValue(json(200, { data: [{ id: 'role-1' }] }))

    expect(await api('/v1/roles')).toEqual([{ id: 'role-1' }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/v1/roles')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-Org-Id']).toBe('org-1')
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('returns paging metadata alongside the data when asked', async () => {
    const { api } = await loadApi()
    fetchMock.mockResolvedValue(json(200, { data: [{ id: 'p-1' }], meta: { page: 2, pageSize: 25, total: 26 } }))
    await expect(api('/v1/patients?page=2', { meta: true })).resolves.toEqual({ data: [{ id: 'p-1' }], meta: { page: 2, pageSize: 25, total: 26 } })
  })

  it('omits the organisation for account calls and sends JSON bodies', async () => {
    const { api, configureApi } = await loadApi()
    configureApi({ getOrgId: () => 'org-1' })
    fetchMock.mockResolvedValue(json(204))

    expect(await api('/v1/auth/logout', { method: 'POST', body: { a: 1 }, org: false })).toBeNull()
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Org-Id']).toBeUndefined()
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('turns the error envelope into an ApiError with field messages and Retry-After', async () => {
    const { api, ApiError } = await loadApi()
    fetchMock.mockResolvedValue(
      json(429, { error: { code: 'RATE_LIMITED', message: 'Too many attempts.', details: [{ field: 'email', issue: 'Slow down.' }] } }, { 'Retry-After': '30' }),
    )
    const error = await api('/v1/auth/login', { method: 'POST', body: {} }).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', message: 'Too many attempts.', retryAfter: 30 })
    expect(error.fieldErrors()).toEqual({ email: 'Slow down.' })
  })

  it('reports an ended session but not a missing one', async () => {
    const { api, configureApi } = await loadApi()
    const onSessionEnded = vi.fn()
    configureApi({ onSessionEnded })

    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'SESSION_EXPIRED', message: 'Expired.' } }))
    await api('/v1/roles').catch(() => {})
    expect(onSessionEnded).toHaveBeenCalledWith('SESSION_EXPIRED')

    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'SESSION_MISSING', message: 'Sign in.' } }))
    await api('/v1/auth/session').catch(() => {})
    expect(onSessionEnded).toHaveBeenCalledTimes(1)
  })

  it('explains network failures in plain language', async () => {
    const { api } = await loadApi()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api('/v1/roles')).rejects.toMatchObject({ code: 'NETWORK', message: 'Cannot reach ClinicOS. Check your connection and try again.' })
  })
})
