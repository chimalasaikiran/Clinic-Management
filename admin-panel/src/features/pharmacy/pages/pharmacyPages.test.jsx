import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { billingFake } from '../../../test/fixtures/billingFake'
import { renderStockRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

const dialog = () => screen.getByRole('dialog')
const lastCall = (name) => billingFake.inventory.calls.filter(([call]) => call === name).at(-1)

describe('pharmacy workspace', () => {
  it('derives the queue tiles and stock exceptions at the dispensing pharmacy', async () => {
    await renderStockRoute(ROUTES.pharmacy)

    expect(screen.getByRole('heading', { name: 'Pharmacy' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Dispensing pharmacy' })).toHaveValue('MAIN-RX')
    // Cetirizine has no stock at Main Pharmacy; paracetamol is below its safety level; one naproxen batch expires soon.
    expect(within(screen.getByText('Cetirizine 10mg').closest('li, div')).getByText('CRITICAL')).toBeInTheDocument()
    expect(within(screen.getByText('Paracetamol 500mg').closest('li, div')).getByText('LOW STOCK')).toBeInTheDocument()
    expect(within(screen.getByText('Naproxen 250mg').closest('li, div')).getByText('FEFO ROTATION')).toBeInTheDocument()
  })

  it('dispenses a prescription from the earliest-expiry batch and then shows the dispensing record', async () => {
    const user = setup()
    await renderStockRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Open prescription RX-000001' }))
    expect(within(dialog()).getByText('Dispense & Verify Medication')).toBeInTheDocument()
    expect(within(dialog()).getByText('NP-A')).toBeInTheDocument()
    expect(within(dialog()).getByText(/5 of 5 verified/)).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(lastCall('dispense')).toEqual(['dispense', 'rx-1', { locationId: 'loc-main', quantities: { 'rxl-1': 10, 'rxl-2': 6 }, registerConfirmed: false, consentConfirmed: false }])

    await user.click(screen.getByRole('tab', { name: /completed today/i }))
    await user.click(screen.getByRole('button', { name: 'Open prescription RX-000001' }))
    expect(within(dialog()).getByText('Dispensing Record Detail')).toBeInTheDocument()
    expect(within(dialog()).getByText(/DSP-000011/)).toBeInTheDocument()
  })

  it('refuses a Schedule H1 prescription until consent and the register entry are recorded', async () => {
    const user = setup()
    await renderStockRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Open prescription RX-000002' }))
    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(/Schedule H1/)

    await user.click(within(dialog()).getByRole('checkbox', { name: /patient consent recorded/i }))
    await user.click(within(dialog()).getByRole('checkbox', { name: /statutory register entry/i }))
    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(lastCall('dispense')[2]).toMatchObject({ registerConfirmed: true, consentConfirmed: true })
  })

  it('supports a partial dispense of one medicine', async () => {
    const user = setup()
    await renderStockRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Open prescription RX-000001' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Dispense Partial / Split Batch' }))
    await fill(user, within(dialog()).getByLabelText('Dispense quantity for Paracetamol 500 mg'), '0')
    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('tab', { name: /in progress/i }))
    expect(screen.getByRole('button', { name: 'Open prescription RX-000001' })).toBeInTheDocument()
  })

  it('sends a stockout to a prefilled urgent stock request', async () => {
    const user = setup()
    const router = await renderStockRoute(ROUTES.pharmacy)

    await user.click(screen.getAllByRole('link', { name: 'Emergency Transfer' })[0])
    expect(router.state.location.pathname).toBe(ROUTES.pharmacyRequestNew)
    expect(await screen.findByRole('combobox', { name: /priority/i })).toHaveValue('Urgent')
  })

  it('opens the batch registry for a near-expiry medicine', async () => {
    const user = setup()
    await renderStockRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Review Batch' }))
    expect(within(dialog()).getByText('Medicine & Batch Details')).toBeInTheDocument()
    expect(within(dialog()).getAllByText('NP-A').length).toBeGreaterThan(0)
  })
})

describe('prescription queue', () => {
  it('filters the signed prescriptions by status and search', async () => {
    const user = setup()
    await renderStockRoute(ROUTES.pharmacyQueue)

    expect(screen.getAllByRole('button', { name: 'View Prescription' })).toHaveLength(3)
    await user.click(screen.getByRole('tab', { name: 'On hold' }))
    expect(screen.getAllByRole('button', { name: 'View Prescription' })).toHaveLength(1)
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'All statuses' }))
    await user.type(screen.getByLabelText('Search prescriptions'), 'farida')
    expect(screen.getAllByRole('button', { name: 'View Prescription' })).toHaveLength(1)
  })
})

describe('stock requests', () => {
  it('needs at least one medicine, then reaches Inventory as an awaiting-review request', async () => {
    const user = setup()
    const router = await renderStockRoute(ROUTES.pharmacyRequestNew)

    await user.click(screen.getByRole('button', { name: 'Submit Request' }))
    expect(screen.getByText('Add at least one medicine to request.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText('Search medicine by name, generic or item code'), 'Cetirizine 10mg')
    await user.click(screen.getByRole('button', { name: '+ Add Item' }))
    await fill(user, screen.getByLabelText('Request quantity for Cetirizine 10mg'), '50')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    expect(await screen.findByText(/was submitted to Central Stores for approval/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.pharmacyRequests)
    expect(lastCall('createRequest')[1]).toMatchObject({ submit: true, locationId: 'loc-main', lines: [{ itemId: 'item-cet', requested: 50 }] })

    await act(() => router.navigate(ROUTES.inventoryRequests))
    expect(await screen.findByRole('link', { name: 'SR-000011' })).toBeInTheDocument()
  })

  it('expands a request to show what was issued and what is pending', async () => {
    const user = setup()
    await renderStockRoute(ROUTES.pharmacyRequests)

    await user.click(screen.getByRole('button', { name: 'View details for SR-000002' }))
    expect(screen.getByText('SR-000002 · Fulfillment details')).toBeInTheDocument()
  })
})

describe('receiving at the dispensary', () => {
  it('posts a dispatched transfer into dispensary stock', async () => {
    const user = setup()
    const router = await renderStockRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: /receive stock \(grn\)/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Post receipt' }))
    expect(within(dialog()).getByText(/Confirm that the quantities and batches were physically verified/)).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('checkbox', { name: /physically verified/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Post receipt' }))
    await waitFor(() => expect(lastCall('receiveTransfer')).toBeTruthy())

    await act(() => router.navigate(ROUTES.inventoryTransfers))
    const row = (await screen.findByRole('link', { name: 'TR-000001' })).closest('tr')
    expect(within(row).getByText('Received')).toBeInTheDocument()
  })
})

describe('returns & discrepancies', () => {
  it('lists the reported cases', async () => {
    await renderStockRoute(ROUTES.pharmacyReturns)

    expect(screen.getByText('Showing 1–2 of 2 cases')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'RET-000001' })).toBeInTheDocument()
  })

  it('returns to the filtered list from a case detail', async () => {
    const user = setup()
    const router = await renderStockRoute(ROUTES.pharmacyReturns)

    await user.selectOptions(screen.getByLabelText('Case type'), 'Discrepancy')
    await user.click(screen.getByRole('link', { name: 'DIS-000001' }))
    expect(screen.getByRole('heading', { name: /DIS-000001/ })).toBeInTheDocument()
    expect(screen.getAllByText('−10 tablets').length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('link', { name: /back to returns & discrepancies/i })[0])
    expect(router.state.location.search).toBe('?type=Discrepancy')
  })

  it('restocks an approved return at the chosen pharmacy', async () => {
    const user = setup()
    await renderStockRoute(pathFor(ROUTES.pharmacyReturn, { caseId: 'RET-000001' }))

    const review = screen.getByRole('region', { name: 'Review this case' })
    await user.click(within(review).getByRole('button', { name: 'Approve & restock 4 tablets' }))
    expect(within(review).getByText('Record the outcome of the review.')).toBeInTheDocument()
    await fill(user, within(review).getByLabelText(/review outcome/i), 'Unopened strips; fit for restock.')
    await user.click(within(review).getByRole('button', { name: 'Approve & restock 4 tablets' }))

    expect(await screen.findAllByText('Restocked at Main Pharmacy')).not.toHaveLength(0)
    expect(lastCall('decideCase')[2]).toMatchObject({ decision: 'restock', locationId: 'loc-main' })
  })

  it('checks a patient return against what was dispensed on the prescription', async () => {
    const user = setup()
    const router = await renderStockRoute(ROUTES.pharmacyReturnNew)

    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('Choose the medicine.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^medicine/i), 'MED-NAP-250')
    await user.selectOptions(screen.getByLabelText(/^batch/i), 'bat-nap-a')
    await user.selectOptions(screen.getByLabelText(/receiving location/i), 'Main Pharmacy')
    await fill(user, screen.getByLabelText(/prescription reference/i), 'RX-000002')
    await fill(user, screen.getByLabelText(/quantity returned/i), '20')
    await user.selectOptions(screen.getByLabelText(/return reason/i), 'Therapy changed')
    await user.selectOptions(screen.getByLabelText(/packaging condition/i), 'Unopened strips')
    await user.selectOptions(screen.getByLabelText(/assign reviewer/i), 'u-2')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('This medicine was not dispensed on that prescription.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/prescription reference/i), 'RX-000003')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('Only 10 were dispensed on RX-000003.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/quantity returned/i), '4')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(await screen.findByRole('heading', { name: /RET-000011/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.pharmacyReturn, { caseId: 'RET-000011' }))
    expect(lastCall('createCase')[1]).toMatchObject({ type: 'Return', itemId: 'item-nap', batchId: 'bat-nap-a', qty: 4, origin: 'RX-000003', assigneeId: 'u-2' })
  })

  it('reports a discrepancy only when the counts differ', async () => {
    const user = setup()
    await renderStockRoute(`${ROUTES.pharmacyReturnNew}?type=Discrepancy`)

    await user.selectOptions(screen.getByLabelText(/^medicine/i), 'MED-00124')
    await user.selectOptions(screen.getByLabelText(/^batch/i), 'bat-p26a')
    await user.selectOptions(screen.getByLabelText(/branch \/ location/i), 'Central Stores')
    await fill(user, screen.getByLabelText(/expected quantity/i), '100')
    await fill(user, screen.getByLabelText(/observed quantity/i), '100')
    await user.selectOptions(screen.getByLabelText(/^category/i), 'Shortage')
    await fill(user, screen.getByLabelText(/explanation/i), 'Recount matched the ledger.')
    await user.selectOptions(screen.getByLabelText(/assign reviewer/i), 'u-1')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText(/there is no variance to report/)).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/observed quantity/i), '94')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(await screen.findByRole('heading', { name: /DIS-000011/ })).toBeInTheDocument()
    expect(screen.getAllByText('−6 tablets').length).toBeGreaterThan(0)
  })

  it('opens an unknown case as not found', async () => {
    await renderStockRoute(pathFor(ROUTES.pharmacyReturn, { caseId: 'RET-9999' }))
    expect(screen.getByText('This case could not be found')).toBeInTheDocument()
  })
})
