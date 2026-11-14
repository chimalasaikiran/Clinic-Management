import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const cardiology = { departmentId: 'cardiology' }

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('branch access page', () => {
  const path = pathFor(ROUTES.branchAccess, { branchId: 'main' })

  it('filters assignments by access level', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(path)

    await user.selectOptions(screen.getByLabelText('Access level'), 'View only')
    expect(screen.queryByText('Dr. Ananya Rao')).not.toBeInTheDocument()
    expect(screen.getByText('Neha Reddy')).toBeInTheDocument()
  })

  it('requires a person and a justification before granting access', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(path)

    await user.click(screen.getByRole('button', { name: 'Add access' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Grant branch access' }))
    expect(within(drawer).getByText('Select at least one person or role to grant access.')).toBeInTheDocument()
    expect(within(drawer).getByText('Add an administrative justification.')).toBeInTheDocument()

    await user.click(within(drawer).getByRole('checkbox', { name: 'Dr. Rajesh Kannan, MD' }))
    await fill(user, within(drawer).getByLabelText(/justification/i), 'Q4 clinical rotation')
    await user.click(within(drawer).getByRole('button', { name: 'Grant branch access' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('add access route', () => {
  const addPath = pathFor(ROUTES.branchAccessAdd, { branchId: 'main' })
  const accessPath = pathFor(ROUTES.branchAccess, { branchId: 'main' })

  it('opens the drawer over the access page from a direct link', () => {
    renderRoute(addPath)

    expect(screen.getByRole('heading', { name: 'Access & permissions' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Add access to Main Clinic' })).toBeInTheDocument()
  })

  it('moves between the page and the drawer through the URL', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(accessPath)

    await user.click(screen.getByRole('button', { name: 'Add access' }))
    expect(router.state.location.pathname).toBe(addPath)

    await user.keyboard('{Escape}')
    expect(router.state.location.pathname).toBe(accessPath)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('grants a role from the Roles Matrix tab and keeps ineligible rows locked', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(addPath)
    const drawer = screen.getByRole('dialog')

    await user.click(within(drawer).getByRole('tab', { name: 'Roles Matrix' }))
    expect(within(drawer).getByRole('checkbox', { name: 'Audit / Inspection' })).toBeDisabled()

    await user.click(within(drawer).getByRole('checkbox', { name: 'Nursing & Triage' }))
    await fill(user, within(drawer).getByLabelText(/justification/i), 'Ward coverage')
    await user.click(within(drawer).getByRole('button', { name: 'Grant branch access' }))

    expect(router.state.location.pathname).toBe(accessPath)
  })

  it('clears the selection when switching between users and roles', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(addPath)
    const drawer = screen.getByRole('dialog')

    await user.click(within(drawer).getByRole('checkbox', { name: 'Dr. Rajesh Kannan, MD' }))
    expect(within(drawer).getByText('1 entities selected')).toBeInTheDocument()
    await user.click(within(drawer).getByRole('tab', { name: 'Roles Matrix' }))
    expect(within(drawer).getByText('0 entities selected')).toBeInTheDocument()
  })
})

describe('branch inventory page', () => {
  it('adds a validated inventory location to the list', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.branchInventory, { branchId: 'main' }))

    await user.click(screen.getByRole('button', { name: 'Add inventory location' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Create location' }))
    expect(within(drawer).getByText('Enter a location name.')).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText(/Location name/), 'Trauma & Minor OT Store')
    await fill(user, within(drawer).getByLabelText(/Location code/), 'ST-TRAUMA-01')
    await user.click(within(drawer).getByRole('button', { name: 'Create location' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Trauma & Minor OT Store')).toBeInTheDocument()
  })

  it('flips the branch master switch', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.branchInventory, { branchId: 'main' }))

    const master = screen.getByRole('switch', { name: 'Branch inventory' })
    expect(master).toBeChecked()
    await user.click(master)
    expect(master).not.toBeChecked()
  })
})

describe('departments', () => {
  it('filters the list by type and opens the detail page', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.departments)

    await user.click(screen.getByRole('tab', { name: /Diagnostic & Imaging/ }))
    expect(screen.queryByText('Cardiology & Interventional Sciences')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /All Types/ }))

    await user.click(screen.getAllByRole('link', { name: /View/ })[0])
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.department, cardiology))
  })

  it('says detail is unavailable for departments without data', () => {
    renderRoute(pathFor(ROUTES.department, { departmentId: 'pediatrics' }))
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
  })

  it('links the detail page to its sub-pages', () => {
    renderRoute(pathFor(ROUTES.department, cardiology))
    expect(screen.getByRole('link', { name: /Clinical practitioners/ })).toHaveAttribute('href', pathFor(ROUTES.departmentStaff, cardiology))
    expect(screen.getByRole('link', { name: /Operating locations/ })).toHaveAttribute('href', pathFor(ROUTES.departmentLocations, cardiology))
    expect(screen.getByRole('link', { name: /Manage access/ })).toHaveAttribute('href', pathFor(ROUTES.departmentAccess, cardiology))
  })

  it('validates the create form and returns to the list', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.departmentNew)

    await user.click(screen.getAllByRole('button', { name: 'Create department' })[0])
    expect(screen.getByText('Enter the department name.')).toBeInTheDocument()
    expect(screen.getByText('Choose at least one clinic location.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/Department name/), 'Cardiology')
    await fill(user, screen.getByLabelText(/Department code/), 'DEP-CARD')
    await user.click(screen.getByRole('checkbox', { name: /Main Surgical Pavilion/ }))
    await user.click(screen.getAllByRole('button', { name: 'Create department' })[0])
    expect(router.state.location.pathname).toBe(ROUTES.departments)
  })
})

describe('department sub-pages', () => {
  it('filters personnel and selects people in the drawer', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.departmentStaff, cardiology))

    await user.click(screen.getByRole('tab', { name: /Clinical Staff/ }))
    expect(screen.queryByText('Dr. Ananya Rao')).not.toBeInTheDocument()
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add people' }))
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).getByRole('button', { name: /Add 0 people/ })).toBeDisabled()
    await user.click(within(drawer).getByRole('checkbox', { name: 'Dr. Vikram Sethi' }))
    expect(within(drawer).getByRole('button', { name: /Add 1 person to department/ })).toBeEnabled()
  })

  it('adds locations through the drawer', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.departmentLocations, cardiology))

    await user.click(screen.getByRole('button', { name: 'Add location' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('checkbox', { name: 'Gachibowli Multi-Specialty Hospital' }))
    await user.click(within(drawer).getByRole('button', { name: /Add 1 location to department/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('toggles policy modes and requires a selection in the access drawer', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.departmentAccess, cardiology))

    const allowlist = screen.getByRole('switch', { name: 'Restricted Allowlist Mode' })
    expect(allowlist).not.toBeChecked()
    await user.click(allowlist)
    expect(allowlist).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Add access' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: /^Add 0 access/ }))
    expect(within(drawer).getByText('Select at least one user or role.')).toBeInTheDocument()
  })
})

describe('services', () => {
  it('filters the catalogue and opens a service', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.services)

    await user.click(screen.getByRole('tab', { name: /Consultations/ }))
    expect(screen.queryByText('12-Lead Electrocardiogram (ECG)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Cardiology Consultation (Initial OPD)' }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.service, { serviceId: 'srv-card-01' }))
  })

  it('validates the branch price before applying it', async () => {
    const user = userEvent.setup({ delay: null })
    renderRoute(pathFor(ROUTES.service, { serviceId: 'srv-card-01' }))

    await user.click(screen.getByRole('button', { name: 'Edit pricing structure' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: /Apply Price/ }))
    expect(within(drawer).getByText('Enter the service price.')).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText(/Service price/), '900')
    await fill(user, within(drawer).getByLabelText(/Effective from/), '2026-10-01')
    await user.click(within(drawer).getByRole('button', { name: /Apply Price/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('creates a service once its master, department and a branch are chosen', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.serviceNew)

    await user.click(screen.getAllByRole('button', { name: /Create Service/ })[0])
    expect(screen.getByText('Enter the service name.')).toBeInTheDocument()
    expect(screen.getByText('Authorize at least one branch location.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/Service name/), 'Cardiology Consultation')
    await user.selectOptions(screen.getByLabelText(/Primary department/), 'Cardiology & Vascular Medicine (#DEP-CARD)')
    await user.click(screen.getByRole('checkbox', { name: /Main Surgical Pavilion/ }))
    await user.click(screen.getAllByRole('button', { name: /Create Service/ })[0])
    expect(router.state.location.pathname).toBe(ROUTES.services)
  })
})

describe('staff profile branch assignment', () => {
  it('confirms before removing someone from the branch', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(pathFor(ROUTES.staffProfile, { staffId: 'ananya-rao' }))

    await user.click(screen.getByRole('button', { name: 'Open Branch Assignment' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Remove from branch' }))
    expect(within(drawer).getByText(/Remove Dr. Ananya Rao from Main Clinic\?/)).toBeInTheDocument()

    await user.click(within(drawer).getAllByRole('button', { name: 'Remove from branch' })[0])
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.branchStaff, { branchId: 'main' }))
  })
})
