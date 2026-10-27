import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../config/routes'
import { renderRoute } from '../test/renderRoute'

const pages = [
  [ROUTES.setup, 'Set up your clinic'],
  [ROUTES.signup, 'Create your account'],
  [ROUTES.verify, 'Verify your account'],
  [ROUTES.clinic, 'Create your clinic'],
  [ROUTES.contact, 'Tell us about your clinic'],
  [ROUTES.operations, 'What type of clinic are you setting up?'],
  [ROUTES.specialties, 'What specialties does your clinic offer?'],
  [ROUTES.complete, 'Your clinic is ready to go.'],
  [ROUTES.dashboard, 'Good morning, Dr. Siddharth Verma'],
]

describe('routes', () => {
  it.each(pages)('renders %s', (path, heading) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('redirects the root path to the setup intro', () => {
    const rootRouter = renderRoute(ROUTES.root)
    expect(rootRouter.state.location.pathname).toBe(ROUTES.setup)
  })

  it('redirects unknown paths to the setup intro', () => {
    const router = renderRoute('/does-not-exist')
    expect(router.state.location.pathname).toBe(ROUTES.setup)
  })

  it('starts the flow from the setup intro and finishes in the dashboard', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.setup)

    await user.click(screen.getByRole('button', { name: /begin setup/i }))
    expect(router.state.location.pathname).toBe(ROUTES.signup)

    await router.navigate(ROUTES.complete)
    await user.click(await screen.findByRole('button', { name: /go to my workspace/i }))
    expect(router.state.location.pathname).toBe(ROUTES.dashboard)
  })
})
