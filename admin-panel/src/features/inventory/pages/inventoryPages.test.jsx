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

describe('inventory workspace', () => {
  it('lists stock on hand with statuses derived from the batches', () => {
    renderRoute(ROUTES.inventory)

    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    const table = screen.getAllByRole('table')[0]
    expect(within(table).getByText('Paracetamol 500mg')).toBeInTheDocument()
    const row = within(table).getByText('Paracetamol 500mg').closest('tr')
    expect(within(row).getByText('1,200')).toBeInTheDocument()
    expect(within(row).getByText('Near expiry')).toBeInTheDocument()
    expect(within(screen.getByText('Cetirizine 10mg').closest('tr')).getByText('Low stock')).toBeInTheDocument()
  })

  it('opens the stock list already filtered from a Needs attention link', async () => {
    const user = setup()
    renderRoute(ROUTES.inventory)

    await user.click(screen.getAllByRole('link', { name: 'Low stock' })[0])
    const table = screen.getAllByRole('table')[0]
    expect(within(table).getByText('Cetirizine 10mg')).toBeInTheDocument()
    expect(within(table).queryByText('Metformin 500mg')).not.toBeInTheDocument()
  })

  it('switches between the six inventory sections', async () => {
    const user = setup()
    renderRoute(ROUTES.inventory)

    await user.click(screen.getByRole('link', { name: 'Purchase Orders' }))
    expect(screen.getByRole('link', { name: 'PO-261018-04' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Adjustments' }))
    expect(screen.getByText('ADJ-261019-02')).toBeInTheDocument()
  })
})

describe('stock request review', () => {
  it('requires a reason for a partial approval, reserves stock and then issues it through a transfer', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.inventoryRequest, { requestId: 'SR-261020-07' }))

    expect(screen.getByRole('radio', { name: /approve in full/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Confirm partial approval' }))
    expect(screen.getByText('A decision reason is required for a partial approval or rejection.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/decision reason/i), 'Keep a 200-tablet safety buffer.')
    await user.click(screen.getByRole('button', { name: 'Confirm partial approval' }))
    expect(screen.getByText('Partly approved · open balance')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create transfer from allocation' }))
    expect(router.state.location.pathname).toBe(ROUTES.stockTransfers)
    const tracking = screen.getByRole('heading', { name: /tracking transfer/i })
    expect(tracking).toHaveTextContent('Ready for dispatch')

    await user.click(screen.getAllByRole('button', { name: 'Dispatch stock' })[0])
    expect(screen.getByText(/Dispatched, not received/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Record receipt' }))
    expect(screen.getByRole('heading', { name: /tracking transfer/i })).toHaveTextContent('Received')
  })

  it('rejects a request only with a reason', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.inventoryRequest, { requestId: 'SR-261020-08' }))

    await user.click(screen.getByRole('radio', { name: /reject request/i }))
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(screen.getByText('A decision reason is required for a partial approval or rejection.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/decision reason/i), 'Duplicate of an earlier request.')
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0)
  })
})

describe('receiving', () => {
  it('keeps posting blocked until the short delivery is resolved, then posts the stock', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.inventoryReceipt, { receiptId: 'GRN-261020-03' }))

    expect(screen.getByRole('button', { name: /post accepted stock/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Record supplier response' }))
    expect(screen.getByText('Record the supplier response and why this disposition is appropriate.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/resolution note/i), 'Supplier will send the 20 tablets on the next delivery.')
    await user.click(screen.getByRole('button', { name: 'Record supplier response' }))
    const post = screen.getByRole('button', { name: /post accepted stock/i })
    expect(post).toBeEnabled()
    await user.click(post)
    expect(screen.getByRole('button', { name: 'Posted to stock' })).toBeDisabled()
  })

  it('validates a new receipt and posts a clean one against an open purchase order', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.inventoryReceiveNew)

    await user.click(screen.getByRole('button', { name: 'Post receipt' }))
    expect(screen.getByText('Choose the supplier.')).toBeInTheDocument()
    expect(screen.getByText('Enter the delivery note / challan number.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^supplier/i), 'SUP-0006')
    await user.selectOptions(screen.getByLabelText(/^purchase order/i), 'PO-261019-05')
    await fill(user, screen.getByLabelText(/delivery note/i), 'AP-4410')
    await fill(user, screen.getByLabelText('Received now'), '1000')
    await fill(user, screen.getByLabelText('Batch number 1 for Cetirizine 10mg'), 'CT26D')
    await fill(user, screen.getByLabelText('Expiry date 1 for Cetirizine 10mg'), '2028-12-31')
    await fill(user, screen.getByLabelText('Accepted quantity 1 for Cetirizine 10mg'), '1000')
    await user.click(screen.getByRole('checkbox', { name: /i have verified/i }))
    await user.click(screen.getByRole('button', { name: 'Post receipt' }))

    expect(router.state.location.pathname).toMatch(/\/inventory\/receiving\/GRN-/)
    expect(screen.getByRole('button', { name: 'Posted to stock' })).toBeDisabled()
  })
})

describe('purchase orders', () => {
  it('needs a supplier, a delivery date and an item before it can be created', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.inventoryOrderNew)

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))
    expect(screen.getByText('Select a supplier.')).toBeInTheDocument()
    expect(screen.getByText('Choose the expected delivery date.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one item to the order.')).toBeInTheDocument()

    await user.selectOptions(screen.getAllByLabelText(/^supplier/i)[0], 'SUP-0018')
    await fill(user, screen.getByLabelText(/expected delivery date/i), '2026-10-28')
    await fill(user, screen.getByLabelText('Search by item name or code'), 'Metformin 500mg')
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await fill(user, screen.getByLabelText('Quantity for Metformin 500mg'), '500')
    expect(screen.getAllByText('₹900.00').length).toBeGreaterThan(1)
    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    expect(router.state.location.pathname).toBe('/inventory/purchase-orders/PO-261020-01')
    expect(screen.getByRole('heading', { name: /PO-261020-01/ })).toBeInTheDocument()
    expect(screen.getAllByText('Awaiting delivery').length).toBeGreaterThan(0)
  })
})

describe('transfers', () => {
  it('creates a transfer that reserves stock at the source', async () => {
    const user = setup()
    renderRoute(`${ROUTES.stockTransferNew}?item=MED-00172`)

    await user.click(screen.getByRole('button', { name: 'Create transfer →' }))
    expect(screen.getByText(/Every line needs a whole-number quantity/)).toBeInTheDocument()
    await fill(user, screen.getByLabelText('Quantity for Metformin 500mg'), '100')
    await user.click(screen.getByRole('button', { name: 'Create transfer →' }))

    expect(screen.getByRole('heading', { name: /tracking transfer/i })).toHaveTextContent('Ready for dispatch')
  })

  it('refuses a destination equal to the source', async () => {
    const user = setup()
    renderRoute(ROUTES.stockTransferNew)

    await user.selectOptions(screen.getByLabelText(/destination location/i), 'central')
    await user.click(screen.getByRole('button', { name: 'Create transfer →' }))
    expect(screen.getByText('The destination must differ from the source.')).toBeInTheDocument()
  })
})

describe('adjustments', () => {
  it('will not post more than the free units of a batch', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.inventoryItem, { itemId: 'MED-00124' }))

    await user.click(screen.getByRole('button', { name: 'Record adjustment' }))
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText(/^batch/i), 'BAT-001')
    await fill(user, within(dialog).getByLabelText(/quantity change/i), '-500')
    await user.selectOptions(within(dialog).getByLabelText(/^reason/i), 'Count variance')
    await fill(user, within(dialog).getByLabelText(/evidence reference/i), 'CS-120')
    await user.click(within(dialog).getByRole('button', { name: 'Post adjustment' }))
    expect(within(dialog).getByText(/Only 400 units are free in this batch/)).toBeInTheDocument()

    await fill(user, within(dialog).getByLabelText(/quantity change/i), '-100')
    await user.click(within(dialog).getByRole('button', { name: 'Post adjustment' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('ADJ-261020-04', { exact: false })).toBeInTheDocument()
  })
})

describe('suppliers', () => {
  it('keeps the directory filters in the address and clears them again', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.suppliers)

    await user.selectOptions(screen.getByLabelText('Status'), 'Inactive')
    expect(router.state.location.search).toBe('?status=Inactive')
    const table = screen.getByRole('table')
    expect(within(table).getByText('Unity Life Sciences')).toBeInTheDocument()
    expect(within(table).queryByText('Apex Medical Distributors')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(within(screen.getByRole('table')).getByText('Apex Medical Distributors')).toBeInTheDocument()
  })

  it('rejects a duplicate name and a malformed GSTIN, then saves a new supplier', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.supplierNew)

    await user.click(screen.getByRole('button', { name: 'Save Supplier' }))
    expect(screen.getByText('Enter the supplier name.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/supplier name/i), 'Medline Healthcare')
    await fill(user, screen.getByLabelText(/tax identifier/i), '29AAA')
    await user.click(screen.getByRole('button', { name: 'Save Supplier' }))
    expect(screen.getByText(/already exists/)).toBeInTheDocument()
    expect(screen.getByText(/valid 15-character GSTIN/)).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/supplier name/i), 'Northern Surgicals')
    await fill(user, screen.getByLabelText(/tax identifier/i), '29AABCT1332L1ZV')
    await user.click(screen.getByRole('button', { name: 'Save Supplier' }))
    expect(router.state.location.pathname).toBe('/inventory/suppliers/SUP-0037')
    expect(screen.getByRole('heading', { name: /Northern Surgicals/ })).toBeInTheDocument()
  })

  it('deactivates a supplier only with a reason and then blocks new orders', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.supplierEdit, { supplierId: 'SUP-0006' }))

    await user.click(screen.getByRole('button', { name: 'Deactivate Supplier' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deactivation' }))
    expect(screen.getByText('Give a reason for deactivating this supplier.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/reason for deactivating/i), 'Contract ended.')
    await user.click(screen.getByRole('button', { name: 'Confirm deactivation' }))
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Create Purchase Order' })).toBeDisabled()
  })
})
