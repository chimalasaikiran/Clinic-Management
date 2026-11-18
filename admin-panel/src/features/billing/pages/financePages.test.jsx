import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { createBillingApi, ledgerSeed } from '../../../test/fixtures/billingApi'
import { billingFake } from '../../../test/fixtures/billingFake'
import { renderBillingRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

beforeEach(() => localStorage.clear())

describe('charges', () => {
  it('lists the charges with their invoice and charge status', async () => {
    await renderBillingRoute(ROUTES.billingCharges)

    expect(screen.getByRole('heading', { name: 'Charge Register' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CHG-2026-320' })).toHaveAttribute('href', pathFor(ROUTES.billingCharge, { chargeId: 'CHG-2026-320' }))
    expect(screen.getByText('3 records · Newest first')).toBeInTheDocument()
  })

  it('blocks confirmation for a service with no tax setup but still saves a draft', async () => {
    const user = setup()
    const router = await renderBillingRoute(`${ROUTES.billingChargeNew}?patient=pt-000184`)

    await user.selectOptions(screen.getByLabelText(/^Service \/ item/), 'srv-card-02')

    expect(screen.getByText('Draft can be saved; confirmation is blocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Charge' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    expect(await screen.findByRole('link', { name: 'CHG-000001' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.billingCharges)
    expect(billingFake.current.calls.find(([name]) => name === 'createCharge')[1]).toMatchObject({ patientId: 'pt-000184', serviceId: 'srv-card-02', confirm: false })
    expect(screen.getAllByRole('link', { name: /Continue draft/ }).length).toBeGreaterThan(0)
  })

  it('asks before leaving a form with unsaved changes', async () => {
    const user = setup()
    await renderBillingRoute(`${ROUTES.billingChargeNew}?patient=pt-000184`)

    await user.selectOptions(screen.getByLabelText(/^Service \/ item/), 'srv-card-01')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Leave with unsaved changes?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('Leave with unsaved changes?')).not.toBeInTheDocument()
  })
})

describe('payments', () => {
  it('shows each payment with its allocated and unallocated amounts', async () => {
    await renderBillingRoute(ROUTES.billingPayments)

    const row = screen.getByRole('link', { name: /PAY-2026-112/ }).closest('tr')
    expect(within(row).getByText('₹7,000')).toBeInTheDocument()
    // ₹7,000 less ₹5,000 applied and a ₹500 processed refund.
    expect(within(row).getByText('₹1,500 unallocated')).toBeInTheDocument()
    expect(within(row).getByText('Partially allocated')).toBeInTheDocument()
  })

  it('records an advance unallocated and opens its details', async () => {
    const user = setup()
    const router = await renderBillingRoute(`${ROUTES.billingPaymentNew}?patient=pt-000184`)

    await user.click(screen.getByRole('radio', { name: 'Advance / on account' }))
    await fill(user, screen.getByLabelText(/^Amount/), '1000')
    await user.click(screen.getByRole('radio', { name: 'UPI' }))
    await fill(user, screen.getByLabelText('Transaction reference'), 'UPI/777')
    await user.click(screen.getAllByRole('button', { name: 'Review payment' })[0])
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }))

    expect(await screen.findByRole('heading', { name: 'Payment Details' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.billingPayment, { paymentId: 'PAY-000001' }))
    expect(screen.getAllByText('₹1,000').length).toBeGreaterThan(0)
    expect(billingFake.current.calls.find(([name]) => name === 'recordPayment')[1]).toMatchObject({ purpose: 'advance', channel: 'UPI / QR', txnReference: 'UPI/777', allocations: [] })
  })

  it('applies a collection against charges to the open invoice', async () => {
    const user = setup()
    await renderBillingRoute(`${ROUTES.billingPaymentNew}?patient=pt-000184`)

    await fill(user, screen.getByLabelText(/^Amount/), '3500')
    await user.click(screen.getByRole('radio', { name: 'Cash' }))
    await user.click(screen.getAllByRole('button', { name: 'Review payment' })[0])
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }))

    expect(await screen.findByRole('heading', { name: 'Payment Details' })).toBeInTheDocument()
    expect(billingFake.current.calls.find(([name]) => name === 'recordPayment')[1]).toMatchObject({ purpose: 'charges', allocations: [{ invoiceId: 'u-INV-2026-084', amount: 3500 }] })
    expect(screen.getAllByText('Fully allocated').length).toBeGreaterThan(0)
  })

  it('offers only the payment methods switched on in the configuration', async () => {
    const seed = ledgerSeed()
    seed.settings = { ...seed.settings, cashEnabled: false, version: 2 }
    billingFake.use(createBillingApi({ seed }))
    await renderBillingRoute(`${ROUTES.billingPaymentNew}?patient=pt-000184`)

    expect(screen.queryByRole('radio', { name: 'Cash' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'UPI' })).toBeInTheDocument()
  })

  it('holds the review step until the amount and method are valid', async () => {
    const user = setup()
    await renderBillingRoute(`${ROUTES.billingPaymentNew}?patient=pt-000184`)

    expect(screen.getAllByRole('button', { name: 'Review payment' })[0]).toBeDisabled()
    expect(screen.getByText('Not ready for review')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/^Amount/), '9000')
    await user.click(screen.getByRole('radio', { name: 'Cash' }))

    expect(screen.getAllByRole('button', { name: 'Review payment' })[0]).toBeDisabled()
  })

  // Without the pending ₹1,500 refund request, PAY-2026-112 has ₹1,500 of credit to apply.
  const withoutPendingRefund = () => {
    const seed = ledgerSeed()
    seed.refunds = seed.refunds.filter((refund) => refund.reference !== 'REF-2026-018')
    billingFake.use(createBillingApi({ seed }))
  }

  it('applies the unallocated credit to the open invoice', async () => {
    withoutPendingRefund()
    const user = setup()
    const router = await renderBillingRoute(pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))

    expect(screen.getByLabelText(/^Preview amount/)).toHaveValue('1500')
    await user.click(screen.getAllByRole('button', { name: 'Confirm allocation' })[0])

    expect(await screen.findByRole('heading', { name: 'Payment Details' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.billingPayment, { paymentId: 'PAY-2026-112' }))
    expect(screen.getAllByText('Fully allocated').length).toBeGreaterThan(0)
  })

  it('keeps credit held by a pending refund out of allocation', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))

    expect(screen.getByLabelText(/^Preview amount/)).toHaveValue('')
    expect(screen.getAllByRole('button', { name: 'Confirm allocation' })[0]).toBeDisabled()
  })

  it('rejects a preview above the available payment credit', async () => {
    withoutPendingRefund()
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))

    await fill(user, screen.getByLabelText(/^Preview amount/), '2500')

    expect(screen.getAllByText('Amount exceeds the unallocated payment credit.').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Confirm allocation' })[0]).toBeDisabled()
  })
})

describe('receipts', () => {
  it('shows the receipt issued with the payment, ready to print or download', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingReceipt, { receiptId: 'REC-2026-091' }))

    expect(screen.getByText('RECEIPT')).toBeInTheDocument()
    expect(screen.getAllByText('₹7,000').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()
  })

  it('lists one receipt per payment', async () => {
    await renderBillingRoute(ROUTES.billingReceipts)

    expect(screen.getByRole('link', { name: /REC-2026-091/ })).toBeInTheDocument()
    expect(screen.getByText(`Showing ${ledgerSeed().payments.length} of ${ledgerSeed().payments.length} receipts`)).toBeInTheDocument()
  })
})

describe('refunds', () => {
  it('summarises the register by status', async () => {
    await renderBillingRoute(ROUTES.billingRefunds)

    const strip = screen.getByText('Processed refunds').closest('dl')
    expect(within(strip).getByText('₹2,000')).toBeInTheDocument()
    expect(screen.getByText(/Failed does not mean refunded/)).toBeInTheDocument()
    expect(screen.getByText('6 refunds · Newest first')).toBeInTheDocument()
  })

  it('blocks an amount above the refundable balance, then submits a valid request', async () => {
    const user = setup()
    const router = await renderBillingRoute(`${ROUTES.billingRefundNew}?payment=PAY-2026-119`)

    await fill(user, screen.getByLabelText(/^Refund amount/), '900')
    expect(screen.getByText('Amount exceeds the refundable limit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Refund amount/), '800')
    await fill(user, screen.getByLabelText(/^Internal reference/), 'RF-DESK-1')
    await user.click(screen.getByRole('checkbox', { name: /I confirm the original payment/ }))
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))

    expect(await screen.findByRole('heading', { name: 'Refund Details' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.billingRefund, { refundId: 'RFD-000001' }))
    expect(billingFake.current.calls.find(([name]) => name === 'requestRefund')[1]).toMatchObject({ paymentId: 'u-PAY-2026-119', amount: 800, internalReference: 'RF-DESK-1', releasesAllocations: false })
  })

  it('lets a refund take back applied money only when asked to', async () => {
    const user = setup()
    await renderBillingRoute(`${ROUTES.billingRefundNew}?payment=PAY-2026-077`)

    await fill(user, screen.getByLabelText(/^Refund amount/), '1000')
    expect(screen.getByText('Amount exceeds the refundable limit')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Also take back money already applied/ }))
    expect(screen.queryByText('Amount exceeds the refundable limit')).not.toBeInTheDocument()
  })

  it('needs approval before the money can be recorded as returned', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingRefund, { refundId: 'REF-2026-018' }))

    expect(screen.getByRole('button', { name: 'Record as processed' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Approve refund' }))

    expect(await screen.findByRole('button', { name: 'Record as processed' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Approve refund' })).toBeDisabled()
  })

  it('records an approved refund as processed with the bank or gateway reference', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingRefund, { refundId: 'REF-2026-016' }))

    await user.click(screen.getByRole('button', { name: 'Record as processed' }))
    await user.click(screen.getByRole('button', { name: 'Confirm money returned' }))
    expect(screen.getByText('Enter the bank or gateway refund reference.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/^Bank or gateway refund reference/), 'RFND-778')
    await user.click(screen.getByRole('button', { name: 'Confirm money returned' }))

    expect(await screen.findByText('RFND-778')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record as processed' })).toBeDisabled()
    expect(screen.getAllByText('Processed').length).toBeGreaterThan(0)
  })

  it('rejects a pending refund only with a reason', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingRefund, { refundId: 'REF-2026-018' }))

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Reject refund' }))
    expect(screen.getByText('Give the reason in at least 10 characters.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/^Reason for rejecting/), 'Advance is still needed for the next session.')
    await user.click(screen.getByRole('button', { name: 'Reject refund' }))

    expect(await screen.findByText(/Refund rejected · Advance is still needed/)).toBeInTheDocument()
  })
})

describe('reconciliation', () => {
  it('compares source lines with ClinicOS payments', async () => {
    await renderBillingRoute(ROUTES.billingReconciliation)

    expect(screen.getByText('₹12,150')).toBeInTheDocument()
    expect(screen.getByText('₹10,200')).toBeInTheDocument()
    expect(screen.getByText('+ ₹1,950')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /EXC-000001/ })).toHaveAttribute('href', pathFor(ROUTES.billingException, { exceptionId: 'EXC-000001' }))
    expect(screen.getByText(/Gateway · gateway-oct.csv imported/)).toBeInTheDocument()
  })

  it('counts a suggested match only once it is confirmed', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.billingReconciliation)

    await user.click(screen.getByRole('button', { name: 'Confirm match RZP-88' }))

    expect(await screen.findByText('2 / 2')).toBeInTheDocument()
    expect(billingFake.current.calls).toContainEqual(['confirmLine', 'line-4'])
  })

  it('imports a statement file and reports what was matched', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.billingReconciliation)

    await user.click(screen.getByRole('button', { name: 'Import statement' }))
    const form = screen.getByRole('region', { name: 'Import statement' })
    await fill(user, within(form).getByLabelText(/^Source/), 'Current account')
    await user.upload(within(form).getByLabelText(/^Statement file/), new File(['date,reference,amount\n2026-10-22,NEFT-1,500\n2026-10-22,NEFT-2,700\n'], 'bank.csv', { type: 'text/csv' }))
    await user.click(within(form).getByRole('button', { name: 'Import statement' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('IMP-000001: 2 lines imported (0 matched, 0 to review, 2 exceptions)')
  })

  it('only resolves an exception once evidence, a note and confirmation are given', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingException, { exceptionId: 'EXC-000001' }))

    const resolve = screen.getByRole('button', { name: 'Confirm & mark resolved' })
    expect(resolve).toBeDisabled()
    expect(screen.getByRole('button', { name: /Retry source processing/ })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Resolution note/), 'Gateway fee breakdown confirms the difference.')
    await fill(user, screen.getByLabelText(/^Supporting evidence/), 'Gateway fee report, October')
    await user.click(screen.getByRole('checkbox'))
    await user.click(resolve)

    expect(await screen.findByText('Gateway fee report, October')).toBeInTheDocument()
    expect(screen.getAllByText('Exception resolved').length).toBeGreaterThan(0)
    expect(billingFake.current.state.exceptions.find((entry) => entry.id === 'exc-1')).toMatchObject({ status: 'resolved', resolutionType: 'Explained source difference' })
  })

  it('assigns an open exception to whoever starts the review', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingException, { exceptionId: 'EXC-000002' }))

    expect(screen.getByText('Not yet assigned')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start review (assign to me)' }))

    expect(await screen.findByText('Owner · Siddharth Verma')).toBeInTheDocument()
  })
})

describe('balances, settlements and reports', () => {
  it('keeps prepaid funds, pending reserve and amount owed separate', async () => {
    await renderBillingRoute(ROUTES.billingBalances)

    const strip = screen.getByText('Held prepaid funds').closest('dl')
    expect(within(strip).getAllByText('₹1,500')).toHaveLength(2)
    expect(within(strip).getByText('₹0')).toBeInTheDocument()
    expect(screen.getByText('₹3,500')).toBeInTheDocument()
    expect(screen.getByText('One set of funds, counted once')).toBeInTheDocument()
  })

  it('reports settlements as unavailable rather than zero', async () => {
    await renderBillingRoute(ROUTES.billingSettlements)

    expect(screen.getByText('Settlement records are not available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export settlements' })).toBeDisabled()
  })

  it('shows distinct coverage per report and disables export for unavailable ones', async () => {
    await renderBillingRoute(ROUTES.billingReports)

    expect(screen.getByText('3 / 9')).toBeInTheDocument()
    expect(screen.getAllByText('Export disabled')).toHaveLength(6)
    expect(screen.getByText('Different coverage sets · Do not combine these metrics')).toBeInTheDocument()
  })
})

describe('navigation between the finance screens', () => {
  it('opens a payment from the register and returns with the filters intact', async () => {
    const user = setup()
    const router = await renderBillingRoute(`${ROUTES.billingPayments}?method=${encodeURIComponent('UPI / QR')}`)

    await user.click(screen.getAllByRole('link', { name: /PAY-2026-112/ })[0])
    expect(screen.getByRole('heading', { name: 'Payment Details' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Payment Register · filtered view/ }))
    expect(router.state.location.search).toContain('method=')
  })

  it('reaches the receipt and refund records from a payment', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingPayment, { paymentId: 'PAY-2026-112' }))

    expect(screen.getAllByRole('link', { name: /REC-2026-091/ })[0]).toHaveAttribute('href', pathFor(ROUTES.billingReceipt, { receiptId: 'REC-2026-091' }))
    expect(screen.getByRole('link', { name: /Manage allocation/ })).toHaveAttribute('href', pathFor(ROUTES.billingAllocation, { paymentId: 'PAY-2026-112' }))
  })
})
