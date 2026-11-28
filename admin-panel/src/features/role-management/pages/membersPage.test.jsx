import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { ApiError } from '../../../lib/api'
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

async function openMembers(path = ROUTES.roleMembers) {
  const router = renderRoute(path)
  await screen.findByRole('heading', { name: 'Members' })
  return router
}

const rowOf = (email) => screen.getByText(email).closest('tr')
const drawer = () => screen.getByRole('dialog')

describe('members page', () => {
  it('opens from the roles page and lists each person with their roles', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.roles)

    await user.click(await screen.findByRole('link', { name: 'Members' }))

    expect(router.state.location.pathname).toBe(ROUTES.roleMembers)
    expect(await screen.findByText('Showing 3 of 3 members')).toBeInTheDocument()
    expect(within(rowOf('anita@aura.test')).getByText('Front Desk & Reception')).toBeInTheDocument()
    expect(within(rowOf('vikram@aura.test')).getByText('Suspended')).toBeInTheDocument()
  })

  it('searches from the address and filters by role', async () => {
    const user = userEvent.setup({ delay: null })
    await openMembers(`${ROUTES.roleMembers}?q=anita%40aura.test`)

    expect(screen.getByText('Showing 1 of 3 members')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Search members'))
    await user.selectOptions(screen.getByLabelText('Role'), 'Branch Manager')

    expect(screen.getByText('vikram@aura.test')).toBeInTheDocument()
    expect(screen.queryByText('anita@aura.test')).not.toBeInTheDocument()
  })

  it('offers no changes to your own access', async () => {
    await openMembers()

    const own = within(rowOf('owner@aura.test'))
    expect(own.getByText(/This is you/)).toBeInTheDocument()
    expect(own.queryByRole('button')).not.toBeInTheDocument()
  })

  it('replaces a person’s roles with exactly the ticked ones', async () => {
    const user = userEvent.setup({ delay: null })
    await openMembers()

    await user.click(screen.getByRole('button', { name: 'Change roles for Anita Rao' }))
    const panel = within(drawer())
    expect(panel.getByRole('button', { name: 'Save roles' })).toBeDisabled()
    await user.click(panel.getByRole('checkbox', { name: 'Front Desk & Reception' }))
    await user.click(panel.getByRole('checkbox', { name: 'Branch Manager' }))
    expect(panel.getByText('Adding: Branch Manager')).toBeInTheDocument()
    expect(panel.getByText('Removing: Front Desk & Reception')).toBeInTheDocument()
    await user.click(panel.getByRole('button', { name: 'Save roles' }))

    expect(fake.api.setMemberRoles).toHaveBeenCalledWith('member-2', ['branch-manager'])
    expect(await screen.findByText('Anita Rao now has: Branch Manager.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(within(rowOf('anita@aura.test')).queryByText('Front Desk & Reception')).not.toBeInTheDocument())
  })

  it('warns before granting full access or leaving someone without a role', async () => {
    const user = userEvent.setup({ delay: null })
    await openMembers()

    await user.click(screen.getByRole('button', { name: 'Change roles for Anita Rao' }))
    const panel = within(drawer())
    await user.click(panel.getByRole('checkbox', { name: 'Front Desk & Reception' }))
    expect(panel.getByText(/cannot open anything/)).toBeInTheDocument()
    await user.click(panel.getByRole('checkbox', { name: 'Super Admin' }))

    expect(panel.getByText(/unrestricted access to every branch/)).toBeInTheDocument()
    expect(fake.api.setMemberRoles).not.toHaveBeenCalled()
  })

  it('keeps the panel open with the server’s reason when saving fails', async () => {
    const user = userEvent.setup({ delay: null })
    await openMembers()
    fake.api.setMemberRoles.mockRejectedValueOnce(new ApiError(409, 'LAST_OWNER', 'The organisation must keep at least one active Super Admin.'))

    await user.click(screen.getByRole('button', { name: 'Change roles for Anita Rao' }))
    await user.click(within(drawer()).getByRole('checkbox', { name: 'Branch Manager' }))
    await user.click(within(drawer()).getByRole('button', { name: 'Save roles' }))

    expect(await within(drawer()).findByRole('alert')).toHaveTextContent('at least one active Super Admin')
    expect(within(drawer()).getByRole('button', { name: 'Save roles' })).toBeEnabled()
  })

  it('suspends only after confirmation, and reactivates', async () => {
    const user = userEvent.setup({ delay: null })
    await openMembers()

    await user.click(screen.getByRole('button', { name: 'Suspend Anita Rao' }))
    expect(fake.api.setMemberStatus).not.toHaveBeenCalled()
    await user.click(within(drawer()).getByRole('button', { name: 'Suspend access' }))
    expect(fake.api.setMemberStatus).toHaveBeenCalledWith('member-2', 'suspended')
    expect(await screen.findByText('Anita Rao is suspended.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reactivate Vikram Shah' }))
    await user.click(within(drawer()).getByRole('button', { name: 'Restore access' }))
    expect(fake.api.setMemberStatus).toHaveBeenCalledWith('member-3', 'active')
  })

  it('offers a retry when members cannot be loaded', async () => {
    const user = userEvent.setup({ delay: null })
    fake.api.members.mockRejectedValueOnce(new Error('Cannot reach ClinicOS.'))
    renderRoute(ROUTES.roleMembers)

    expect(await screen.findByText('Cannot reach ClinicOS.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Members' })).toBeInTheDocument()
  })

  it('is closed to people without the role-management permission', () => {
    renderRoute(ROUTES.roleMembers, undefined, { auth: authState({ permissions: ['dashboard.view', 'staff.credentials'] }) })

    expect(screen.getByRole('heading', { name: 'You do not have access to this page' })).toBeInTheDocument()
    expect(fake.api.members).not.toHaveBeenCalled()
  })
})
