import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

const inspector = (name) => screen.getByRole('region', { name: `${name} inspector` })

describe('role management page', () => {
  it('is reachable from the sidebar and highlights its tab', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.dashboard)

    await user.click(screen.getByRole('link', { name: 'Role Management' }))
    expect(router.state.location.pathname).toBe(ROUTES.roles)
    expect(screen.getByRole('link', { name: 'Role Management' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Configuration' })).not.toHaveAttribute('aria-current')
  })

  it('lists roles and inspects the first custom role by default', () => {
    renderRoute(ROUTES.roles)

    expect(screen.getByRole('heading', { name: 'Role management' })).toBeInTheDocument()
    expect(screen.getByText('7 roles')).toBeInTheDocument()
    expect(within(inspector('Branch Manager')).getByText('18/22 permissions enabled')).toBeInTheDocument()
  })

  it('filters by search text, scope and status, and resets the filters', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roles)

    await fill(user, screen.getByLabelText('Search roles'), 'physio')
    expect(screen.getByRole('button', { name: 'Senior Physiotherapist' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Front Desk & Reception' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    await user.selectOptions(screen.getByLabelText('Access scope'), 'Org-wide')
    expect(screen.getByText('Showing 3 of 7 roles across 3 categories')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Status'), 'Draft')
    expect(screen.getByText('No roles match your filters.')).toBeInTheDocument()
  })

  it('edits a role and keeps the change after saving', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roles)

    await user.click(screen.getByRole('button', { name: 'Edit Front Desk & Reception' }))
    const panel = inspector('Front Desk & Reception')
    await user.click(within(panel).getByRole('switch', { name: 'Assign & dispatch therapist' }))
    await user.click(within(panel).getByRole('button', { name: 'Save role changes' }))

    expect(within(inspector('Front Desk & Reception')).getByText('7/22 permissions enabled')).toBeInTheDocument()
    expect(within(inspector('Front Desk & Reception')).queryByRole('switch')).not.toBeInTheDocument()
  })

  it('will not save a branch-scoped role without branches', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roles)

    await user.click(screen.getByRole('button', { name: 'Edit Field Dispatch Lead' }))
    const panel = inspector('Field Dispatch Lead')
    await user.click(within(panel).getByRole('checkbox', { name: 'Kondapur Clinic' }))
    await user.click(within(panel).getByRole('button', { name: 'Save role changes' }))

    expect(within(panel).getByRole('alert')).toHaveTextContent('Select at least one branch.')
  })

  it('keeps the system role read-only and deactivates a custom role', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roles)

    expect(screen.getByRole('button', { name: 'Edit Super Admin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deactivate Super Admin' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Deactivate HR & Compliance Officer' }))
    expect(screen.getByRole('button', { name: 'Activate HR & Compliance Officer' })).toBeInTheDocument()
  })

  it('shows permission counts per group in matrix view', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roles)

    await user.click(screen.getByRole('tab', { name: 'Matrix' }))
    expect(screen.getByRole('columnheader', { name: 'Accounting & billing' })).toBeInTheDocument()
    expect(screen.getAllByText('5/5').length).toBeGreaterThan(0)
  })
})

describe('create role page', () => {
  it('validates the form before creating a role', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roleNew)

    await user.click(screen.getByRole('button', { name: 'Create role' }))
    expect(screen.getByText('Enter the role name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a staff category.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one branch.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one permission.')).toBeInTheDocument()
  })

  it('creates a branch-scoped role and opens it in the inspector', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.roleNew)

    await fill(user, screen.getByLabelText(/Role name/), 'Clinical Lead')
    await user.selectOptions(screen.getByLabelText(/Staff category/), 'Physiotherapy')
    await user.click(screen.getByRole('checkbox', { name: 'Main Clinic' }))
    await user.click(screen.getByRole('button', { name: 'Select all Bookings & appointments' }))
    expect(screen.getByText('6 of 22 permissions selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'View revenue metrics' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Create role' }))

    expect(router.state.location.pathname).toBe(ROUTES.roles)
    expect(within(inspector('Clinical Lead')).getByText('6/22 permissions enabled')).toBeInTheDocument()
    expect(screen.getByText('8 roles')).toBeInTheDocument()
  })

  it('drops financial rights when an org-wide role is narrowed to branches', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roleNew)

    await user.click(screen.getByRole('radio', { name: /Organization-wide/ }))
    await user.click(screen.getByRole('checkbox', { name: 'View revenue metrics' }))
    expect(screen.getByText(/1 financial permission granted/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Specific branches/ }))
    expect(screen.getByRole('checkbox', { name: 'View revenue metrics' })).not.toBeChecked()
    expect(screen.getByText(/zero financial & payroll exposure/)).toBeInTheDocument()
  })

  it('saves a draft with only a name', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roleNew)

    await fill(user, screen.getByLabelText(/Role name/), 'Night Shift Supervisor')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))

    expect(within(inspector('Night Shift Supervisor')).getByText('Draft')).toBeInTheDocument()
  })

  it('prefills a copy when duplicating a role', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(ROUTES.roles)

    await user.click(screen.getByRole('button', { name: 'Duplicate Branch Manager' }))
    expect(screen.getByLabelText(/Role name/)).toHaveValue('Branch Manager (Copy)')
    expect(screen.getByRole('checkbox', { name: 'Kondapur Clinic' })).toBeChecked()
    expect(screen.getByText('18 of 22 permissions selected')).toBeInTheDocument()
  })
})
