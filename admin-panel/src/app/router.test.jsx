import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../config/routes'
import { authState } from '../test/auth'
import { renderRoute } from '../test/renderRoute'

const signedOut = () => authState({ status: 'signedOut' })

const publicPages = [
  [ROUTES.setup, 'Set up your clinic'],
  [ROUTES.signin, 'Sign in to ClinicOS'],
  [ROUTES.signup, 'Create your account'],
  [ROUTES.verify, 'Verify your account'],
  [ROUTES.forgotPassword, 'Reset your password'],
]

const signedInPages = [
  [ROUTES.clinic, 'Create your clinic'],
  [ROUTES.contact, 'Tell us about your clinic'],
  [ROUTES.operations, 'What type of clinic are you setting up?'],
  [ROUTES.specialties, 'What specialties does your clinic offer?'],
  [ROUTES.complete, 'Your clinic is ready to go.'],
  [ROUTES.dashboard, 'Good morning, Dr. Siddharth Verma'],
]

describe('routes', () => {
  it.each(publicPages)('renders %s for a signed-out visitor', (path, heading) => {
    renderRoute(path, undefined, { auth: signedOut() })
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it.each(signedInPages)('renders %s when signed in', (path, heading) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('sends the root path to the setup intro when signed out and to the workspace when signed in', () => {
    expect(renderRoute(ROUTES.root, undefined, { auth: signedOut() }).state.location.pathname).toBe(ROUTES.setup)
  })

  it('sends the root path to the workspace when signed in', () => {
    expect(renderRoute(ROUTES.root).state.location.pathname).toBe(ROUTES.dashboard)
  })

  it('redirects unknown paths the same way as the root path', () => {
    expect(renderRoute('/does-not-exist', undefined, { auth: signedOut() }).state.location.pathname).toBe(ROUTES.setup)
  })

  it('starts the flow from the setup intro', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.setup, undefined, { auth: signedOut() })

    await user.click(screen.getByRole('button', { name: /begin setup/i }))
    expect(router.state.location.pathname).toBe(ROUTES.signup)
  })

  it('finishes onboarding in the dashboard', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.complete)

    await user.click(await screen.findByRole('button', { name: /go to my workspace/i }))
    expect(router.state.location.pathname).toBe(ROUTES.dashboard)
  })
})
