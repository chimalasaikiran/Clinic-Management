import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { billingFake } from '../../../test/fixtures/billingFake'
import { createDashboardApi, dashboardFixture } from '../../../test/fixtures/dashboardApi'
import { renderRoute } from '../../../test/renderRoute'

async function openDashboard(options) {
  const router = renderRoute(ROUTES.dashboard, undefined, options)
  await screen.findByText('22 scheduled')
  return router
}

describe('owner dashboard', () => {
  it('shows the day from the API, with each item linking to where it is handled', async () => {
    await openDashboard()
    expect(screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), Siddharth Verma$/ })).toBeInTheDocument()
    expect(screen.getAllByText('₹35,000').length).toBeGreaterThan(0)
    expect(screen.getByText('4 items requiring action')).toBeInTheDocument()

    const attention = screen.getByRole('region', { name: 'Needs attention' })
    expect(within(attention).getByRole('link', { name: /Review results/ })).toHaveAttribute('href', ROUTES.clinical)
    expect(within(attention).getByRole('link', { name: /View inventory/ })).toHaveAttribute('href', ROUTES.inventory)
    expect(within(attention).getByText(/Amoxicillin 500mg: 40 of 100 at Central store/)).toBeInTheDocument()

    expect(screen.getByText('Afternoon session')).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Attendance marked for 16 of 18 staff members')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View finance' })).toHaveAttribute('href', ROUTES.billing)
    expect(screen.getByText('Rohit Mehta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Register patient/ })).toHaveAttribute('href', ROUTES.patientNew)
    expect(screen.getByText('Consulting hours')).toBeInTheDocument()
    expect(screen.queryByText(/HIPAA|AES-256|Concierge/)).not.toBeInTheDocument()
  })

  it('filters by location and day, and refreshes on request', async () => {
    const user = userEvent.setup({ delay: null })
    const fake = billingFake.useDashboard(createDashboardApi())
    await openDashboard()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Location' }), 'b-kondapur')
    await waitFor(() => expect(fake.calls.at(-1).query).toEqual({ date: undefined, branchId: 'b-kondapur' }))
    expect(await screen.findByRole('button', { name: 'Show only Kondapur Clinic' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show only Main Clinic' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Day' }), '2026-11-17')
    await waitFor(() => expect(fake.calls.at(-1).query).toEqual({ date: '2026-11-17', branchId: 'b-kondapur' }))
    expect(await screen.findByText(/how your clinic did on Tue, 17 Nov 2026/)).toBeInTheDocument()

    const before = fake.calls.length
    await user.click(screen.getByRole('button', { name: 'Refresh data' }))
    await waitFor(() => expect(fake.calls.length).toBe(before + 1))
  })

  it('narrows to a branch from its row', async () => {
    const user = userEvent.setup({ delay: null })
    const fake = billingFake.useDashboard(createDashboardApi())
    await openDashboard()
    await user.click(screen.getByRole('button', { name: 'Show only Main Clinic' }))
    await waitFor(() => expect(fake.calls.at(-1).query.branchId).toBe('b-main'))
    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('b-main')
  })

  it('leaves out what the role cannot see', async () => {
    billingFake.useDashboard(createDashboardApi((query) => ({
      ...dashboardFixture(query), orgWide: false, collections: null, refunds: null, outstanding: null, reconciliation: null, activity: null, setup: null,
      approvals: { attendanceUnmarked: null, payrollAdjustments: null, advances: null },
      locations: dashboardFixture(query).locations.map((row) => ({ ...row, collections: null })),
    })))
    await openDashboard({ auth: authState({ permissions: ['dashboard.view', 'bookings.view', 'bookings.create', 'patients.view', 'staff.view'] }) })

    expect(screen.queryByText('Financial snapshot')).not.toBeInTheDocument()
    expect(screen.queryByText('Payment reconciliation')).not.toBeInTheDocument()
    expect(screen.getByText(/shown to roles that cover every branch/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Complete your setup' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Book appt/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Create invoice/ })).not.toBeInTheDocument()
  })

  it('remembers that the setup guide was hidden', async () => {
    const user = userEvent.setup({ delay: null })
    await openDashboard()
    await user.click(screen.getByRole('button', { name: 'Hide setup guide' }))
    expect(screen.queryByRole('region', { name: 'Complete your setup' })).not.toBeInTheDocument()
    expect(localStorage.getItem('clinicos.dashboard.setupHidden:org-1')).toBe('1')
  })

  it('explains a failed load and retries', async () => {
    const user = userEvent.setup({ delay: null })
    let fail = true
    billingFake.useDashboard(createDashboardApi((query) => {
      if (fail) throw new Error('The server is not responding.')
      return dashboardFixture(query)
    }))
    renderRoute(ROUTES.dashboard)
    expect(await screen.findByText('The server is not responding.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('22 scheduled')).toBeInTheDocument()
  })
})
