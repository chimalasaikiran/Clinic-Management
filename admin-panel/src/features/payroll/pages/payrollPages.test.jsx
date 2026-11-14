import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

const setup = () => userEvent.setup({ delay: null })

describe('payroll module', () => {
  it('opens from the sidebar and highlights its tab', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.dashboard)

    await user.click(screen.getByRole('link', { name: 'Payroll' }))
    expect(router.state.location.pathname).toBe(ROUTES.payroll)
    expect(screen.getByRole('heading', { name: 'Payroll & salary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Payroll' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the details of a past cycle', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollHistory)

    expect(screen.getByRole('region', { name: 'August 2026 cycle details' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View July 2026' }))
    expect(within(screen.getByRole('region', { name: 'July 2026 cycle details' })).getByText('₹11,28,400')).toBeInTheDocument()
  })

  it('switches branch in the ledger and expands an employee row', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollLedger)

    await user.click(screen.getByRole('radio', { name: /Gachibowli/ }))
    await user.click(screen.getByRole('button', { name: 'Details for Dr. Ravi Kumar' }))
    expect(screen.getByText('TDS (Sec 194J, 10%) · ₹3,600')).toBeInTheDocument()
  })
})

describe('run payroll', () => {
  it('excludes a staff member from the run', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollRunStaff)

    expect(screen.getByText('7 included in this run')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Include Dr. Ravi Kumar' }))
    expect(screen.getByText('6 included in this run')).toBeInTheDocument()
  })

  it('needs a comment to reject an adjustment', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollRunAdjustments)

    await user.click(screen.getByRole('button', { name: 'View ADJ-2026-042' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Reject with comment' }))
    expect(within(drawer).getByRole('alert')).toHaveTextContent('Add a comment explaining the rejection.')

    await fill(user, within(drawer).getByLabelText(/Comment/), 'Encounter log does not match')
    await user.click(within(drawer).getByRole('button', { name: 'Reject with comment' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /ADJ-2026-042/ })).getByText('Rejected')).toBeInTheDocument()
  })

  it('logs a new overtime adjustment for approval', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.payrollAdjustmentNew)

    await user.click(screen.getByRole('button', { name: 'Submit adjustment' }))
    expect(screen.getByText('Choose an employee.')).toBeInTheDocument()
    expect(screen.getByText('Give a reason for this adjustment.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Employee/), 'Meera Joshi (STF-1145)')
    await user.click(screen.getByRole('button', { name: 'Overtime / extra hours' }))
    await fill(user, screen.getByLabelText('Hours logged'), '4.5')
    expect(screen.getByText('₹1,350')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/Reason for adjustment/), 'Evening shift extension')
    await user.click(screen.getByRole('button', { name: 'Submit adjustment' }))

    expect(router.state.location.pathname).toBe(ROUTES.payrollRunAdjustments)
    expect(screen.getByText('Overtime (4.5 hrs)')).toBeInTheDocument()
  })

  it('moves an advance through approval', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollRunAdvances)

    await user.click(screen.getByRole('button', { name: 'View ADV-2026-0045' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve advance' }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Record disbursal' })).toBeInTheDocument()
  })

  it('creates an advance after review', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.payrollAdvanceNew)

    await user.selectOptions(screen.getByLabelText(/Employee/), 'Dr. Vikramaditya Sahai (STF-1002)')
    await fill(user, screen.getByLabelText(/Advance amount/), '90000')
    await user.type(screen.getByLabelText(/Scheduled disbursal date/), '2026-09-25')
    await user.selectOptions(screen.getByLabelText(/Reason category/), 'Education')
    await user.click(screen.getByRole('button', { name: /Review advance/ }))

    expect(router.state.location.pathname).toBe(ROUTES.payrollAdvanceReview)
    await user.click(screen.getByRole('button', { name: 'Create advance' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm & create' }))

    expect(router.state.location.pathname).toBe(ROUTES.payrollRunAdvances)
    expect(screen.getByText('ADV-2026-0048')).toBeInTheDocument()
  })

  it('rejects an advance above the employee limit', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollAdvanceNew)

    await user.selectOptions(screen.getByLabelText(/Employee/), 'Dr. Ananya Rao (STF-1048)')
    await fill(user, screen.getByLabelText(/Advance amount/), '200000')
    await user.click(screen.getByRole('button', { name: /Review advance/ }))
    expect(screen.getByText('Exceeds the available limit of ₹1,20,000.')).toBeInTheDocument()
  })

  it('approves and processes the batch once every check passes', async () => {
    const user = setup()
    renderRoute(ROUTES.payrollRunReview)
    expect(screen.getByRole('button', { name: 'Approve batch for processing' })).toBeDisabled()

    const step = (name) => user.click(within(screen.getByRole('navigation', { name: 'Payroll run steps' })).getByRole('link', { name }))
    await step(/Review staff/)
    for (const name of ['Priya Sharma', 'Sneha Patel']) {
      await user.click(screen.getByRole('button', { name: `Inspect ${name}` }))
      await user.click(screen.getByRole('button', { name: 'Mark ready' }))
    }
    await user.click(screen.getByRole('checkbox', { name: 'Include Ramesh Kumar' }))

    await step(/Adjustments/)
    await user.click(screen.getByRole('button', { name: 'View ADJ-2026-042' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve adjustment' }))

    await step(/Final review/)
    await user.click(screen.getByRole('button', { name: 'Approve batch for processing' }))
    await user.click(screen.getAllByRole('link', { name: /Continue to process payroll/ })[0])

    await user.click(screen.getByRole('checkbox', { name: /I confirm/ }))
    await user.click(screen.getByRole('button', { name: 'Process payroll' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm & process' }))
    expect(screen.getByText('This payroll run has been processed')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'View payroll history' }))
    expect(screen.getByRole('region', { name: 'September 2026 cycle details' })).toBeInTheDocument()
  })
})
