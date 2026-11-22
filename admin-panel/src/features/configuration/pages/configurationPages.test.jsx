import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { billingFake } from '../../../test/fixtures/billingFake'
import { apiBranch, createConfigApi } from '../../../test/fixtures/configApi'
import { renderRoute } from '../../../test/renderRoute'

// Pasting keeps long form fills fast; typing every key re-renders the whole page.
async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('organisation page', () => {
  it('lists every branch and highlights Configuration in the sidebar', async () => {
    renderRoute(ROUTES.organisation)

    expect(await screen.findByRole('heading', { name: 'Kondapur Clinic' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Organization & branches' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /configuration/i })).toHaveAttribute('aria-current', 'page')
  })

  it('filters locations by search text and shows an empty state', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.organisation)

    await user.type(await screen.findByPlaceholderText('Search locations...'), 'kondapur')
    expect(screen.queryByRole('heading', { name: 'Main Clinic' })).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search locations...'), 'zzz')
    expect(screen.getByText('No locations match your filters.')).toBeInTheDocument()
  })

  it('saves the organisation profile', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.organisation)

    await user.click(await screen.findByRole('button', { name: 'Edit organization profile' }))
    const name = screen.getByLabelText(/Organization name/)
    await user.clear(name)
    await fill(user, name, 'Aura Health Clinics')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(billingFake.config.state.organisation.displayName).toBe('Aura Health Clinics'))
    expect(billingFake.config.state.organisation.version).toBe(2)
  })
})

describe('create branch page', () => {
  it('validates the form, then creates the branch and opens it', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.branchNew)

    await user.click((await screen.findAllByRole('button', { name: 'Create branch' }))[0])
    expect(screen.getByText('Enter the branch name.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/Branch name/), 'Gachibowli Clinic')
    await fill(user, screen.getByLabelText(/Branch code/), 'GCB-01')
    await user.selectOptions(screen.getByLabelText(/Facility type/), 'Outpatient Practice')
    await fill(user, screen.getByLabelText(/Address line 1/), 'DLF Road')
    await fill(user, screen.getByLabelText(/^City/), 'Hyderabad')
    await fill(user, screen.getByLabelText(/^State/), 'Telangana')
    await fill(user, screen.getByLabelText(/PIN/), '500032')
    await fill(user, screen.getByLabelText(/phone/i), '9876543210')
    await fill(user, screen.getByLabelText(/email/i), 'gcb@aura.test')
    await user.click(screen.getAllByRole('button', { name: 'Create branch' })[0])

    await waitFor(() => expect(billingFake.config.state.branches).toHaveLength(3))
    const created = billingFake.config.state.branches[2]
    expect(created).toMatchObject({ name: 'Gachibowli Clinic', code: 'GCB-01', pinCode: '500032', isPrimary: false })
    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.branch, { branchId: created.id })))
  })

  it('shows the server error when the branch code is taken', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.branchNew)

    await fill(user, await screen.findByLabelText(/Branch name/), 'Second Main')
    await fill(user, screen.getByLabelText(/Branch code/), 'MAIN')
    await user.selectOptions(screen.getByLabelText(/Facility type/), 'Outpatient Practice')
    await fill(user, screen.getByLabelText(/Address line 1/), 'Road 1')
    await fill(user, screen.getByLabelText(/^City/), 'Hyderabad')
    await fill(user, screen.getByLabelText(/^State/), 'Telangana')
    await fill(user, screen.getByLabelText(/PIN/), '500033')
    await fill(user, screen.getByLabelText(/phone/i), '9876543210')
    await fill(user, screen.getByLabelText(/email/i), 'x@aura.test')
    await user.click(screen.getAllByRole('button', { name: 'Create branch' })[0])

    expect(await screen.findByText('Branch not created')).toBeInTheDocument()
    expect(billingFake.config.state.branches).toHaveLength(2)
  })
})

describe('branch detail page', () => {
  it('keeps the primary branch active', async () => {
    renderRoute(pathFor(ROUTES.branch, { branchId: 'b-main' }))
    expect(await screen.findByText(/This is the primary branch/)).toBeInTheDocument()
  })

  it('asks for confirmation before pausing a branch', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.branch, { branchId: 'b-kdp' }))

    await user.click(await screen.findByRole('button', { name: 'Pause branch' }))
    await user.click(screen.getByRole('button', { name: 'Confirm: Paused' }))

    await waitFor(() => expect(billingFake.config.state.branches[1].status).toBe('paused'))
  })

  it('says when the branch does not exist', async () => {
    renderRoute(pathFor(ROUTES.branch, { branchId: 'missing' }))
    expect(await screen.findByRole('heading', { name: 'Branch not found' })).toBeInTheDocument()
  })
})

describe('operating hours page', () => {
  const path = pathFor(ROUTES.branchHours, { branchId: 'b-main' })

  it('edits the weekly schedule and saves it', async () => {
    const user = userEvent.setup()
    renderRoute(path)

    await user.click(await screen.findByRole('button', { name: 'Open on Tuesday' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(billingFake.config.state.branches[0].hours.filter((session) => session.weekday === 2)).toHaveLength(1))
    expect(await screen.findByText('Operating hours saved.')).toBeInTheDocument()
  })

  it('copies Monday to the other weekdays', async () => {
    const user = userEvent.setup()
    renderRoute(path)

    await user.click(await screen.findByRole('button', { name: 'Copy Monday to weekdays' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(billingFake.config.state.branches[0].hours).toHaveLength(10))
  })

  it('adds and removes a schedule exception', async () => {
    const user = userEvent.setup()
    renderRoute(path)

    const submit = () => screen.getAllByRole('button', { name: 'Add exception' }).at(-1)
    await screen.findByLabelText(/^Date/)
    await user.click(submit())
    expect(screen.getByText('Pick a date.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Date/), '2026-12-25')
    await fill(user, screen.getByLabelText(/Reason/), 'Christmas')
    await user.click(submit())

    expect(await screen.findByText('Christmas')).toBeInTheDocument()
    expect(billingFake.config.state.closures[0]).toMatchObject({ branchId: 'b-main', date: '2026-12-25', kind: 'closed', reason: 'Christmas' })

    await user.click(screen.getByRole('button', { name: 'Remove Christmas' }))
    await waitFor(() => expect(screen.queryByText('Christmas')).not.toBeInTheDocument())
    expect(billingFake.config.state.closures).toHaveLength(0)
  })

  it('shows the server error for a date in the past', async () => {
    const user = userEvent.setup()
    billingFake.useConfig(createConfigApi({ branches: [apiBranch()] }))
    renderRoute(path)

    await user.type(await screen.findByLabelText(/^Date/), '2026-01-01')
    await fill(user, screen.getByLabelText(/Reason/), 'Old date')
    await user.click(screen.getAllByRole('button', { name: 'Add exception' }).at(-1))

    expect(await screen.findByText('Choose today or a later date.')).toBeInTheDocument()
  })
})

describe('departments', () => {
  it('lists departments with their people and filters them by status', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.departments)

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: 'Cardiology' })).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'General Medicine' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Status/), 'inactive')
    expect(screen.getByText('No departments match your filters.')).toBeInTheDocument()
  })

  it('creates a department at the chosen branches', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.departmentNew)

    await user.click((await screen.findAllByRole('button', { name: 'Create department' }))[0])
    expect(screen.getByText('Enter the department name.')).toBeInTheDocument()
    expect(screen.getByText('Choose at least one clinic location.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/Department name/), 'Orthopedics')
    await fill(user, screen.getByLabelText(/Department code/), 'ORTHO')
    await user.click(await screen.findByRole('checkbox', { name: 'Kondapur Clinic' }))
    await user.click(screen.getAllByRole('button', { name: 'Create department' })[0])

    await waitFor(() => expect(billingFake.config.state.departments).toHaveLength(3))
    const created = billingFake.config.state.departments[2]
    expect(created).toMatchObject({ name: 'Orthopedics', code: 'ORTHO', type: 'Clinical', branchIds: ['b-kdp'] })
    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.department, { departmentId: created.id })))
  })

  it('refuses a department name that already exists', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.departmentNew)

    await fill(user, await screen.findByLabelText(/Department name/), 'cardiology')
    await fill(user, screen.getByLabelText(/Department code/), 'CARD2')
    await user.click(await screen.findByRole('checkbox', { name: 'Main Clinic' }))
    await user.click(screen.getAllByRole('button', { name: 'Create department' })[0])

    expect(await screen.findByText('Department not created')).toBeInTheDocument()
    expect(billingFake.config.state.departments).toHaveLength(2)
  })

  it('renames a department and its people follow', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.department, { departmentId: 'd-card' }))

    await user.click(await screen.findByRole('button', { name: 'Edit department' }))
    const name = screen.getByLabelText(/Department name/)
    await user.clear(name)
    await fill(user, name, 'Cardiology & Vascular')
    await user.click(screen.getByRole('button', { name: 'Save details' }))

    expect(await screen.findByText(/Department renamed/)).toBeInTheDocument()
    expect(billingFake.config.state.people[0].department).toBe('Cardiology & Vascular')
  })

  it('deactivates a department after confirmation', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.department, { departmentId: 'd-card' }))

    await user.click(await screen.findByRole('button', { name: 'Deactivate Cardiology' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deactivation' }))

    await waitFor(() => expect(billingFake.config.state.departments[0].status).toBe('inactive'))
  })

  it('adds and removes department locations', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.departmentLocations, { departmentId: 'd-card' }))

    await user.click(await screen.findByRole('button', { name: 'Add location' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Kondapur Clinic' }))
    await user.click(screen.getByRole('button', { name: 'Add 1 location to department' }))

    await waitFor(() => expect(billingFake.config.state.departments[0].branchIds).toEqual(['b-main', 'b-kdp']))

    const row = screen.getAllByRole('row').find((entry) => within(entry).queryByText('Kondapur Clinic'))
    await user.click(within(row).getByRole('button', { name: 'Remove' }))
    await user.click(within(row).getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(billingFake.config.state.departments[0].branchIds).toEqual(['b-main']))
  })
})
