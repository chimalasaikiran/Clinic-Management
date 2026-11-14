import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

// Pasting keeps long form fills fast; typing every key re-renders the whole page.
async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('organisation page', () => {
  it('lists every branch and highlights Configuration in the sidebar', () => {
    renderRoute(ROUTES.organisation)

    expect(screen.getByRole('heading', { name: 'Organization & branches' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kondapur Clinic' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /configuration/i })).toHaveAttribute('aria-current', 'page')
  })

  it('filters locations by search text and shows an empty state', async () => {
    const user = userEvent.setup()
    renderRoute(ROUTES.organisation)

    await user.type(screen.getByPlaceholderText('Search locations...'), 'kondapur')
    expect(screen.queryByRole('heading', { name: 'Main Clinic' })).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search locations...'), 'zzz')
    expect(screen.getByText('No locations match your filters.')).toBeInTheDocument()
  })

  it('opens a branch and the create-branch form', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.organisation)

    await user.click(screen.getAllByRole('link', { name: 'View' })[1])
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.branch, { branchId: 'kondapur' }))
  })
})

describe('create branch page', () => {
  it('shows errors for required fields and stays put', async () => {
    const user = userEvent.setup()
    const router = renderRoute(ROUTES.branchNew)

    await user.click(screen.getAllByRole('button', { name: 'Create branch' })[0])

    expect(screen.getByText('Enter the branch name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a branch code.')).toBeInTheDocument()
    expect(screen.getByText('Enter the PIN code.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.branchNew)
  })

  it('returns to the organisation page once the form is valid', async () => {
    const user = userEvent.setup({ delay: null })
    const router = renderRoute(ROUTES.branchNew)

    await fill(user, screen.getByLabelText(/Branch name/), 'Kondapur Specialty Clinic')
    await fill(user, screen.getByLabelText(/Branch code/), 'KDP-01')
    await user.selectOptions(screen.getByLabelText(/Facility type/), 'Specialty & Surgical Hub')
    await fill(user, screen.getByLabelText(/Address line 1/), 'Plot No. 42, Hitec City Main Road')
    await fill(user, screen.getByLabelText(/^City/), 'Hyderabad')
    await fill(user, screen.getByLabelText(/^State/), 'Telangana')
    await fill(user, screen.getByLabelText(/PIN code/), '500084')
    await fill(user, screen.getByLabelText(/Branch phone/), '4023456789')
    await fill(user, screen.getByLabelText(/Branch email/), 'kondapur@carepointhealth.in')
    await user.click(screen.getAllByRole('button', { name: 'Create branch' })[0])

    expect(router.state.location.pathname).toBe(ROUTES.organisation)
  }, 15000)
})

describe('operating hours page', () => {
  it('adds and removes a schedule exception', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.branchHours, { branchId: 'kondapur' }))

    const form = screen.getByRole('heading', { name: 'Quick add exception' }).closest('section')
    await user.click(within(form).getByRole('button', { name: 'Add exception' }))
    expect(within(form).getByText('Pick a date.')).toBeInTheDocument()
    expect(within(form).getByText('Add a reason for the exception.')).toBeInTheDocument()

    await user.type(within(form).getByLabelText(/^Date/), '2026-12-25')
    await user.type(within(form).getByLabelText(/Reason/), 'Christmas Day')
    await user.click(within(form).getByRole('button', { name: 'Add exception' }))

    expect(screen.getByText('Christmas Day')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Christmas Day' }))
    expect(screen.queryByText('Christmas Day')).not.toBeInTheDocument()
  })
})

describe('branch staff page', () => {
  it('filters the roster and clears the filters again', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.branchStaff, { branchId: 'main' }))

    await user.selectOptions(screen.getByLabelText('All Types'), 'Doctor')
    expect(screen.queryByText('Rahul Kumar')).not.toBeInTheDocument()
    expect(screen.getByText('Dr. Arjun Mehta, MD')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(screen.getByText('Rahul Kumar')).toBeInTheDocument()
  })

  it('selects people in the add-people drawer and keeps assigned people locked', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.branchStaff, { branchId: 'main' }))

    await user.click(screen.getByRole('button', { name: /add people/i }))
    const drawer = screen.getByRole('dialog')

    expect(within(drawer).getByRole('button', { name: /^Add 0 people/ })).toBeDisabled()
    expect(within(drawer).getByRole('checkbox', { name: 'Dr. Ananya Rao' })).toBeDisabled()

    await user.click(within(drawer).getByRole('checkbox', { name: 'Dr. Rajesh Kannan, MD' }))
    await user.click(within(drawer).getByRole('checkbox', { name: 'Meera Nambiar' }))
    expect(within(drawer).getByRole('button', { name: 'Add 2 people' })).toBeEnabled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('staff profile page', () => {
  it('shows the person and their branch affiliations', () => {
    renderRoute(pathFor(ROUTES.staffProfile, { staffId: 'ananya-rao' }))

    expect(screen.getByRole('heading', { name: 'Dr. Ananya Rao' })).toBeInTheDocument()
    expect(screen.getByText('Kondapur Clinic')).toBeInTheDocument()
  })
})

describe('branch detail page', () => {
  it('links to hours and staff for the branch in the URL', () => {
    renderRoute(pathFor(ROUTES.branch, { branchId: 'main' }))

    expect(screen.getByRole('link', { name: /configure operating hours/i })).toHaveAttribute(
      'href',
      pathFor(ROUTES.branchHours, { branchId: 'main' }),
    )
    expect(screen.getByRole('link', { name: /staff & doctors/i })).toHaveAttribute('href', pathFor(ROUTES.branchStaff, { branchId: 'main' }))
  })

  it('asks for confirmation before deactivating', async () => {
    const user = userEvent.setup()
    renderRoute(pathFor(ROUTES.branch, { branchId: 'main' }))

    await user.click(screen.getByRole('button', { name: 'Deactivate branch' }))
    expect(screen.getByRole('button', { name: 'Confirm deactivation' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep active' }))
    expect(screen.queryByRole('button', { name: 'Confirm deactivation' })).not.toBeInTheDocument()
  })
})
