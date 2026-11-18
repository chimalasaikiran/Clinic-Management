import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, configureApi } from '../../../lib/api'
import AuthProvider from './AuthProvider'
import { useAuth } from './useAuth'

const authApi = vi.hoisted(() => ({
  session: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(async () => null),
  logoutEverywhere: vi.fn(async () => null),
}))

vi.mock('../api', () => ({ authApi }))
vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiConfigured: () => true, configureApi: vi.fn(actual.configureApi) }
})

const SESSION = {
  user: { id: 'user-1', email: 'owner@aura.test', fullName: 'Siddharth Verma', emailVerified: true },
  memberships: [{ membershipId: 'm-1', organisation: { id: 'org-1', name: 'Aura Health', status: 'active' }, roles: [], permissions: ['settings.roles'], branchScope: 'all' }],
}

let auth
// Exposes the context to the test after each render.
function Probe() {
  const value = useAuth()
  useEffect(() => {
    auth = value
  })
  return <p role="status">{value.status}</p>
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('restores the session from the cookie on load', async () => {
    // The session answers only when the test says so, so the loading state is observable on any machine.
    let answer
    authApi.session.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    renderProvider()
    expect(screen.getByRole('status')).toHaveTextContent('loading')
    await act(async () => answer(SESSION))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready'))
    expect(auth.orgId).toBe('org-1')
    expect(auth.can('settings.roles')).toBe(true)
  })

  it('treats no session as signed out, quietly', async () => {
    authApi.session.mockRejectedValue(new ApiError(401, 'SESSION_MISSING', 'Sign in to continue.'))
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('signedOut'))
    expect(auth.endedReason).toBeNull()
    expect(authApi.logout).not.toHaveBeenCalled()
  })

  it('shows an error state when the backend cannot be reached', async () => {
    authApi.session.mockRejectedValue(new ApiError(0, 'NETWORK', 'Cannot reach ClinicOS.'))
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('error'))
    expect(auth.error).toBe('Cannot reach ClinicOS.')
  })

  it('signs in with the backend and reports unverified accounts', async () => {
    authApi.session.mockRejectedValue(new ApiError(401, 'SESSION_MISSING', 'Sign in.'))
    authApi.login.mockResolvedValue({ user: { ...SESSION.user, emailVerified: false }, memberships: [] })
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('signedOut'))

    let result
    await act(async () => {
      result = await auth.signIn('owner@aura.test', 'Clinic2026')
    })
    expect(authApi.login).toHaveBeenCalledWith('owner@aura.test', 'Clinic2026')
    expect(result.status).toBe('unverified')
    expect(screen.getByRole('status')).toHaveTextContent('unverified')
  })

  it('passes the backend sign-in error through to the form', async () => {
    authApi.session.mockRejectedValue(new ApiError(401, 'SESSION_MISSING', 'Sign in.'))
    authApi.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'))
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('signedOut'))
    await expect(auth.signIn('owner@aura.test', 'nope')).rejects.toThrow('Email or password is incorrect.')
  })

  it('signs out here or everywhere', async () => {
    authApi.session.mockResolvedValue(SESSION)
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready'))

    await act(() => auth.signOut({ everywhere: true }))
    expect(authApi.logoutEverywhere).toHaveBeenCalled()
    expect(authApi.logout).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('signedOut')
  })

  it('keeps the user signed in when signing out everywhere fails', async () => {
    authApi.session.mockResolvedValue(SESSION)
    authApi.logoutEverywhere.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Cannot reach ClinicOS.'))
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready'))
    await act(() => expect(auth.signOut({ everywhere: true })).rejects.toThrow('Cannot reach ClinicOS.'))
    expect(screen.getByRole('status')).toHaveTextContent('ready')
  })

  it('signs out with a reason when the backend says the session ended', async () => {
    authApi.session.mockResolvedValue(SESSION)
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready'))

    const { onSessionEnded } = vi.mocked(configureApi).mock.calls.at(-1)[0]
    await act(async () => onSessionEnded('SESSION_EXPIRED'))
    expect(screen.getByRole('status')).toHaveTextContent('signedOut')
    expect(auth.endedReason).toBe('SESSION_EXPIRED')
  })
})
