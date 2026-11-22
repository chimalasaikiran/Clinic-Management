import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { billingFake } from '../../../test/fixtures/billingFake'
import { createConfigApi } from '../../../test/fixtures/configApi'
import { renderRoute } from '../../../test/renderRoute'

const api = vi.hoisted(() => ({ createOrganisation: vi.fn() }))
vi.mock('../../auth/api', () => ({ authApi: api, accessApi: {} }))

beforeEach(() => {
  api.createOrganisation.mockReset().mockResolvedValue({ organisation: { id: 'org-new', name: 'Apex Health Institute' } })
})

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

  it('creates the organisation and continues to practice contact', async () => {
    const user = userEvent.setup()
    const auth = authState({ status: 'noOrganisation' })
    const router = renderRoute(ROUTES.clinic, undefined, { auth })

    await user.type(screen.getByLabelText('Clinic / Organization Name'), 'Apex Health Institute')
    await user.type(screen.getByLabelText('Primary Location / Campus'), 'Indiranagar')
    await user.type(screen.getByLabelText('City'), 'Bengaluru')
    await user.selectOptions(screen.getByLabelText('State / Territory'), 'Karnataka')
    await user.click(screen.getByRole('radio', { name: 'Outpatient Practice' }))
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(api.createOrganisation).toHaveBeenCalledWith({ clinicName: 'Apex Health Institute', location: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', facilityType: 'Outpatient Practice' })
    expect(auth.refresh).toHaveBeenCalledWith('org-new')
    expect(router.state.location.pathname).toBe(ROUTES.contact)
  })

  it('stays on the page and shows the error when the organisation cannot be created', async () => {
    const user = userEvent.setup()
    api.createOrganisation.mockRejectedValue(new Error('Too many attempts. Please wait and try again.'))
    const router = renderRoute(ROUTES.clinic, undefined, { auth: authState({ status: 'noOrganisation' }) })

    await user.type(screen.getByLabelText('Clinic / Organization Name'), 'Apex Health Institute')
    await user.type(screen.getByLabelText('Primary Location / Campus'), 'Indiranagar')
    await user.type(screen.getByLabelText('City'), 'Bengaluru')
    await user.selectOptions(screen.getByLabelText('State / Territory'), 'Karnataka')
    await user.click(screen.getByRole('radio', { name: 'Outpatient Practice' }))
    await user.click(screen.getByRole('button', { name: /verify & continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.')
    expect(router.state.location.pathname).toBe(ROUTES.clinic)
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

  it('saves a valid phone number and continues', async () => {
    const user = userEvent.setup()
    const config = billingFake.config
    const router = renderRoute(ROUTES.contact)

    await user.type(screen.getByLabelText(/clinic phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.operations))
    expect(config.state.calls).toContainEqual(['saveContact', { phone: '9876543210', email: '' }])
    expect(config.state.organisation.phone).toBe('9876543210')
  })

  it('stays on the page when the contact details cannot be saved', async () => {
    const user = userEvent.setup()
    const config = billingFake.useConfig(createConfigApi())
    config.api.saveContact = async () => {
      throw new Error('Cannot reach ClinicOS. Check your connection and try again.')
    }
    const router = renderRoute(ROUTES.contact)

    await user.type(screen.getByLabelText(/clinic phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/cannot reach clinicos/i)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.contact)
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

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.specialties))
    expect(billingFake.config.state.organisation).toMatchObject({ classification: 'general', structure: 'solo' })
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

  it('saves the specialties, creates their departments and finishes setup', async () => {
    const user = userEvent.setup()
    const config = billingFake.useConfig(createConfigApi({ departments: [], organisation: { ...createConfigApi().state.organisation, status: 'onboarding', specialties: [] } }))
    const router = renderRoute(ROUTES.specialties)

    await user.click(screen.getByRole('checkbox', { name: /cardiology/i }))
    await user.click(screen.getByRole('button', { name: /complete practice setup/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.complete))
    expect(config.state.organisation.status).toBe('active')
    expect(config.state.departments.map((department) => department.name)).toContain(config.state.organisation.specialties[0])
  })
})
