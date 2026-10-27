import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

describe('clinic profile page', () => {
  it('requires the profile fields and a facility classification', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.clinic)

    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(screen.getByText('Enter the clinic or organization name.')).toBeInTheDocument()
    expect(screen.getByText('Select a state or territory.')).toBeInTheDocument()
    expect(screen.getByText('Choose a facility classification.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.clinic)
  })

  it('continues to practice contact when the profile is complete', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.clinic)

    await user.type(screen.getByLabelText('Clinic / Organization Name'), 'Apex Health Institute')
    await user.type(screen.getByLabelText('Primary Location / Campus'), 'Indiranagar')
    await user.type(screen.getByLabelText('City'), 'Bengaluru')
    await user.selectOptions(screen.getByLabelText('State / Territory'), 'Karnataka')
    await user.click(screen.getByRole('radio', { name: 'Outpatient Practice' }))
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(router.state.location.pathname).toBe(ROUTES.contact)
  })
})

describe('practice contact page', () => {
  it('rejects an invalid phone number and an invalid optional email', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.contact)

    await user.type(screen.getByLabelText(/clinic phone/i), '12345')
    await user.type(screen.getByLabelText('Clinic email'), 'front-desk')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText('Enter a valid 10-digit phone number.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.contact)
  })

  it('continues with only a valid phone number', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.contact)

    await user.type(screen.getByLabelText(/clinic phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(router.state.location.pathname).toBe(ROUTES.operations)
  })
})

describe('operating model page', () => {
  it('asks for a classification and a structure before continuing', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.operations)

    await user.click(screen.getByRole('button', { name: /continue to clinical specialties/i }))

    expect(screen.getByText('Select a clinic classification.')).toBeInTheDocument()
    expect(screen.getByText('Select an operational structure.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.operations)
  })

  it('keeps a single selection per group', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.operations)

    await user.click(screen.getByRole('radio', { name: /general \/ family clinic/i }))
    await user.click(screen.getByRole('radio', { name: /specialty clinic/i }))

    expect(screen.getByRole('radio', { name: /general \/ family clinic/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /^specialty clinic/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('continues to specialties once both choices are made', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.operations)

    await user.click(screen.getByRole('radio', { name: /general \/ family clinic/i }))
    await user.click(screen.getByRole('radio', { name: /solo practitioner/i }))
    await user.click(screen.getByRole('button', { name: /continue to clinical specialties/i }))

    expect(router.state.location.pathname).toBe(ROUTES.specialties)
  })
})

describe('clinical specialties page', () => {
  it('requires at least one specialty', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.specialties)

    await user.click(screen.getByRole('button', { name: /complete practice setup/i }))

    expect(screen.getByText('Select at least one specialty.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.specialties)
  })

  it('filters the list by the search text', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.specialties)

    await user.type(screen.getByLabelText('Search specialties'), 'cardio')

    const group = screen.getByRole('group', { name: 'Clinical specialties' })
    expect(within(group).getByRole('checkbox', { name: /cardiology/i })).toBeInTheDocument()
    expect(within(group).queryByRole('checkbox', { name: /dentistry/i })).not.toBeInTheDocument()
  })

  it('lets the user add and remove a named department', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.specialties)

    await user.click(screen.getByRole('button', { name: /add another department/i }))
    const addButton = screen.getByRole('button', { name: 'Add' })
    expect(addButton).toBeDisabled()

    await user.type(screen.getByLabelText('Department name'), 'Cardiology Wing')
    await user.click(addButton)
    expect(screen.getByText('Cardiology Wing')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Cardiology Wing' }))
    expect(screen.queryByText('Cardiology Wing')).not.toBeInTheDocument()
  })

  it('finishes setup once a specialty is selected', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.specialties)

    await user.click(screen.getByRole('checkbox', { name: /cardiology/i }))
    await user.click(screen.getByRole('button', { name: /complete practice setup/i }))

    expect(router.state.location.pathname).toBe(ROUTES.complete)
  })
})
