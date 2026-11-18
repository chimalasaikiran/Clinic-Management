import { centralId } from './constants'
import { itemById, unitLabel } from './data/items'
import { shortDateTime } from './format'
import { summarise, stockStatus } from './stockLogic'

export const quantityOf = (lines, key) => lines.reduce((sum, line) => sum + (line[key] ?? 0), 0)

// "1,700 tablets" when every line shares a unit, otherwise "3 lines".
export function quantityLabel(lines, key = 'requested') {
  const units = new Set(lines.map((line) => itemById(line.itemId)?.unit))
  const quantity = quantityOf(lines, key)
  if (units.size !== 1) return `${lines.length} lines`
  return `${quantity.toLocaleString('en-IN')} ${unitLabel(itemById(lines[0].itemId), quantity)}`
}

export const itemCountLabel = (count) => `${count} ${count === 1 ? 'item' : 'items'}`

const REQUEST_LABELS = { Submitted: 'Awaiting review', Approved: 'Approved · awaiting issue', 'Partially approved': 'Partly approved · open balance' }
export const requestLabel = (status) => REQUEST_LABELS[status] ?? status

export function orderProgress(order, receipts) {
  const mine = receipts.filter((receipt) => receipt.orderId === order.id)
  return order.lines.map((line) => {
    const rows = mine.flatMap((receipt) => receipt.lines.filter((entry) => entry.itemId === line.itemId).map((entry) => ({ ...entry, posted: receipt.posted })))
    const received = rows.reduce((sum, entry) => sum + entry.received, 0)
    const accepted = rows.reduce((sum, entry) => sum + entry.accepted, 0)
    const rejected = rows.reduce((sum, entry) => sum + entry.rejected, 0)
    const posted = rows.filter((entry) => entry.posted).reduce((sum, entry) => sum + entry.accepted, 0)
    return { ...line, received, accepted, rejected, posted, short: received ? Math.max(0, line.ordered - received) : 0 }
  })
}

export function orderStatus(order, receipts) {
  if (order.draft) return 'Draft'
  if (order.closed) return 'Closed'
  const progress = orderProgress(order, receipts)
  if (progress.every((line) => line.posted >= line.ordered)) return 'Completed'
  return progress.some((line) => line.received > 0) ? 'Part received · open' : 'Awaiting delivery'
}

export const isOpenOrder = (status) => status === 'Part received · open' || status === 'Awaiting delivery'
export const unresolvedOf = (receipt) => receipt.discrepancies.filter((entry) => entry.state === 'Unresolved')

export function receiptState(receipt) {
  if (receipt.status === 'Draft' || receipt.posted) return receipt.status
  return unresolvedOf(receipt).length ? 'Reconciliation required' : 'Ready to post'
}

// Everything that appears under "Needs attention" for one location.
export function attentionCounts(state, loc, today) {
  const items = [...new Set(state.batches.filter((batch) => batch.loc === loc).map((batch) => batch.itemId))].map(itemById)
  const statuses = items.map((item) => stockStatus(summarise(state.batches, item.id, loc, today), loc === centralId() ? item.reorder : item.safety, today))
  const openOrders = state.orders.filter((order) => isOpenOrder(orderStatus(order, state.receipts)))
  const unposted = state.receipts.filter((receipt) => !receipt.posted && receipt.status !== 'Draft')
  const inTransit = state.transfers.filter((transfer) => transfer.status === 'In transit')
  return {
    lowStock: statuses.filter((status) => status === 'Low stock' || status === 'Out of stock').length,
    nearExpiry: statuses.filter((status) => status === 'Near expiry').length,
    pendingOrders: openOrders.length,
    pendingReceipts: unposted.length + inTransit.length,
    receiptDetail: `${unposted.length} supplier · ${inTransit.length} branch transfer`,
    awaitingReview: state.requests.filter((request) => request.status === 'Submitted').length,
    discrepancies: state.receipts.reduce((sum, receipt) => sum + unresolvedOf(receipt).length, 0),
  }
}

export const supplierOf = (state, id) => state.suppliers.find((supplier) => supplier.id === id)

// Open receipts a supplier needs reconciling, shown on the supplier directory and detail.
export const supplierIssues = (state, supplierId) => state.receipts.filter((receipt) => receipt.supplierId === supplierId && unresolvedOf(receipt).length > 0)

export const requestIsOpen = (request) => !['Rejected', 'Cancelled', 'Fulfilled', 'Draft'].includes(request.status)

// Reserved picks of an approved request that have not been put on a transfer yet.
export function unissuedPicks(request, transfers) {
  const moved = new Map()
  transfers.filter((transfer) => transfer.requestId === request.id && transfer.status !== 'Cancelled').forEach((transfer) => {
    transfer.lines.forEach((line) => moved.set(line.batchId, (moved.get(line.batchId) ?? 0) + line.qty))
  })
  return request.lines.flatMap((line) =>
    (line.allocations ?? []).map((pick) => {
      const already = Math.min(pick.qty, moved.get(pick.batchId) ?? 0)
      moved.set(pick.batchId, (moved.get(pick.batchId) ?? 0) - already)
      return { itemId: line.itemId, batchId: pick.batchId, qty: pick.qty - already }
    }),
  ).filter((pick) => pick.qty > 0)
}

export function transferNote(transfer) {
  if (transfer.status === 'In transit') return 'Branch receipt pending'
  if (transfer.status === 'Received') return `${shortDateTime(transfer.received, transfer.receivedTime ?? '00:00')} · ${transfer.lines.reduce((sum, line) => sum + line.received, 0).toLocaleString('en-IN')} accepted`
  if (transfer.status === 'Cancelled') return 'Reservation released'
  return transfer.status === 'Draft' ? 'Not reserved' : 'Reserved at source'
}

