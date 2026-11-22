import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { billingFake } from '../../../test/fixtures/billingFake'
import { apiBranch, apiDepartment, createConfigApi } from '../../../test/fixtures/configApi'
import { apiStaff, createStaffApi } from '../../../test/fixtures/staffApi'
import { renderRoute } from '../../../test/renderRoute'

// Roles, members and staff come from per-file fakes; the configuration, billing and inventory fakes from test/setup.js.
const fake = vi.hoisted(() => ({ access: null, staff: null }))
vi.mock('../../auth/api', () => ({
  authApi: {},
  accessApi: new Proxy({}, { get: (_, method) => (...args) => fake.access[method](...args) }),
}))
vi.mock('../../staff/api', () => ({ staffApi: new Proxy({}, { get: (_, method) => (...args) => fake.staff.api[method](...args) }) }))

const role = (id, name, overrides) => ({ id, name, category: 'Operations', scope: 'branch', isSystem: false, status: 'active', description: '', version: 1, permissions: ['patients.view'], branchIds: [], ...overrides })
const member = (id, fullName, roleIds) => ({ id, status: 'active', joinedAt: '2026-10-01T09:00:00.000Z', version: 1, user: { id: `u-${id}`, fullName, email: `${id}@aura.test` }, roles: roleIds.map((roleId) => ({ id: roleId, name: roleId })) })

function createAccess() {
  const state = {
    roles: [
      role('Owner', 'Owner', { scope: 'org', isSystem: true, permissions: ['settings.roles', 'settings.organisation'] }),
      role('Front Desk', 'Front Desk', { branchIds: ['b-main'], permissions: ['patients.view', 'bookings.create'] }),
      role('Auditor', 'Auditor', { branchIds: ['b-kondapur'] }),
    ],
    members: [member('m-1', 'Siddharth Verma', ['Owner']), member('m-2', 'Kavya Reddy', ['Front Desk']), member('m-3', 'Arjun Nair', ['Auditor'])],
  }
  return {
    state,
    roles: async () => JSON.parse(JSON.stringify(state.roles)),
    members: async () => JSON.parse(JSON.stringify(state.members)),
    setMemberRoles: async (id, roleIds) => {
      const entry = state.members.find((item) => item.id === id)
      entry.roles = roleIds.map((roleId) => ({ id: roleId, name: roleId }))
      return entry
    },
    updateRole: async (id, { version, ...changes }) => {
      const entry = state.roles.find((item) => item.id === id)
      if (entry.version !== version) throw new Error('Someone else changed this role.')
      Object.assign(entry, changes, { version: version + 1 })
      return entry
    },
  }
}

const RAO = apiStaff({ branches: [{ id: 'b-main', name: 'Main Clinic', city: 'Hyderabad', isPrimary: true }], department: 'Cardiology' })
const NURSE = apiStaff({ id: 's-2', staffCode: 'STF-002', type: 'staff', fullName: 'Priya Sharma', designation: 'Head Nurse', department: 'General Medicine', council: null, councilNumber: null, qualifications: [], branches: [{ id: 'b-kondapur', name: 'Kondapur Clinic', city: 'Hyderabad', isPrimary: true }] })

const KONDAPUR = apiBranch({ id: 'b-kondapur', code: 'KDP', name: 'Kondapur Clinic', isPrimary: false, hours: [] })

beforeEach(() => {
  billingFake.useConfig(createConfigApi({ branches: [apiBranch(), KONDAPUR], departments: [apiDepartment(), apiDepartment({ id: 'd-gen', code: 'GEN', name: 'General Medicine', branchIds: ['b-main', 'b-kondapur'] })] }))
  fake.access = createAccess()
  fake.staff = createStaffApi({ people: [RAO, NURSE] })
})

describe('branch access page', () => {
  const path = pathFor(ROUTES.branchAccess, { branchId: 'b-main' })

  it('lists the people whose roles reach the branch, with their level', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(path)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Siddharth Verma')).toBeInTheDocument()
    expect(within(table).getByText('Kavya Reddy')).toBeInTheDocument()
    expect(within(table).queryByText('Arjun Nair')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Access level'), 'Full')
    expect(within(table).queryByText('Kavya Reddy')).not.toBeInTheDocument()
  })

  it('gives a person a role that covers the branch', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(path)

    await user.click(await screen.findByRole('button', { name: 'Add access' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.branchAccessAdd, { branchId: 'b-main' })))

    await user.click(screen.getByRole('button', { name: 'Grant branch access' }))
    expect(screen.getByText('Select at least one person.')).toBeInTheDocument()
    expect(screen.getByText('Choose the role to give them.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Front Desk/ }))
    expect(screen.getByRole('checkbox', { name: 'Kavya Reddy' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Arjun Nair' }))
    await user.click(screen.getByRole('button', { name: 'Grant branch access' }))

    await waitFor(() => expect(fake.access.state.members[2].roles.map((entry) => entry.id)).toEqual(['Auditor', 'Front Desk']))
    expect(await screen.findByText('1 person given Front Desk.')).toBeInTheDocument()
  })

  it('extends a branch role to this branch', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.branchAccessAdd, { branchId: 'b-main' }))

    await user.click(await screen.findByRole('tab', { name: 'Branch roles' }))
    await user.click(screen.getByRole('checkbox', { name: 'Auditor' }))
    await user.click(screen.getByRole('button', { name: 'Grant branch access' }))

    await waitFor(() => expect(fake.access.state.roles[2].branchIds).toEqual(['b-kondapur', 'b-main']))
  })
})

describe('department access page', () => {
  it('shows who reaches the department through its branches', async () => {
    renderRoute(pathFor(ROUTES.departmentAccess, { departmentId: 'd-gen' }))

    const table = (await screen.findAllByRole('table'))[0]
    expect(within(table).getByText('Arjun Nair')).toBeInTheDocument()
    expect(within(table).getByText('Kavya Reddy')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Add access' })).toHaveLength(2)
  })
})

describe('department staff', () => {
  it('lists the department’s people and adds someone from another department', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.departmentStaff, { departmentId: 'd-card' }))

    expect(await screen.findByText('Dr. Ananya Rao')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add people' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Priya Sharma' }))
    await user.click(screen.getByRole('button', { name: 'Add 1 person to department' }))

    expect(await screen.findByText('1 person added to Cardiology.')).toBeInTheDocument()
    expect(billingFake.config.state.calls).toContainEqual(['addDepartmentMembers', 'd-card', { staffIds: ['s-2'], practitionerIds: [] }])
  })
})

describe('branch staff page', () => {
  const path = pathFor(ROUTES.branchStaff, { branchId: 'b-main' })

  it('lists the people deployed to the branch and filters them', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(path)

    expect(await screen.findByRole('link', { name: 'Dr. Ananya Rao' })).toBeInTheDocument()
    expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Search staff'), 'zzz')
    expect(await screen.findByText('No people match your filters.')).toBeInTheDocument()
  })

  it('deploys someone to the branch and keeps people already here locked', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(path)

    await user.click(await screen.findByRole('button', { name: 'Add people' }))
    expect(await screen.findByRole('checkbox', { name: 'Dr. Ananya Rao' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Priya Sharma' }))
    await user.click(screen.getByRole('button', { name: 'Add 1 person' }))

    expect(await screen.findByText('1 person added to Main Clinic.')).toBeInTheDocument()
    expect(fake.staff.state.people[1].branches.map((branch) => branch.id)).toEqual(['b-kondapur', 'b-main'])
    expect(await screen.findByRole('link', { name: 'Priya Sharma' })).toBeInTheDocument()
  })
})

describe('staff profile page', () => {
  it('shows the person, their branches and history, and changes their branch assignment', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.staffProfile, { staffId: 's-1' }))

    expect(await screen.findByRole('heading', { name: 'Dr. Ananya Rao' })).toBeInTheDocument()
    expect(await screen.findByText('Record created')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage branch assignment' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Kondapur Clinic' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Branch assignment saved.')).toBeInTheDocument()
    expect(fake.staff.state.people[0].branches.map((branch) => branch.id)).toEqual(['b-main', 'b-kondapur'])
  })
})

describe('branch inventory page', () => {
  const path = pathFor(ROUTES.branchInventory, { branchId: 'b-main' })

  it('lists the branch’s stock locations and adds one', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(path)

    expect(await screen.findByText('Central Stores')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add inventory location' }))
    await user.click(screen.getByRole('button', { name: 'Create location' }))
    expect(screen.getByText('Enter a location name.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Location name/), 'Minor OT Store')
    await user.type(screen.getByLabelText(/Location code/), 'MAIN-OT')
    await user.click(screen.getByRole('button', { name: 'Create location' }))

    expect(await screen.findByText('Minor OT Store')).toBeInTheDocument()
    expect(billingFake.inventory.state.locations.at(-1)).toMatchObject({ code: 'MAIN-OT', kind: 'store', branch: { id: 'b-main' } })
  })
})

describe('services', () => {
  it('lists the billing catalogue, filters it and opens a service', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.services)

    await user.click(await screen.findByRole('tab', { name: /Diagnostic & Lab/ }))
    expect(screen.queryByRole('link', { name: 'General Physician Consultation' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '12-Lead Electrocardiogram (ECG)' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.service, { serviceId: 'srv-diag-03' })))
    expect(await screen.findByRole('heading', { name: /12-Lead Electrocardiogram/ })).toBeInTheDocument()
  })

  it('sets a branch price for a service', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.service, { serviceId: 'srv-card-01' }))

    const row = (await screen.findAllByRole('row')).find((entry) => within(entry).queryByText('Kondapur Clinic'))
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('radio', { name: 'Set a branch price' }))
    await user.click(screen.getByRole('button', { name: 'Save price' }))
    expect(screen.getByText('Enter a price of zero or more.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Branch price/), '900')
    await user.click(screen.getByRole('button', { name: 'Save price' }))

    expect(await screen.findByText('Price at Kondapur Clinic saved.')).toBeInTheDocument()
    const saved = billingFake.current.state.services.find((entry) => entry.id === 'srv-card-01')
    expect(saved.prices).toContainEqual({ branchId: 'b-kondapur', price: 900 })
  })

  it('creates a service with a department and a branch', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.serviceNew)

    await user.click((await screen.findAllByRole('button', { name: 'Create Service' }))[0])
    expect(screen.getByText('Enter the service name.')).toBeInTheDocument()
    expect(screen.getByText('Choose the service category.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Service name/), 'Holter Monitoring')
    await user.type(screen.getByLabelText(/Service code/), 'SRV-CARD-09')
    await user.click(screen.getByRole('button', { name: 'Diagnostic & Lab' }))
    await user.selectOptions(screen.getByLabelText(/Primary department/), 'Cardiology')
    await user.type(screen.getByLabelText(/Default price/), '1500')
    await user.click(screen.getByRole('checkbox', { name: 'Main Clinic' }))
    await user.click(screen.getAllByRole('button', { name: 'Create Service' })[0])

    await waitFor(() => expect(billingFake.current.state.services.some((entry) => entry.code === 'SRV-CARD-09')).toBe(true))
    const created = billingFake.current.state.services.find((entry) => entry.code === 'SRV-CARD-09')
    expect(created).toMatchObject({ name: 'Holter Monitoring', department: 'Cardiology', status: 'inactive', prices: [{ branchId: 'b-main', price: null }] })
    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.service, { serviceId: created.id })))
  })
})
