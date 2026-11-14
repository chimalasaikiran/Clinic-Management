import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

const dialog = () => screen.getByRole('dialog')

describe('pharmacy workspace', () => {
  it('derives the queue tiles and stock exceptions from the records', () => {
    renderRoute(ROUTES.pharmacy)

    expect(screen.getByRole('heading', { name: 'Pharmacy' })).toBeInTheDocument()
    expect(screen.getByText('1 STAT Priority')).toBeInTheDocument()
    expect(screen.getByText('Atropine 0.6mg/1ml')).toBeInTheDocument()
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('Telmisartan 40mg')).toBeInTheDocument()
    expect(screen.getByText('FEFO ROTATION')).toBeInTheDocument()
  })

  it('dispenses a prescription from the earliest-expiry batch and then shows the dispensing record', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Open prescription RX-10284' }))
    expect(within(dialog()).getByText('Dispense & Verify Medication')).toBeInTheDocument()
    expect(within(dialog()).getByText('BT-RAM-2026-08')).toBeInTheDocument()
    expect(within(dialog()).getByText(/5 of 5 verified/)).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Rx #RX-10284 dispensed & verified')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /completed today/i }))
    await user.click(screen.getByRole('button', { name: 'Open prescription RX-10284' }))
    expect(within(dialog()).getByText('Dispensing Record Detail')).toBeInTheDocument()
    expect(within(dialog()).getByText(/DSP-2026-0842/)).toBeInTheDocument()
  })

  it('refuses a Schedule H1 prescription until consent and the register entry are recorded', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Open prescription RX-10279' }))
    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(/Schedule H1/)

    await user.click(within(dialog()).getByRole('checkbox', { name: /OTP consent captured/i }))
    await user.click(within(dialog()).getByRole('checkbox', { name: /statutory register entry/i }))
    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('supports a partial dispense of one medicine', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Open prescription RX-10284' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Dispense Partial / Split Batch' }))
    await fill(user, within(dialog()).getByLabelText('Dispense quantity for Tab. Atorvastatin 40mg'), '0')
    await fill(user, within(dialog()).getByLabelText('Dispense quantity for Tab. Ecosprin 75mg'), '0')
    await user.click(within(dialog()).getByRole('button', { name: /authorize & complete dispensing/i }))

    await user.click(screen.getByRole('tab', { name: /in progress/i }))
    expect(screen.getByRole('button', { name: 'Open prescription RX-10284' })).toBeInTheDocument()
  })

  it('sends a stockout to a prefilled urgent stock request', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('link', { name: 'Emergency Transfer' }))
    expect(router.state.location.pathname).toBe(ROUTES.pharmacyRequestNew)
    expect(screen.getByLabelText('Request quantity for Atropine 0.6mg/1ml')).toHaveValue(10)
    expect(screen.getByRole('combobox', { name: /priority/i })).toHaveValue('Urgent')
  })

  it('opens the batch registry for a near-expiry medicine', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: 'Review Batch' }))
    expect(within(dialog()).getByText('Medicine & Batch Details')).toBeInTheDocument()
    expect(within(dialog()).getAllByText('HA-901').length).toBeGreaterThan(0)
  })
})

describe('prescription queue', () => {
  it('filters the records by status and search', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacyQueue)

    expect(screen.getAllByRole('button', { name: 'View Prescription' })).toHaveLength(4)
    await user.click(screen.getByRole('tab', { name: 'On hold' }))
    expect(screen.getAllByRole('button', { name: 'View Prescription' })).toHaveLength(1)
    expect(screen.getByText('Vikramaditya Rao')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'All statuses' }))
    await user.type(screen.getByLabelText('Search prescriptions'), 'farida')
    expect(screen.getAllByRole('button', { name: 'View Prescription' })).toHaveLength(1)
  })
})

describe('stock requests', () => {
  it('needs at least one medicine, then reaches Inventory as an awaiting-review request', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.pharmacyRequestNew)

    await user.click(screen.getByRole('button', { name: 'Submit Request' }))
    expect(screen.getByText('Add at least one medicine to request.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText('Search medicine by name, generic or item code'), 'Cetirizine 10mg')
    await user.click(screen.getByRole('button', { name: '+ Add Item' }))
    await fill(user, screen.getByLabelText('Request quantity for Cetirizine 10mg'), '50')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    expect(router.state.location.pathname).toBe(ROUTES.pharmacyRequests)
    expect(screen.getByText(/was submitted to Central Stores for approval/)).toBeInTheDocument()
    expect(screen.getByText('SR-261020-09')).toBeInTheDocument()

    await act(() => router.navigate(ROUTES.inventoryRequests))
    expect(await screen.findByRole('link', { name: 'SR-261020-09' })).toBeInTheDocument()
  })

  it('expands a request to show what was issued and what is pending', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacyRequests)

    await user.click(screen.getByRole('button', { name: 'View details for SR-261017-05' }))
    expect(screen.getByText('SR-261017-05 · Fulfillment details')).toBeInTheDocument()
    expect(screen.getByText('Balance pending replenishment at Central Stores.')).toBeInTheDocument()
  })

  it('pages through the request history and filters by status', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacyRequests)

    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText(/^Showing 9–10 of 10 requests/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.selectOptions(screen.getByLabelText('Status'), 'Rejected')
    expect(screen.getByText('SR-261015-02')).toBeInTheDocument()
  })
})

describe('receiving at the dispensary', () => {
  it('posts a dispatched transfer into dispensary stock', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.pharmacy)

    await user.click(screen.getByRole('button', { name: /receive stock \(grn\)/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Post receipt' }))
    expect(within(dialog()).getByText(/Confirm that the quantities and batches were physically verified/)).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('checkbox', { name: /physically verified/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Post receipt' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await act(() => router.navigate(ROUTES.inventoryTransfers))
    const row = (await screen.findByRole('link', { name: 'TR-261019-04' })).closest('tr')
    expect(within(row).getByText('Received')).toBeInTheDocument()
  })
})

describe('returns & discrepancies', () => {
  it('summarises the cases and pages through them', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacyReturns)

    expect(screen.getByText('Showing 1–8 of 12 cases')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('Showing 9–12 of 12 cases')).toBeInTheDocument()
  })

  it('returns to the filtered list from a case detail', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.pharmacyReturns)

    await user.selectOptions(screen.getByLabelText('Case type'), 'Discrepancy')
    await user.click(screen.getByRole('link', { name: 'DIS-2073' }))
    expect(screen.getByRole('heading', { name: /DIS-2073/ })).toBeInTheDocument()
    expect(screen.getByText('−10 capsules')).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: /back to returns & discrepancies/i })[0])
    expect(router.state.location.search).toBe('?type=Discrepancy')
  })

  it('checks a patient return against what was dispensed on the prescription', async () => {
    const user = setup()
    renderRoute(ROUTES.pharmacyReturnNew)

    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('Choose the medicine.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^medicine/i), 'MED-DM-MSR-500')
    await user.selectOptions(screen.getByLabelText(/^batch/i), 'BT-MSR-2026-06 · Main Pharmacy')
    await user.selectOptions(screen.getByLabelText(/receiving location/i), 'OP Pharmacy')
    await fill(user, screen.getByLabelText(/prescription reference/i), 'RX-10284')
    await fill(user, screen.getByLabelText(/quantity returned/i), '20')
    await user.selectOptions(screen.getByLabelText(/return reason/i), 'Therapy changed')
    await user.selectOptions(screen.getByLabelText(/packaging condition/i), 'Unopened strips')
    await user.selectOptions(screen.getByLabelText(/assign reviewer/i), 'R. Pillai')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('This medicine was not dispensed on that prescription.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/prescription reference/i), 'RX-10276')
    await fill(user, screen.getByLabelText(/quantity returned/i), '80')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('Only 60 were dispensed on RX-10276.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/quantity returned/i), '20')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByRole('heading', { name: /RET-1049/ })).toBeInTheDocument()
    expect(screen.getAllByText('Awaiting review').length).toBeGreaterThan(0)
  })

  it('reports a discrepancy only when the counts differ', async () => {
    const user = setup()
    renderRoute(`${ROUTES.pharmacyReturnNew}?type=Discrepancy`)

    await user.selectOptions(screen.getByLabelText(/^medicine/i), 'MED-00124')
    await user.selectOptions(screen.getByLabelText(/^batch/i), 'BAT-001')
    await user.selectOptions(screen.getByLabelText(/branch \/ location/i), 'Central Stores')
    await fill(user, screen.getByLabelText(/expected quantity/i), '100')
    await fill(user, screen.getByLabelText(/observed quantity/i), '100')
    await user.selectOptions(screen.getByLabelText(/^category/i), 'Shortage')
    await fill(user, screen.getByLabelText(/explanation/i), 'Recount matched the ledger.')
    await user.selectOptions(screen.getByLabelText(/assign reviewer/i), 'A. Nair')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText(/there is no variance to report/)).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/observed quantity/i), '94')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByRole('heading', { name: /DIS-2074/ })).toBeInTheDocument()
    expect(screen.getByText('−6 tablets')).toBeInTheDocument()
  })

  it('opens an unknown case as not found', () => {
    renderRoute(pathFor(ROUTES.pharmacyReturn, { caseId: 'RET-9999' }))
    expect(screen.getByText('This case could not be found')).toBeInTheDocument()
  })
})
