import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { createAccessApi } from '../../../test/fixtures/accessApi'
import { renderRoute } from '../../../test/renderRoute'

const fake = vi.hoisted(() => ({ api: null }))
vi.mock('../../auth/api', () => ({
  authApi: {},
  accessApi: new Proxy({}, { get: (_, method) => (...args) => fake.api[method](...args) }),
}))

beforeEach(() => {
  fake.api = createAccessApi()
})

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

const inspector = (name) => screen.getByRole('region', { name: `${name} inspector` })

async function openRoles() {
  const router = renderRoute(ROUTES.roles)
  await screen.findByRole('heading', { name: 'Role management' })
  return router
}

async function openCreateRole() {
  const router = renderRoute(ROUTES.roleNew)
  await screen.findByRole('heading', { name: 'Create role' })
  return router
}

describe('role management page', () => {
  it('is reachable from the sidebar and highlights its tab', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.dashboard)

    await user.click(screen.getByRole('link', { name: 'Role Management' }))
    expect(router.state.location.pathname).toBe(ROUTES.roles)
    expect(await screen.findByRole('link', { name: 'Role Management' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Configuration' })).not.toHaveAttribute('aria-current')
  })

  it('lists roles from the API and inspects the first custom role by default', async () => {
    await openRoles()

    expect(screen.getByText('7 roles')).toBeInTheDocument()
    expect(within(inspector('Branch Manager')).getByText('18/34 permissions enabled')).toBeInTheDocument()
    expect(fake.api.roles).toHaveBeenCalled()
  })

  it('filters by search text, scope and status, and resets the filters', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()

    await fill(user, screen.getByLabelText('Search roles'), 'physio')
    expect(screen.getByRole('button', { name: 'Senior Physiotherapist' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Front Desk & Reception' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    await user.selectOptions(screen.getByLabelText('Access scope'), 'Org-wide')
    expect(screen.getByText('Showing 3 of 7 roles across 3 categories')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Status'), 'Draft')
    expect(screen.getByText('No roles match your filters.')).toBeInTheDocument()
  })

  it('saves an edited role through the API with its version', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()

    await user.click(screen.getByRole('button', { name: 'Edit Front Desk & Reception' }))
    const panel = inspector('Front Desk & Reception')
    await user.click(within(panel).getByRole('switch', { name: 'Assign & dispatch therapist' }))
    await user.click(within(panel).getByRole('button', { name: 'Save role changes' }))

    expect(await within(inspector('Front Desk & Reception')).findByText('7/34 permissions enabled')).toBeInTheDocument()
    expect(within(inspector('Front Desk & Reception')).queryByRole('switch')).not.toBeInTheDocument()
    expect(fake.api.updateRole).toHaveBeenCalledWith('front-desk', expect.objectContaining({ version: 1, permissions: expect.arrayContaining(['bookings.assign']) }))
  })

  it('shows the server error and stays in edit mode when saving fails', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()
    fake.api.updateRole.mockRejectedValueOnce(new Error('Someone else changed this role. Reload and try again.'))

    await user.click(screen.getByRole('button', { name: 'Edit Front Desk & Reception' }))
    const panel = inspector('Front Desk & Reception')
    await user.click(within(panel).getByRole('button', { name: 'Save role changes' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Someone else changed this role.')
    expect(within(panel).getByRole('button', { name: 'Save role changes' })).toBeEnabled()
  })

  it('will not save a branch-scoped role without branches', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()

    await user.click(screen.getByRole('button', { name: 'Edit Field Dispatch Lead' }))
    const panel = inspector('Field Dispatch Lead')
    await user.click(within(panel).getByRole('checkbox', { name: 'Kondapur Clinic' }))
    await user.click(within(panel).getByRole('button', { name: 'Save role changes' }))

    expect(within(panel).getByRole('alert')).toHaveTextContent('Select at least one branch.')
    expect(fake.api.updateRole).not.toHaveBeenCalled()
  })

  it('keeps the system role read-only and deactivates a custom role', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()

    expect(screen.getByRole('button', { name: 'Edit Super Admin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deactivate Super Admin' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Deactivate HR & Compliance Officer' }))
    expect(await screen.findByRole('button', { name: 'Activate HR & Compliance Officer' })).toBeInTheDocument()
    expect(fake.api.updateRole).toHaveBeenCalledWith('hr-compliance', expect.objectContaining({ status: 'inactive' }))
  })

  it('shows permission counts per group in matrix view', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()

    await user.click(screen.getByRole('tab', { name: 'Matrix' }))
    expect(screen.getByRole('columnheader', { name: 'Accounting & billing' })).toBeInTheDocument()
    expect(screen.getAllByText('5/5').length).toBeGreaterThan(0)
  })

  it('offers a retry when roles cannot be loaded', async () => {
    const user = userEvent.setup({ delay: null })
    fake.api.roles.mockRejectedValueOnce(new Error('Cannot reach ClinicOS. Check your connection and try again.'))
    renderRoute(ROUTES.roles)

    expect(await screen.findByText('Cannot reach ClinicOS. Check your connection and try again.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Role management' })).toBeInTheDocument()
  })

  it('is closed to people without the role-management permission', async () => {
    renderRoute(ROUTES.roles, undefined, { auth: authState({ permissions: ['dashboard.view', 'bookings.view'], roles: [{ id: 'r', name: 'Front Desk & Reception' }] }) })

    expect(screen.getByRole('heading', { name: 'You do not have access to this page' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Role Management' })).not.toBeInTheDocument()
    expect(fake.api.roles).not.toHaveBeenCalled()
  })
})

describe('create role page', () => {
  it('validates the form before creating a role', async () => {
    const user = userEvent.setup({ delay: null })
    await openCreateRole()

    await user.click(screen.getByRole('button', { name: 'Create role' }))
    expect(screen.getByText('Enter the role name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a staff category.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one branch.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one permission.')).toBeInTheDocument()
    expect(fake.api.createRole).not.toHaveBeenCalled()
  })

  it('creates a branch-scoped role and opens it in the inspector', async () => {
    const user = userEvent.setup({ delay: null })
    const router = await openCreateRole()

    await fill(user, screen.getByLabelText(/Role name/), 'Clinical Lead')
    await user.selectOptions(screen.getByLabelText(/Staff category/), 'Physiotherapy')
    await user.click(screen.getByRole('checkbox', { name: 'Main Clinic' }))
    await user.click(screen.getByRole('button', { name: 'Select all Bookings & appointments' }))
    expect(screen.getByText('6 of 34 permissions selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'View revenue metrics' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Create role' }))

    expect(await screen.findByRole('region', { name: 'Clinical Lead inspector' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.roles)
    expect(within(inspector('Clinical Lead')).getByText('6/34 permissions enabled')).toBeInTheDocument()
    expect(screen.getByText('8 roles')).toBeInTheDocument()
    expect(fake.api.createRole).toHaveBeenCalledWith(expect.objectContaining({ name: 'Clinical Lead', scope: 'branch', branchIds: ['main'], status: 'active' }))
  })

  it('shows a server rejection without leaving the form', async () => {
    const user = userEvent.setup({ delay: null })
    const router = await openCreateRole()
    fake.api.createRole.mockRejectedValueOnce(new Error('This role cannot hold: accounting.revenue.'))

    await fill(user, screen.getByLabelText(/Role name/), 'Night Supervisor')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This role cannot hold: accounting.revenue.')
    expect(router.state.location.pathname).toBe(ROUTES.roleNew)
  })

  it('drops financial rights when an org-wide role is narrowed to branches', async () => {
    const user = userEvent.setup({ delay: null })
    await openCreateRole()

    await user.click(screen.getByRole('radio', { name: /Organization-wide/ }))
    await user.click(screen.getByRole('checkbox', { name: 'View revenue metrics' }))
    expect(screen.getByText(/1 financial permission granted/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Specific branches/ }))
    expect(screen.getByRole('checkbox', { name: 'View revenue metrics' })).not.toBeChecked()
    expect(screen.getByText(/zero financial & payroll exposure/)).toBeInTheDocument()
  })

  it('saves a draft with only a name', async () => {
    const user = userEvent.setup({ delay: null })
    await openCreateRole()

    await fill(user, screen.getByLabelText(/Role name/), 'Night Shift Supervisor')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))

    expect(await screen.findByRole('region', { name: 'Night Shift Supervisor inspector' })).toBeInTheDocument()
    expect(within(inspector('Night Shift Supervisor')).getByText('Draft')).toBeInTheDocument()
  })

  it('prefills a copy when duplicating a role', async () => {
    const user = userEvent.setup({ delay: null })
    await openRoles()

    await user.click(screen.getByRole('button', { name: 'Duplicate Branch Manager' }))
    expect(screen.getByLabelText(/Role name/)).toHaveValue('Branch Manager (Copy)')
    expect(screen.getByRole('checkbox', { name: 'Kondapur Clinic' })).toBeChecked()
    expect(screen.getByText('18 of 34 permissions selected')).toBeInTheDocument()
  })
})
