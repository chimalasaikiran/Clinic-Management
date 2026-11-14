import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

beforeEach(() => localStorage.clear())

describe('charges', () => {
  it('lists the charges with their invoice and charge status', () => {
    renderRoute(ROUTES.billingCharges)

    expect(screen.getByRole('heading', { name: 'Charge Register' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CHG-2026-320' })).toHaveAttribute('href', pathFor(ROUTES.billingCharge, { chargeId: 'CHG-2026-320' }))
    expect(screen.getByText('3 records · Newest first')).toBeInTheDocument()
  })

  it('blocks confirmation for a service with no tax setup but still saves a draft', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.billingChargeNew)

    await user.selectOptions(screen.getByLabelText(/^Patient/), 'pt-000184')
    await user.selectOptions(screen.getByLabelText(/^Service \/ item/), 'SRV-CARD-02')

    expect(screen.getByText('Draft can be saved; confirmation is blocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Charge' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    expect(router.state.location.pathname).toBe(ROUTES.billingCharges)
    expect(screen.getByRole('link', { name: 'CHG-2026-322' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Continue draft/ }).length).toBeGreaterThan(0)
  })

  it('asks before leaving a form with unsaved changes', async () => {
    const user = setup()
    renderRoute(ROUTES.billingChargeNew)

    await user.selectOptions(screen.getByLabelText(/^Patient/), 'pt-000184')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Leave with unsaved changes?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('Leave with unsaved changes?')).not.toBeInTheDocument()
  })
})

describe('payments', () => {
  it('shows each payment with its allocated and unallocated amounts', () => {
    renderRoute(ROUTES.billingPayments)

    const row = screen.getByRole('link', { name: /PAY-2026-112/ }).closest('tr')
    expect(within(row).getByText('₹7,000')).toBeInTheDocument()
    expect(within(row).getByText('₹2,000 unallocated')).toBeInTheDocument()
    expect(within(row).getByText('Partially allocated')).toBeInTheDocument()
  })

  it('records a payment unallocated and opens its details', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.billingPaymentNew)

    await user.selectOptions(screen.getByLabelText(/^Patient/), 'pt-000184')
    await fill(user, screen.getByLabelText(/^Amount/), '1000')
    await user.click(screen.getByRole('radio', { name: 'UPI' }))
    await fill(user, screen.getByLabelText('Transaction reference'), 'UPI/777')
    await user.click(screen.getAllByRole('button', { name: 'Review payment' })[0])
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.billingPayment, { paymentId: 'PAY-2026-113' }))
    expect(screen.getByRole('heading', { name: 'Payment Details' })).toBeInTheDocument()
    expect(screen.getAllByText('₹1,000').length).toBeGreaterThan(0)
  })

  it('holds the review step until the amount and method are valid', async () => {
    const user = setup()
    renderRoute(ROUTES.billingPaymentNew)

    expect(screen.getAllByRole('button', { name: 'Review payment' })[0]).toBeDisabled()
    expect(screen.getByText('Not ready for review')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Patient/), 'pt-000184')
    await fill(user, screen.getByLabelText(/^Amount/), '9000')
    await user.click(screen.getByRole('radio', { name: 'Cash' }))

    expect(screen.getAllByRole('button', { name: 'Review payment' })[0]).toBeDisabled()
  })

  it('applies the unallocated credit to the open invoice', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))

    expect(screen.getByLabelText(/^Preview amount/)).toHaveValue('2000')
    await user.click(screen.getAllByRole('button', { name: 'Confirm allocation' })[0])

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.billingPayment, { paymentId: 'PAY-2026-112' }))
    expect(screen.getAllByText('Fully allocated').length).toBeGreaterThan(0)
  })

  it('rejects a preview above the available payment credit', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))

    await fill(user, screen.getByLabelText(/^Preview amount/), '2500')

    expect(screen.getAllByText('Amount exceeds the unallocated payment credit.').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Confirm allocation' })[0]).toBeDisabled()
  })
})

describe('receipts', () => {
  it('disables official output while the receipt amount is unverified', () => {
    renderRoute(pathFor(ROUTES.billingReceipt, { receiptId: 'REC-2026-091' }))

    expect(screen.getByText('NOT VALID FOR ISSUE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
  })

  it('offers official output for a receipt without a conflict', () => {
    renderRoute(pathFor(ROUTES.billingReceipt, { receiptId: 'REC-2026-084' }))

    expect(screen.queryByText('NOT VALID FOR ISSUE')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled()
  })

  it('lists the receipts and flags the conflict', () => {
    renderRoute(ROUTES.billingReceipts)

    expect(screen.getAllByText('Amount requires verification').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /REC-2026-091/ })).toBeInTheDocument()
  })
})

describe('refunds', () => {
  it('summarises the register by status', () => {
    renderRoute(ROUTES.billingRefunds)

    const strip = screen.getByText('Processed refunds').closest('dl')
    expect(within(strip).getByText('₹2,000')).toBeInTheDocument()
    expect(screen.getByText(/Failed does not mean refunded/)).toBeInTheDocument()
    expect(screen.getByText('6 refunds · Newest first')).toBeInTheDocument()
  })

  it('blocks an amount above the refundable balance, then submits a valid request', async () => {
    const user = setup()
    const router = renderRoute(`${ROUTES.billingRefundNew}?payment=PAY-2026-119`)

    await fill(user, screen.getByLabelText(/^Refund amount/), '900')
    expect(screen.getByText('Amount exceeds the refundable limit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Refund amount/), '800')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.billingRefund, { refundId: 'REF-2026-019' }))
    expect(screen.getByRole('heading', { name: 'Refund Details' })).toBeInTheDocument()
  })

  it('keeps approval blocked while the original receipt is unverified', () => {
    renderRoute(pathFor(ROUTES.billingRefund, { refundId: 'REF-2026-018' }))

    expect(screen.getByText('Verification required before approval or processing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve refund' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Process refund' })).toBeDisabled()
  })

  it('processes an approved refund', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.billingRefund, { refundId: 'REF-2026-016' }))

    await user.click(screen.getByRole('button', { name: 'Process refund' }))

    expect(screen.getByRole('button', { name: 'Process refund' })).toBeDisabled()
    expect(screen.getAllByText('Processed').length).toBeGreaterThan(0)
  })
})

describe('reconciliation', () => {
  it('compares source lines with ClinicOS payments', () => {
    renderRoute(ROUTES.billingReconciliation)

    expect(screen.getByText('₹25,250')).toBeInTheDocument()
    expect(screen.getByText('₹23,500')).toBeInTheDocument()
    expect(screen.getByText('+ ₹1,750')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /EXC-2026-042/ })).toHaveAttribute('href', pathFor(ROUTES.billingException, { exceptionId: 'EXC-2026-042' }))
  })

  it('only resolves an exception once evidence, a note and confirmation are given', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.billingException, { exceptionId: 'EXC-2026-042' }))

    const resolve = screen.getByRole('button', { name: 'Confirm & mark resolved' })
    expect(resolve).toBeDisabled()
    expect(screen.getByRole('button', { name: /Retry source processing/ })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Resolution note/), 'Gateway fee breakdown confirms the difference.')
    await user.upload(screen.getByLabelText('Attach evidence'), new File(['fee'], 'fee-breakdown.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('checkbox'))
    await user.click(resolve)

    expect(screen.getByText('fee-breakdown.pdf')).toBeInTheDocument()
    expect(screen.getByText('Exception resolved')).toBeInTheDocument()
  })
})

describe('balances, settlements and reports', () => {
  it('keeps prepaid funds, pending reserve and amount owed separate', () => {
    renderRoute(ROUTES.billingBalances)

    const strip = screen.getByText('Held prepaid funds').closest('dl')
    expect(within(strip).getAllByText('₹1,500')).toHaveLength(2)
    expect(within(strip).getByText('₹0')).toBeInTheDocument()
    expect(screen.getByText('₹3,500')).toBeInTheDocument()
    expect(screen.getByText('One set of funds, counted once')).toBeInTheDocument()
  })

  it('reports settlements as unavailable rather than zero', () => {
    renderRoute(ROUTES.billingSettlements)

    expect(screen.getByText('Settlement records are not available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export settlements' })).toBeDisabled()
  })

  it('shows distinct coverage per report and disables export for unavailable ones', () => {
    renderRoute(ROUTES.billingReports)

    expect(screen.getByText('3 / 9')).toBeInTheDocument()
    expect(screen.getAllByText('Export disabled')).toHaveLength(6)
    expect(screen.getByText('Different coverage sets · Do not combine these metrics')).toBeInTheDocument()
  })
})

describe('navigation between the finance screens', () => {
  it('opens a payment from the register and returns with the filters intact', async () => {
    const user = setup()
    const router = renderRoute(`${ROUTES.billingPayments}?method=${encodeURIComponent('UPI / QR')}`)

    await user.click(screen.getAllByRole('link', { name: /PAY-2026-112/ })[0])
    expect(screen.getByRole('heading', { name: 'Payment Details' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Payment Register · filtered view/ }))
    expect(router.state.location.search).toContain('method=')
  })

  it('reaches the receipt and refund records from a payment', () => {
    renderRoute(pathFor(ROUTES.billingPayment, { paymentId: 'PAY-2026-112' }))

    expect(screen.getAllByRole('link', { name: /REC-2026-091/ })[0]).toHaveAttribute('href', pathFor(ROUTES.billingReceipt, { receiptId: 'REC-2026-091' }))
    expect(screen.getByRole('link', { name: /Manage allocation/ })).toHaveAttribute('href', pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))
  })
})
