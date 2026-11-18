import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { billingFake } from '../../../test/fixtures/billingFake'
import { createPayrollApi, payrollSeed } from '../../../test/fixtures/payrollApi'
import { renderPayrollRoute, renderRoute } from '../../../test/renderRoute'
import { daysInMonth, monthLabel } from '../payrollLogic'

async function fill(user, field, text) {
  await user.clear(field)
  await user.click(field)
  await user.paste(text)
}

const setup = () => userEvent.setup({ delay: null })
const seed = payrollSeed()

describe('payroll module', () => {
  it('opens from the sidebar and highlights its tab', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.dashboard)

    await user.click(screen.getByRole('link', { name: 'Payroll' }))
    expect(router.state.location.pathname).toBe(ROUTES.payroll)
    expect(await screen.findByRole('heading', { name: 'Payroll & salary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Payroll' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a processed cycle and records the bank reference of a payment', async () => {
    const user = setup()
    const fake = billingFake.payroll
    await renderPayrollRoute(ROUTES.payrollHistory)

    const region = screen.getByRole('region', { name: `${monthLabel(seed.previous)} cycle details` })
    expect(within(region).getByText('Paid · UTR-HDFC-1001')).toBeInTheDocument()
    expect(within(region).getAllByText('1 of 2 paid').length).toBeGreaterThan(0)
    await user.click(within(region).getByRole('button', { name: 'Record payment' }))
    expect(within(region).getByText('Enter the bank reference (UTR) of the transfer.')).toBeInTheDocument()

    await fill(user, within(region).getByLabelText('Bank reference for Dr. Ravi Kumar'), 'UTR-ICIC-2207')
    await user.click(within(region).getByRole('button', { name: 'Record payment' }))
    expect(await within(region).findByText('Paid · UTR-ICIC-2207')).toBeInTheDocument()
    expect(fake.calls.at(-1)).toEqual({ name: 'recordPayment', body: { id: 'pe-prev-ravi', reference: 'UTR-ICIC-2207', version: 1 } })
  })

  it('switches branch in the ledger and expands an employee row', async () => {
    const user = setup()
    await renderPayrollRoute(ROUTES.payrollLedger)

    await user.click(screen.getByRole('radio', { name: /West Wing/ }))
    await user.click(screen.getByRole('button', { name: 'Details for Dr. Ravi Kumar' }))
    expect(screen.getByText('TDS (Sec 194J, 10%) · ₹3,600')).toBeInTheDocument()
  })

  it('adds a pay profile, keeping only the last digits of the account', async () => {
    const user = setup()
    const fake = billingFake.payroll
    await renderPayrollRoute(ROUTES.payrollSetup)

    await user.click(screen.getByRole('button', { name: 'Add pay profile for Meera Joshi' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Create pay profile' }))
    expect(within(drawer).getByText('Enter an 11-character IFSC, e.g. HDFC0001234.')).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText(/^Rate/), '30000')
    await fill(user, within(drawer).getByLabelText(/Bank name/), 'Kotak Bank')
    await fill(user, within(drawer).getByLabelText(/^IFSC/), 'kkbk0000958')
    await fill(user, within(drawer).getByLabelText(/last 4 digits/), '5567')
    await user.click(within(drawer).getByRole('button', { name: 'Create pay profile' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fake.calls.at(-1)).toEqual({ name: 'createProfile', body: { staffId: 's-meera', employment: 'full_time', model: 'monthly', rate: 30000, bankName: 'Kotak Bank', ifsc: 'KKBK0000958', accountLast4: '5567', active: true } })
    const row = screen.getByRole('row', { name: /Meera Joshi/ })
    expect(within(row).getByText('Kotak Bank •••• 5567')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Verify bank details' })).toBeInTheDocument()
  })

  it('checks and saves the statutory rules', async () => {
    const user = setup()
    const fake = billingFake.payroll
    await renderPayrollRoute(ROUTES.payrollSetup)

    await fill(user, screen.getByLabelText('EPF rate (%)'), '120')
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(screen.getByText('Enter the EPF rate as a percentage from 0 to 100.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText('EPF rate (%)'), '12')
    await user.click(screen.getByRole('switch', { name: 'ESIC' }))
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(await screen.findByText('Rules saved.')).toBeInTheDocument()
    expect(fake.calls.at(-1).body).toMatchObject({ epfRate: 12, esicEnabled: false, ptSlabs: [{ above: 15000, amount: 150 }, { above: 20000, amount: 200 }], version: 1 })
  })
})

describe('run payroll', () => {
  it('starts a run for the month after the last processed one', async () => {
    const user = setup()
    billingFake.usePayroll(createPayrollApi(payrollSeed({ open: false })))
    await renderPayrollRoute(ROUTES.payrollRun)

    await user.click(screen.getByRole('button', { name: `Start ${monthLabel(seed.month)} run` }))
    expect(await screen.findByText(monthLabel(seed.month))).toBeInTheDocument()
    expect(billingFake.payroll.calls.at(-1)).toEqual({ name: 'startCycle', body: { month: seed.month } })
  })

  it('excludes a staff member from the run', async () => {
    const user = setup()
    await renderPayrollRoute(ROUTES.payrollRunStaff)

    expect(screen.getByText('4 included in this run')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Include Dr. Ravi Kumar' }))
    expect(await screen.findByText('3 included in this run')).toBeInTheDocument()
  })

  it('needs a reason to replace paid days from attendance, and takes shifts as entered', async () => {
    const user = setup()
    const days = daysInMonth(seed.month)
    await renderPayrollRoute(ROUTES.payrollRunStaff)

    await user.click(screen.getByRole('button', { name: 'Inspect Priya Sharma' }))
    await fill(user, screen.getByLabelText('Paid days'), String(days))
    await user.click(screen.getByRole('button', { name: 'Save paid days' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the reason for changing the figure from the records.')
    await fill(user, screen.getByLabelText('Reason for the change'), 'Absence approved as paid leave')
    await user.click(screen.getByRole('button', { name: 'Save paid days' }))
    expect((await screen.findAllByText(`${days} paid days entered · Absence approved as paid leave`)).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Inspect Ramesh Kumar' }))
    await fill(user, screen.getByLabelText('Shifts worked'), '16')
    await user.click(screen.getByRole('button', { name: 'Save shifts worked' }))
    expect(await screen.findByText('Gross this cycle: ₹40,000')).toBeInTheDocument()
  })

  it('needs a comment to reject an adjustment', async () => {
    const user = setup()
    await renderPayrollRoute(ROUTES.payrollRunAdjustments)

    await user.click(screen.getByRole('button', { name: 'View PAD-000001' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Reject with comment' }))
    expect(within(drawer).getByRole('alert')).toHaveTextContent('Add a comment explaining the rejection.')

    await fill(user, within(drawer).getByLabelText(/Comment/), 'Encounter log does not match')
    await user.click(within(drawer).getByRole('button', { name: 'Reject with comment' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(screen.getByRole('row', { name: /PAD-000001/ })).getByText('Rejected')).toBeInTheDocument()
  })

  it('logs a new overtime adjustment for approval', async () => {
    const user = setup()
    const router = await renderPayrollRoute(ROUTES.payrollAdjustmentNew)

    await user.click(screen.getByRole('button', { name: 'Submit adjustment' }))
    expect(screen.getByText('Choose an employee.')).toBeInTheDocument()
    expect(screen.getByText('Give a reason for this adjustment.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Employee/), 'Priya Sharma (STF-003)')
    await user.click(screen.getByRole('button', { name: 'Overtime / extra hours' }))
    await fill(user, screen.getByLabelText('Hours logged'), '4.5')
    expect(screen.getByText('₹1,350')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/Reason for adjustment/), 'Evening shift extension')
    await user.click(screen.getByRole('button', { name: 'Submit adjustment' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.payrollRunAdjustments))
    expect(await screen.findByText('Overtime (4.5 hrs)')).toBeInTheDocument()
    expect(billingFake.payroll.calls.at(-1).body).toMatchObject({ staffId: 's-priya', month: seed.month, amount: 1350, category: 'Overtime / extra hours' })
  })

  it('moves an advance through approval', async () => {
    const user = setup()
    await renderPayrollRoute(ROUTES.payrollRunAdvances)

    await user.click(screen.getByRole('button', { name: 'View ADV-000002' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve advance' }))
    expect(await within(screen.getByRole('dialog')).findByRole('button', { name: 'Record disbursal' })).toBeInTheDocument()
  })

  it('creates an advance after review', async () => {
    const user = setup()
    const router = await renderPayrollRoute(ROUTES.payrollAdvanceNew)

    await user.selectOptions(screen.getByLabelText(/Employee/), 'Dr. Ananya Rao (STF-001)')
    await fill(user, screen.getByLabelText(/Advance amount/), '90000')
    await user.type(screen.getByLabelText(/Scheduled disbursal date/), `${seed.today.slice(0, 7)}-25`)
    await user.selectOptions(screen.getByLabelText(/Reason category/), 'Education')
    await user.click(screen.getByRole('button', { name: /Review advance/ }))

    expect(router.state.location.pathname).toBe(ROUTES.payrollAdvanceReview)
    await user.click(screen.getByRole('button', { name: 'Create advance' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm & create' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.payrollRunAdvances))
    expect(await screen.findByText('ADV-000013')).toBeInTheDocument()
    expect(billingFake.payroll.calls.at(-1).body).toMatchObject({ staffId: 's-ananya', principal: 90000, installments: 6, source: 'Admin created' })
  })

  it('rejects an advance above the employee limit', async () => {
    const user = setup()
    await renderPayrollRoute(ROUTES.payrollAdvanceNew)

    await user.selectOptions(screen.getByLabelText(/Employee/), 'Dr. Ananya Rao (STF-001)')
    await fill(user, screen.getByLabelText(/Advance amount/), '200000')
    await user.click(screen.getByRole('button', { name: /Review advance/ }))
    expect(screen.getByText('Exceeds the available limit of ₹1,20,000.')).toBeInTheDocument()
  })

  it('approves and processes the batch once every check passes', async () => {
    const user = setup()
    await renderPayrollRoute(ROUTES.payrollRunReview)
    expect(screen.getByRole('button', { name: 'Approve batch for processing' })).toBeDisabled()
    expect(screen.getByText('1 included staff · bank details not verified')).toBeInTheDocument()

    const step = (name) => user.click(within(screen.getByRole('navigation', { name: 'Payroll run steps' })).getByRole('link', { name }))
    await step(/Review staff/)
    await user.click(screen.getByRole('button', { name: 'Inspect Priya Sharma' }))
    await user.click(screen.getByRole('button', { name: 'Mark ready' }))
    await user.click(await screen.findByRole('button', { name: 'Inspect Ramesh Kumar' }))
    await fill(user, screen.getByLabelText('Shifts worked'), '16')
    await user.click(screen.getByRole('button', { name: 'Save shifts worked' }))
    await screen.findByText('Gross this cycle: ₹40,000')
    await user.click(screen.getByRole('button', { name: 'Mark ready' }))
    await user.click(await screen.findByRole('button', { name: 'Verify bank details' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Verify bank details' })).not.toBeInTheDocument())

    await step(/Adjustments/)
    await user.click(screen.getByRole('button', { name: 'View PAD-000001' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve adjustment' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await step(/Final review/)
    await user.click(screen.getByRole('button', { name: 'Approve batch for processing' }))
    await user.click((await screen.findAllByRole('link', { name: /Continue to process payroll/ }))[0])

    await user.click(screen.getByRole('checkbox', { name: /I confirm/ }))
    await user.click(screen.getByRole('button', { name: 'Process payroll' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm & process' }))
    expect(await screen.findByText('This payroll run has been processed')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'View payroll history' }))
    const region = await screen.findByRole('region', { name: `${monthLabel(seed.month)} cycle details` })
    expect(within(region).getAllByText('0 of 4 paid').length).toBeGreaterThan(0)
  })
})
