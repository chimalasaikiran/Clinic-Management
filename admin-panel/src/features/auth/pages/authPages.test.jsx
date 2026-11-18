import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { ApiError } from '../../../lib/api'
import { authState } from '../../../test/auth'
import { renderRoute } from '../../../test/renderRoute'

const api = vi.hoisted(() => ({
  register: vi.fn(),
  confirmEmail: vi.fn(),
  resendVerification: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  previewInvitation: vi.fn(),
  acceptInvitationAsNewUser: vi.fn(),
  acceptInvitation: vi.fn(),
  createOrganisation: vi.fn(),
}))
vi.mock('../api', () => ({ authApi: api, accessApi: {} }))

const signedOut = () => authState({ status: 'signedOut' })

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue({}))
})

async function typeCode(user, digits) {
  const boxes = screen.getAllByRole('textbox', { name: /digit/i })
  await user.click(boxes[0])
  await user.paste(digits)
}

describe('create account page', () => {
  it('shows validation errors and stays on the page when the form is empty', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.signup, undefined, { auth: signedOut() })

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your work email.')).toBeInTheDocument()
    expect(screen.getByText('Create a password.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.signup)
    expect(api.register).not.toHaveBeenCalled()
  })

  it('clears an error once the field is corrected', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.signup, undefined, { auth: signedOut() })

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText('Full name'), 'Siddharth Verma')

    expect(screen.queryByText('Enter your full name.')).not.toBeInTheDocument()
  })

  it('registers through the API and moves to verification with the email', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.signup, undefined, { auth: signedOut() })

    await user.type(screen.getByLabelText('Full name'), ' Siddharth Verma ')
    await user.type(screen.getByLabelText('Work email'), 'Sid@Clinic.com')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(api.register).toHaveBeenCalledWith({ fullName: 'Siddharth Verma', email: 'sid@clinic.com', password: 'clinic2026' })
    expect(router.state.location.pathname).toBe(ROUTES.verify)
    expect(router.state.location.state).toEqual({ email: 'sid@clinic.com' })
  })

  it('shows field errors returned by the server', async () => {
    const user = userEvent.setup()
    api.register.mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', 'Some fields are missing or invalid.', [{ field: 'email', issue: 'Enter a valid email address.' }]))
    const router = renderRoute(ROUTES.signup, undefined, { auth: signedOut() })

    await user.type(screen.getByLabelText('Full name'), 'Sid')
    await user.type(screen.getByLabelText('Work email'), 'sid@clinic.com')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.signup)
  })

  it('shows rate-limit and network failures as a form message', async () => {
    const user = userEvent.setup()
    api.register.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.'))
    renderRoute(ROUTES.signup, undefined, { auth: signedOut() })

    await user.type(screen.getByLabelText('Full name'), 'Sid')
    await user.type(screen.getByLabelText('Work email'), 'sid@clinic.com')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.')
  })

  it('rejects a weak password and can reveal what was typed', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.signup, undefined, { auth: signedOut() })

    const password = screen.getByLabelText('Password')
    await user.type(password, 'short')
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('links to the sign-in page', () => {
    renderRoute(ROUTES.signup, undefined, { auth: signedOut() })
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', ROUTES.signin)
  })
})

describe('verify account page', () => {
  it('requires the full code before continuing', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.verify, { email: 'sid@clinic.com' }, { auth: signedOut() })

    await user.click(screen.getByRole('button', { name: /verify & continue/i }))
    expect(screen.getByText('Enter the 6-digit code.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.verify)
    expect(api.confirmEmail).not.toHaveBeenCalled()
  })

  it('verifies the code and sends a signed-out visitor to sign in', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.verify, { email: 'sid@clinic.com' }, { auth: signedOut() })

    await typeCode(user, '482913')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(api.confirmEmail).toHaveBeenCalledWith('sid@clinic.com', '482913')
    expect(router.state.location.pathname).toBe(ROUTES.signin)
    expect(router.state.location.state).toMatchObject({ email: 'sid@clinic.com', notice: expect.stringMatching(/verified/i) })
  })

  it('takes a signed-in, unverified user straight on to clinic setup', async () => {
    const user = userEvent.setup()
    const auth = authState({ status: 'unverified', refresh: vi.fn(async () => ({ status: 'noOrganisation', can: () => false })) })
    const router = renderRoute(ROUTES.verify, undefined, { auth })

    expect(screen.getByText('owner@aura.test')).toBeInTheDocument()
    await typeCode(user, '482913')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(auth.refresh).toHaveBeenCalled()
    expect(router.state.location.pathname).toBe(ROUTES.clinic)
  })

  it('shows an invalid code under the code boxes', async () => {
    const user = userEvent.setup()
    api.confirmEmail.mockRejectedValue(new ApiError(400, 'CODE_INVALID', 'That code is incorrect or has expired. Request a new code.'))
    renderRoute(ROUTES.verify, { email: 'sid@clinic.com' }, { auth: signedOut() })

    await typeCode(user, '000000')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(await screen.findByText('That code is incorrect or has expired. Request a new code.')).toBeInTheDocument()
  })

  it('resends a code and then waits before allowing another', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.verify, { email: 'sid@clinic.com' }, { auth: signedOut() })

    await user.click(screen.getByRole('button', { name: 'Resend code' }))

    expect(api.resendVerification).toHaveBeenCalledWith('sid@clinic.com')
    expect(await screen.findByText(/new code is on its way/i)).toBeInTheDocument()
    expect(screen.getByText(/Resend in \d+s/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument()
  })

  it('asks for the email when the page is opened without one', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.verify, undefined, { auth: signedOut() })

    await typeCode(user, '482913')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))
    expect(screen.getByText('Enter your work email.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Work email'), 'sid@clinic.com')
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))
    expect(api.confirmEmail).toHaveBeenCalledWith('sid@clinic.com', '482913')
  })
})

describe('sign in page', () => {
  it('requires an email and a password', async () => {
    const user = userEvent.setup()
    const auth = signedOut()
    renderRoute(ROUTES.signin, undefined, { auth })

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText('Enter your work email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('rejects a malformed email', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.signin, undefined, { auth: signedOut() })

    await user.type(screen.getByLabelText('Work email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  })

  it('signs in and opens the first section the role allows', async () => {
    const user = userEvent.setup()
    const can = (permission) => permission === 'bookings.view'
    const auth = authState({ status: 'signedOut', signIn: vi.fn(async () => ({ status: 'ready', can })) })
    const router = renderRoute(ROUTES.signin, undefined, { auth })

    await user.type(screen.getByLabelText('Work email'), 'desk@clinic.com')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(auth.signIn).toHaveBeenCalledWith('desk@clinic.com', 'clinic2026')
    expect(router.state.location.pathname).toBe(ROUTES.appointments)
  })

  it('returns to the page that asked for sign-in', async () => {
    const user = userEvent.setup()
    const auth = authState({ status: 'signedOut', signIn: vi.fn(async () => ({ status: 'ready', can: () => true })) })
    const router = renderRoute(ROUTES.signin, { from: '/patients' }, { auth })

    await user.type(screen.getByLabelText('Work email'), 'sid@clinic.com')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(router.state.location.pathname).toBe('/patients')
  })

  it('sends an unverified account to verification', async () => {
    const user = userEvent.setup()
    const auth = authState({ status: 'signedOut', signIn: vi.fn(async () => ({ status: 'unverified', can: () => false })) })
    const router = renderRoute(ROUTES.signin, undefined, { auth })

    await user.type(screen.getByLabelText('Work email'), 'new@clinic.com')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(router.state.location.pathname).toBe(ROUTES.verify)
    expect(router.state.location.state).toEqual({ email: 'new@clinic.com' })
  })

  it('shows one message for a wrong email or password and re-enables the button', async () => {
    const user = userEvent.setup()
    const auth = authState({ status: 'signedOut', signIn: vi.fn(async () => Promise.reject(new Error('Email or password is incorrect.'))) })
    renderRoute(ROUTES.signin, undefined, { auth })

    await user.type(screen.getByLabelText('Work email'), 'sid@clinic.com')
    await user.type(screen.getByLabelText('Password'), 'wrong2026')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled()
  })

  it('explains why the previous session ended', () => {
    renderRoute(ROUTES.signin, undefined, { auth: authState({ status: 'signedOut', endedReason: 'IDLE' }) })
    expect(screen.getByRole('status')).toHaveTextContent('signed out after 30 minutes')
  })

  it('links to account creation and password recovery', () => {
    renderRoute(ROUTES.signin, undefined, { auth: signedOut() })
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', ROUTES.signup)
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', ROUTES.forgotPassword)
  })

  it('sends someone already signed in to their workspace', () => {
    const router = renderRoute(ROUTES.signin)
    expect(router.state.location.pathname).toBe(ROUTES.dashboard)
  })
})

describe('password reset', () => {
  it('requests a code, then resets with it and returns to sign in', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.forgotPassword, undefined, { auth: signedOut() })

    await user.type(screen.getByLabelText('Work email'), 'Sid@Clinic.com')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))
    expect(api.requestPasswordReset).toHaveBeenCalledWith('sid@clinic.com')
    expect(router.state.location.pathname).toBe(ROUTES.resetPassword)

    expect(await screen.findByText('sid@clinic.com')).toBeInTheDocument()
    await typeCode(user, '551204')
    await user.type(screen.getByLabelText('New password'), 'newpass2026')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(api.confirmPasswordReset).toHaveBeenCalledWith('sid@clinic.com', '551204', 'newpass2026')
    expect(router.state.location.pathname).toBe(ROUTES.signin)
    expect(router.state.location.state).toMatchObject({ notice: expect.stringMatching(/password updated/i) })
  })

  it('keeps the reset form open when the code is wrong', async () => {
    const user = userEvent.setup()
    api.confirmPasswordReset.mockRejectedValue(new ApiError(400, 'CODE_INVALID', 'That code is incorrect or has expired. Request a new code.'))
    const router = renderRoute(ROUTES.resetPassword, { email: 'sid@clinic.com' }, { auth: signedOut() })

    await typeCode(user, '000000')
    await user.type(screen.getByLabelText('New password'), 'newpass2026')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('That code is incorrect or has expired. Request a new code.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.resetPassword)
  })

  it('validates the new password before calling the API', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.resetPassword, { email: 'sid@clinic.com' }, { auth: signedOut() })

    await typeCode(user, '551204')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(api.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('starts again when opened without an email', () => {
    const router = renderRoute(ROUTES.resetPassword, undefined, { auth: signedOut() })
    expect(router.state.location.pathname).toBe(ROUTES.forgotPassword)
  })
})

describe('route protection', () => {
  it('sends signed-out visitors to sign in and remembers where they were going', () => {
    const router = renderRoute('/patients', undefined, { auth: signedOut() })
    expect(router.state.location.pathname).toBe(ROUTES.signin)
    expect(router.state.location.state).toEqual({ from: '/patients' })
  })

  it('sends an unverified account to verification and a member-less account to clinic setup', () => {
    const unverified = renderRoute(ROUTES.dashboard, undefined, { auth: authState({ status: 'unverified' }) })
    expect(unverified.state.location.pathname).toBe(ROUTES.verify)
  })

  it('sends someone without an organisation to clinic setup', () => {
    const router = renderRoute(ROUTES.dashboard, undefined, { auth: authState({ status: 'noOrganisation' }) })
    expect(router.state.location.pathname).toBe(ROUTES.clinic)
  })

  it('protects onboarding from signed-out visitors', () => {
    const router = renderRoute(ROUTES.clinic, undefined, { auth: signedOut() })
    expect(router.state.location.pathname).toBe(ROUTES.signin)
  })

  it('shows only the sections a role allows and blocks the rest', () => {
    renderRoute('/billing', undefined, { auth: authState({ permissions: ['dashboard.view', 'bookings.view', 'patients.view'] }) })

    expect(screen.getByRole('heading', { name: 'You do not have access to this page' })).toBeInTheDocument()
    const nav = within(screen.getAllByRole('navigation', { name: 'Primary' })[0])
    expect(nav.getByRole('link', { name: 'Patients' })).toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Billing & Finance' })).not.toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Payroll' })).not.toBeInTheDocument()
  })

  it('shows a loading state while the session is restored', () => {
    renderRoute(ROUTES.dashboard, undefined, { auth: authState({ status: 'loading' }) })
    expect(screen.getByRole('status')).toHaveTextContent('Loading your workspace')
  })

  it('explains when sign-in is not configured', () => {
    renderRoute(ROUTES.dashboard, undefined, { auth: authState({ status: 'misconfigured', error: 'VITE_API_URL is not set. Copy admin-panel/.env.example to .env.local.' }) })
    expect(screen.getByRole('status')).toHaveTextContent('VITE_API_URL is not set')
  })
})

describe('accept invitation page', () => {
  const preview = { email: 'new@clinic.com', organisation: 'Aura Health', invitedBy: 'Siddharth Verma', roles: ['Clinician'], accountExists: false }

  beforeEach(() => {
    window.history.replaceState(null, '', '/auth/invite#token=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ')
    window.sessionStorage.clear()
  })

  it('creates an account from the invitation and signs in', async () => {
    const user = userEvent.setup()
    api.previewInvitation.mockResolvedValue(preview)
    const auth = authState({ status: 'signedOut', refresh: vi.fn(async () => ({ status: 'ready', can: () => true })) })
    const router = renderRoute(ROUTES.invite, undefined, { auth })

    expect(await screen.findByRole('heading', { name: 'Join Aura Health' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(screen.getByLabelText('Work email')).toHaveValue('new@clinic.com')

    await user.type(screen.getByLabelText('Full name'), 'Dr. New')
    await user.type(screen.getByLabelText('Password'), 'clinic2026')
    await user.click(screen.getByRole('button', { name: 'Create account & join' }))

    expect(api.acceptInvitationAsNewUser).toHaveBeenCalledWith('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ', { fullName: 'Dr. New', password: 'clinic2026' })
    expect(auth.signIn).toHaveBeenCalledWith('new@clinic.com', 'clinic2026')
    expect(router.state.location.pathname).toBe(ROUTES.dashboard)
  })

  it('asks an existing account holder to sign in first', async () => {
    const user = userEvent.setup()
    api.previewInvitation.mockResolvedValue({ ...preview, accountExists: true })
    const router = renderRoute(ROUTES.invite, undefined, { auth: signedOut() })

    await user.click(await screen.findByRole('button', { name: 'Sign in to accept' }))
    expect(router.state.location.pathname).toBe(ROUTES.signin)
    expect(router.state.location.state).toEqual({ email: 'new@clinic.com', from: ROUTES.invite })
  })

  it('accepts for the signed-in person when the email matches', async () => {
    const user = userEvent.setup()
    api.previewInvitation.mockResolvedValue({ ...preview, email: 'owner@aura.test', accountExists: true })
    renderRoute(ROUTES.invite)

    await user.click(await screen.findByRole('button', { name: 'Accept and join Aura Health' }))
    expect(api.acceptInvitation).toHaveBeenCalledWith('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ')
  })

  it('refuses when signed in as someone else', async () => {
    api.previewInvitation.mockResolvedValue({ ...preview, accountExists: true })
    renderRoute(ROUTES.invite)

    expect(await screen.findByText(/this invitation is for new@clinic.com/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Accept and join/ })).not.toBeInTheDocument()
  })

  it('explains an expired or used link', async () => {
    api.previewInvitation.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'This invitation is invalid, has expired or was already used.'))
    renderRoute(ROUTES.invite, undefined, { auth: signedOut() })

    expect(await screen.findByRole('alert')).toHaveTextContent('has expired or was already used')
  })
})
