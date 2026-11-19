import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../config/routes'
import { authState } from '../../test/auth'
import { billingFake } from '../../test/fixtures/billingFake'
import { createWorkspaceApi } from '../../test/fixtures/workspaceApi'
import { renderRoute } from '../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function openDashboard(options) {
  const router = renderRoute(ROUTES.dashboard, undefined, options)
  await screen.findByText('22 scheduled')
  return router
}

describe('workspace header', () => {
  it('chooses the working location for every page and remembers it', async () => {
    const user = setup()
    await openDashboard()
    const location = screen.getByRole('combobox', { name: 'Working location' })
    await waitFor(() => expect(location).toBeEnabled())
    expect(within(location).getAllByRole('option').map((option) => option.textContent)).toEqual(['All locations (2)', 'Main Clinic', 'Kondapur Clinic'])

    await user.selectOptions(location, 'b-kondapur')
    await waitFor(() => expect(billingFake.dashboard.calls.at(-1).query.branchId).toBe('b-kondapur'))
    await waitFor(() => expect(billingFake.workspace.calls.filter((call) => call.name === 'alerts').at(-1).query).toEqual({ branchId: 'b-kondapur' }))
    // The dashboard's own filter is the same choice.
    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('b-kondapur')
    expect(localStorage.getItem('clinicos.workspace.branch:org-1')).toBe('b-kondapur')
  })

  it('starts from the remembered location', async () => {
    localStorage.setItem('clinicos.workspace.branch:org-1', 'b-kondapur')
    await openDashboard()
    expect(screen.getByRole('combobox', { name: 'Working location' })).toHaveValue('b-kondapur')
    expect(billingFake.dashboard.calls[0].query.branchId).toBe('b-kondapur')
  })

  it('offers only the branches a branch-limited role covers, dropping a remembered one outside them', async () => {
    localStorage.setItem('clinicos.workspace.branch:org-1', 'b-main')
    const auth = authState({ permissions: ['dashboard.view', 'bookings.view', 'patients.view'] })
    auth.organisation = { ...auth.organisation, branchScope: ['b-kondapur'] }
    await openDashboard({ auth })
    const location = screen.getByRole('combobox', { name: 'Working location' })
    await waitFor(() => expect(within(location).getAllByRole('option').map((option) => option.textContent)).toEqual(['Kondapur Clinic']))
    expect(location).toHaveValue('')
    expect(location).toBeDisabled()
  })

  it('lists open items behind the alerts, each linking to where it is handled', async () => {
    const user = setup()
    await openDashboard()
    const bell = await screen.findByRole('button', { name: 'Alerts (3 need attention)' })
    await user.click(bell)
    const panel = screen.getByRole('region', { name: 'Alerts' })
    expect(within(panel).getByRole('link', { name: /2 patients waiting/ })).toHaveAttribute('href', ROUTES.appointments)
    expect(within(panel).getByRole('link', { name: /4 results awaiting review/ })).toHaveAttribute('href', ROUTES.clinical)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Alerts' })).not.toBeInTheDocument()
  })

  it('says so when nothing is open', async () => {
    const user = setup()
    billingFake.useWorkspace(createWorkspaceApi({ alerts: () => ({ generatedAt: '2026-11-18T09:30:00.000Z', branchId: null, items: [] }) }))
    await openDashboard()
    await user.click(await screen.findByRole('button', { name: 'Alerts' }))
    expect(await screen.findByText('Nothing needs your attention right now.')).toBeInTheDocument()
  })

  it('searches patients, appointments and invoices and opens the chosen one', async () => {
    const user = setup()
    const router = await openDashboard()
    const search = screen.getByRole('combobox', { name: 'Search' })
    await user.click(search)
    await user.paste('anan')

    const results = await screen.findByRole('listbox', { name: 'Search results' })
    expect(await within(results).findByRole('option', { name: /Ananya Sharma PT-000001/ })).toBeInTheDocument()
    expect(within(results).getByRole('group', { name: 'Invoices' })).toHaveTextContent('INV-000007 · Ananya Sharma')
    expect(billingFake.workspace.calls.filter((call) => call.name === 'search').at(-1)).toEqual({ name: 'search', q: 'anan' })

    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/p-1/appointment/a-1'))
  })

  it('jumps to the search with the keyboard shortcut and explains when nothing matches', async () => {
    const user = setup()
    billingFake.useWorkspace(createWorkspaceApi({ search: (q) => ({ query: q, patients: [], appointments: [], invoices: null }) }))
    await openDashboard()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus()
    await user.paste('zz')
    expect(await screen.findByText('No patients, appointments or invoices match “zz”.')).toBeInTheDocument()
  })

  it('links Emergency Intake and New Encounter to the walk-in desk, for roles that can book', async () => {
    await openDashboard()
    expect(screen.getByRole('link', { name: 'Emergency Intake' })).toHaveAttribute('href', `${ROUTES.appointments}?walkIn=emergency`)
    expect(screen.getAllByRole('link', { name: 'New Encounter' })[0]).toHaveAttribute('href', `${ROUTES.appointments}?walkIn=1`)
    expect(screen.queryByRole('button', { name: 'Help documentation' })).not.toBeInTheDocument()
  })

  it('leaves out intake and search for roles without those records', async () => {
    await openDashboard({ auth: authState({ permissions: ['dashboard.view', 'staff.view'] }) })
    expect(screen.queryByRole('link', { name: 'Emergency Intake' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New Encounter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument()
  })
})

describe('workspace sidebar', () => {
  it('shows the organisation, its locations and the live backend health', async () => {
    await openDashboard()
    expect(screen.getAllByText('Aura Health').length).toBeGreaterThan(0)
    expect(await screen.findAllByText('All 2 locations')).not.toHaveLength(0)
    expect(await screen.findAllByText(/^Operational · \d+ ms$/)).not.toHaveLength(0)
    expect(screen.queryByText('99.98%')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch organisation' })).not.toBeInTheDocument()
    expect(screen.queryByText('Support')).not.toBeInTheDocument()
  })

  it('says when the backend does not answer its health check', async () => {
    billingFake.useWorkspace(createWorkspaceApi({ healthy: false }))
    await openDashboard()
    expect(await screen.findAllByText('Unavailable')).not.toHaveLength(0)
  })

  it('switches to another organisation and opens the first page that role allows', async () => {
    const user = setup()
    const auth = authState()
    const clinicTwo = { membershipId: 'member-2', organisation: { id: 'org-2', name: 'Lotus Physio', status: 'active' }, roles: [{ id: 'role-desk', name: 'Front Desk & Reception' }], permissions: ['patients.view', 'bookings.view'], branchScope: ['b-main'] }
    auth.memberships = [...auth.memberships, clinicTwo]
    const router = await openDashboard({ auth })

    await user.click(screen.getAllByRole('button', { name: 'Switch organisation' })[0])
    await user.click(screen.getByRole('menuitem', { name: /Lotus Physio/ }))
    expect(auth.selectOrganisation).toHaveBeenCalledWith('org-2')
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.patients))
  })
})
