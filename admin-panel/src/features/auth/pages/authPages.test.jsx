import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

describe('create account page', () => {
  it('shows validation errors and stays on the page when the form is empty', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.signup)

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your work email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your mobile number.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.signup)
  })

  it('clears an error once the field is corrected', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.signup)

    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText('Full name'), 'Siddharth Verma')

    expect(screen.queryByText('Enter your full name.')).not.toBeInTheDocument()
  })

  it('moves to verification and carries the entered email forward', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.signup)

    await user.type(screen.getByLabelText('Full name'), 'Siddharth Verma')
    await user.type(screen.getByLabelText('Work email'), 'sid@clinic.com')
    await user.type(screen.getByLabelText('Mobile number'), '9876543210')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(router.state.location.pathname).toBe(ROUTES.verify)
    expect(router.state.location.state).toEqual({ email: 'sid@clinic.com' })
  })
})

describe('verify account page', () => {
  it('shows the email the code was sent to', () => {
    renderRoute(ROUTES.verify, { email: 'sid@clinic.com' })
    expect(screen.getByText('sid@clinic.com')).toBeInTheDocument()
  })

  it('falls back to neutral wording when no email was passed', () => {
    renderRoute(ROUTES.verify)
    expect(screen.getByText('your email')).toBeInTheDocument()
  })

  it('requires the full code before continuing', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.verify)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.keyboard('84')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter the 6-digit code.')
    expect(router.state.location.pathname).toBe(ROUTES.verify)
  })

  it('continues to the clinic profile once the code is complete', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.verify)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('842109')
    await user.click(screen.getByRole('button', { name: /verify/i }))

    expect(router.state.location.pathname).toBe(ROUTES.clinic)
  })
})
