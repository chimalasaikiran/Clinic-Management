import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderBillingRoute } from '../../../test/renderRoute'
import { createPatientsApi, fixturePatientsForApi } from '../../../test/fixtures/patientsApi'
// Patients come from the (faked) API; the clinical and billing records from the in-memory fixtures.
const patientsApiFake = vi.hoisted(() => ({ api: null }))
vi.mock('../../patients/api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => patientsApiFake.api[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), appointmentsApi: forward('appointmentsApi'), practitionersApi: forward('practitionersApi'), branchesApi: forward('branchesApi'), clinicalApi: forward('clinicalApi') }
})
beforeEach(() => {
  patientsApiFake.api = createPatientsApi({ patients: fixturePatientsForApi() }).api
})


const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

beforeEach(() => localStorage.clear())

describe('billing overview', () => {
  it('derives the figures and the priority queue from the invoices and payments', async () => {
    await renderBillingRoute(ROUTES.billing)

    expect(screen.getByRole('heading', { name: 'Billing & Finance' })).toBeInTheDocument()
    // All recorded dates: ₹66,900 received less ₹2,000 refunded.
    expect(screen.getByText('₹64,900')).toBeInTheDocument()
    expect(screen.getAllByText('₹3,500').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /INV-2026-084/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Review allocation' }).map((link) => link.getAttribute('href'))).toContain(pathFor(ROUTES.patientBilling, { patientId: 'pt-000184' }))
  })

  it('links every billing section to its page', async () => {
    await renderBillingRoute(ROUTES.billing)

    expect(screen.getByRole('link', { name: /Services & Pricing/ })).toHaveAttribute('href', ROUTES.billingServices)
    expect(screen.getByRole('link', { name: /Settlements/ })).toHaveAttribute('href', ROUTES.billingSettlements)
    expect(screen.getByRole('link', { name: /Reconciliation/ })).toHaveAttribute('href', ROUTES.billingReconciliation)
    expect(screen.queryAllByTitle('Not available in this build')).toHaveLength(0)
  })
})

describe('invoice register', () => {
  it('filters by status and keeps the filter in the address when an invoice is opened and closed again', async () => {
    const user = setup()
    const router = await renderBillingRoute(ROUTES.billingInvoices)

    expect(screen.getAllByRole('link', { name: /INV-2026-/ })).toHaveLength(4)
    await user.selectOptions(screen.getByLabelText('Status'), 'Paid in Full')
    expect(router.state.location.search).toBe('?status=Paid+in+Full')
    expect(screen.getAllByRole('link', { name: /INV-2026-/ })).toHaveLength(3)

    await user.click(screen.getAllByRole('link', { name: /INV-2026-/ })[0])
    expect(screen.getByRole('heading', { name: /INV-2026-/ })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Invoice Register/ }))
    expect(router.state.location.search).toBe('?status=Paid+in+Full')
  })

  it('finds an invoice by number and shows only invoices with a balance on request', async () => {
    const user = setup()
    await renderBillingRoute(`${ROUTES.billingInvoices}?balance=open`)

    expect(screen.getAllByRole('link', { name: /INV-2026-/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    await user.type(screen.getByLabelText('Search invoices'), 'INV-2026-071')
    expect(screen.getAllByRole('link', { name: /INV-2026-/ })).toHaveLength(1)
  })
})

describe('invoice details', () => {
  it('shows the breakdown, the allocated payment and the unallocated remainder', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingInvoice, { invoiceId: 'INV-2026-084' }))

    expect(screen.getByText('Outstanding balance')).toBeInTheDocument()
    expect(screen.getAllByText('₹3,500.00').length).toBeGreaterThan(0)
    expect(screen.getByText('PAY-2026-112 ↗')).toBeInTheDocument()
    expect(screen.getByText(/₹1,500 remains unallocated/)).toBeInTheDocument()
  })

  it('opens the payment drawer on the patient billing record from Record Payment', async () => {
    const user = setup()
    const router = await renderBillingRoute(pathFor(ROUTES.billingInvoice, { invoiceId: 'INV-2026-084' }))

    await user.click(screen.getByRole('link', { name: 'Record Payment' }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.patientBilling, { patientId: 'pt-000184' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('does not offer Record Payment on a settled invoice', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingInvoice, { invoiceId: 'INV-2026-071' }))
    expect(screen.queryByRole('link', { name: 'Record Payment' })).not.toBeInTheDocument()
  })

  it('reports an unknown invoice', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingInvoice, { invoiceId: 'INV-9999' }))
    expect(screen.getByText('This invoice could not be found')).toBeInTheDocument()
  })
})

describe('create invoice', () => {
  it('needs a payer and an explicit billing model, then issues from eligible charges and marks them invoiced', async () => {
    const user = setup()
    const router = await renderBillingRoute(`${ROUTES.billingInvoiceNew}?patient=pt-000184`)

    expect(screen.getByRole('checkbox', { name: /CHG-2026-320/ })).toBeInTheDocument()
    expect(screen.getByText(/Already invoiced · INV-2026-055/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review invoice' }))
    expect(screen.getByText('Choose the invoice recipient / payer.')).toBeInTheDocument()
    expect(screen.getByText('Choose the billing model explicitly; none is assumed.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one eligible charge.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/invoice recipient/i), 'Patient Direct (Self)')
    await user.selectOptions(screen.getByLabelText(/billing model/i), 'Hybrid')
    await user.click(screen.getByRole('checkbox', { name: /CHG-2026-320/ }))
    await user.click(screen.getByRole('button', { name: 'Review invoice' }))
    expect(screen.getByText('Review complete — ready to issue')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Issue / finalize' }))

    expect(router.state.location.pathname).toMatch(/\/billing\/invoices\/INV-000001$/)
    expect(await screen.findByRole('heading', { name: /INV-000001/ })).toBeInTheDocument()

    await act(() => router.navigate(`${ROUTES.billingInvoiceNew}?patient=pt-000184`))
    expect(screen.queryByRole('checkbox', { name: /CHG-2026-320/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Already invoiced · INV-000001/)).toBeInTheDocument()
  }, 30000)

  it('rejects a discount outside 0–100 and a due date before the invoice date', async () => {
    const user = setup()
    await renderBillingRoute(`${ROUTES.billingInvoiceNew}?patient=pt-000184`)

    await fill(user, screen.getByLabelText(/invoice discount/i), '150')
    await fill(user, screen.getByLabelText(/due date/i), '2026-10-01')
    await user.click(screen.getByRole('button', { name: 'Review invoice' }))
    expect(screen.getByText('Enter a discount between 0 and 100 percent.')).toBeInTheDocument()
    expect(screen.getByText('The due date cannot be before the invoice date.')).toBeInTheDocument()
  })
})

describe('services & pricing', () => {
  it('lists the catalogue and narrows it by status, search and tax treatment', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.billingServices)

    expect(screen.getByText('Showing 1–10 of 10 services · 10 per page')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'Inactive')
    expect(screen.getByText('Sleep Study & Overnight Polysomnography')).toBeInTheDocument()
    expect(screen.queryByText('Cardiac Follow-up')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await user.type(screen.getByLabelText('Search services'), 'echo')
    expect(screen.getByText('2D Transthoracic Echocardiography')).toBeInTheDocument()
    expect(screen.queryByText('Cardiac Follow-up')).not.toBeInTheDocument()
  })

  it('adds a service with a unique code, a price and an available branch', async () => {
    const user = setup()
    const router = await renderBillingRoute(ROUTES.billingServiceNew)

    await user.click(screen.getByRole('button', { name: 'Save service' }))
    expect(screen.getByText('Enter the service name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a unique service code.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/service name/i), 'Holter Monitoring (24h)')
    await fill(user, screen.getByLabelText(/unique service code/i), 'srv-card-01')
    await user.selectOptions(screen.getByLabelText(/^category/i), 'Diagnostic & Lab')
    await fill(user, screen.getByLabelText(/default price/i), '1500')
    await user.click(screen.getByRole('button', { name: 'Save service' }))
    expect(screen.getByText('This service code is already used in your organisation.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/unique service code/i), 'SRV-CARD-09')
    await user.click(screen.getByRole('radio', { name: 'Active' }))
    await user.click(screen.getByRole('button', { name: 'Save service' }))
    expect(screen.getByText(/Choose a tax treatment before activating/)).toBeInTheDocument()
    expect(screen.getByText(/Select at least one location before activating/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^tax treatment/i), 'No tax / Not applicable')
    await user.click(screen.getByRole('checkbox', { name: /Main Clinic/ }))
    await user.click(screen.getByRole('button', { name: 'Save service' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Service saved. SRV-CARD-09')
    expect(router.state.location.pathname).toBe(ROUTES.billingServices)
    expect(screen.getByText('Showing 1–10 of 11 services · 10 per page')).toBeInTheDocument()
  }, 30000)

  it('prices a branch with a custom override', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingServiceEdit, { serviceId: 'srv-card-01' }))

    await user.selectOptions(screen.getByLabelText('Price mode for Kondapur'), 'custom')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText(/valid non-negative price for the Kondapur override/)).toBeInTheDocument()
    await fill(user, screen.getByLabelText('Custom price for Kondapur'), '900')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Custom override')).toBeInTheDocument()
    expect(screen.getByText('₹900')).toBeInTheDocument()
    expect(screen.getByText(/Service updated · locations & prices/)).toBeInTheDocument()
  })

  it('deactivates a service only with a reason, then blocks activating an incomplete one', async () => {
    const user = setup()
    await renderBillingRoute(pathFor(ROUTES.billingService, { serviceId: 'srv-card-01' }))

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate service' }))
    expect(within(screen.getByRole('dialog')).getByText('Enter a reason for the audit trail.')).toBeInTheDocument()
    await fill(user, within(screen.getByRole('dialog')).getByLabelText(/reason for deactivation/i), 'Replaced by the 2026 package.')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate service' }))
    expect(screen.getByRole('status')).toHaveTextContent('SRV-CARD-01 is now inactive')
    expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled()
    expect(screen.getByText(/Deactivated · Replaced by the 2026 package/)).toBeInTheDocument()
  })

  it('will not activate a service whose tax treatment and locations are missing', async () => {
    await renderBillingRoute(pathFor(ROUTES.billingService, { serviceId: 'srv-diag-14' }))
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled()
    expect(screen.getByText(/Choose a tax treatment; select at least one location/i)).toBeInTheDocument()
  })
})

describe('billing configuration', () => {
  it('asks for confirmation before changing the billing model and records it in the audit', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.billingConfig)

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Hybrid/ }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(within(screen.getByRole('dialog')).getByText('Change the billing model to Hybrid?')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm change' }))
    expect(screen.getByRole('status')).toHaveTextContent('Billing configuration saved: billing model')
    expect(screen.getByText(/Configuration updated · billing model/)).toBeInTheDocument()
  })

  it('saves payment methods without a confirmation and cancels back to the saved values', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.billingConfig)

    await user.click(screen.getByRole('checkbox', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('checkbox', { name: 'Cash' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('payment methods')
  })
})
