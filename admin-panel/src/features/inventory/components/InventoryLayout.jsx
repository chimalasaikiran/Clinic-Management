import { ArrowLeftRight, Building2, Package, Plus, Settings } from 'lucide-react'
import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { centralId, locationName, LOCATIONS, NOW } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, formatTime } from '../format'
import { attentionCounts, isOpenOrder, orderStatus, quantityLabel, requestLabel, supplierOf, unresolvedOf } from '../selectors'
import { NextLink, Pill } from './shared'
import { ORDER_TONE, RECEIPT_TONE, REF_CLASS, TRANSFER_TONE } from './tones'

const TABS = [
  { to: ROUTES.inventory, label: 'Stock on hand', end: true },
  { to: ROUTES.inventoryRequests, label: 'Stock Requests' },
  { to: ROUTES.inventoryOrders, label: 'Purchase Orders' },
  { to: ROUTES.inventoryReceiving, label: 'Receiving / GRNs' },
  { to: ROUTES.inventoryTransfers, label: 'Transfers' },
  { to: ROUTES.inventoryAdjustments, label: 'Adjustments' },
]

function Attention({ counts }) {
  const cells = [
    { value: counts.lowStock, label: 'Low stock', hint: 'Below reorder threshold', to: `${ROUTES.inventory}?status=Low+stock` },
    { value: counts.nearExpiry, label: 'Near expiry', hint: 'Within the next 90 days', to: `${ROUTES.inventory}?status=Near+expiry` },
    { value: counts.pendingOrders, label: 'Pending purchase orders', hint: 'Ordered · not available stock', to: ROUTES.inventoryOrders },
    { value: counts.pendingReceipts, label: 'Pending receipts', hint: counts.receiptDetail, to: ROUTES.inventoryReceiving },
    { value: counts.awaitingReview, label: 'Stock requests awaiting review', hint: 'Submitted by pharmacies', to: ROUTES.inventoryRequests },
    { value: counts.discrepancies, label: 'Unresolved discrepancy', hint: 'Supplier receipt · posting blocked', to: ROUTES.inventoryReceiving },
  ]
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-on-surface">Needs attention</h2>
        <span className="text-xs text-outline">Central Stores · including outbound branch receipts</span>
      </div>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.label} className="flex items-start gap-3">
            <span className="text-2xl leading-7 font-semibold text-brand">{cell.value}</span>
            <div>
              <NextLink to={cell.to}>{cell.label}</NextLink>
              <p className="text-[11px] text-outline">{cell.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// The open work across the inventory queues, one row per queue.
function Queues({ state }) {
  const request = state.requests.find((row) => row.status === 'Submitted')
  const order = state.orders.find((row) => isOpenOrder(orderStatus(row, state.receipts)))
  const receipt = state.receipts.find((row) => !row.posted && row.status !== 'Draft')
  const transfer = state.transfers.find((row) => row.status === 'In transit')
  const supplier = (id) => supplierOf(state, id)?.name

  const rows = [
    request && { ref: request.id, queue: `Stock Requests · ${locationName(request.pharmacy)} · ${request.lines.length} items`, status: <Pill tone="warning">{requestLabel(request.status)}</Pill>, next: <NextLink to={pathFor(ROUTES.inventoryRequest, { requestId: request.id })}>Review request</NextLink> },
    order && { ref: order.id, queue: `Purchase Orders · ${supplier(order.supplierId)} · ${quantityLabel(order.lines.map((line) => ({ ...line, requested: line.ordered })))}`, status: <Pill tone={ORDER_TONE[orderStatus(order, state.receipts)]}>{orderStatus(order, state.receipts)}</Pill>, next: <NextLink to={pathFor(ROUTES.inventoryOrder, { orderId: order.id })}>View purchase order</NextLink> },
    receipt && { ref: receipt.id, queue: `Receiving / GRNs · Supplier receipt${unresolvedOf(receipt).length ? ` · shortage of ${unresolvedOf(receipt)[0].qty}` : ''}`, status: <Pill tone={RECEIPT_TONE[receipt.status]}>{receipt.status}</Pill>, next: <NextLink to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })}>Resolve discrepancy</NextLink> },
    transfer && { ref: transfer.id, queue: `Transfers · ${locationName(transfer.from)} → ${locationName(transfer.to)} · ${transfer.lines.reduce((sum, line) => sum + line.qty, 0)} ${itemById(transfer.lines[0].itemId).unitPlural}`, status: <Pill tone={TRANSFER_TONE[transfer.status]}>Dispatched · not received</Pill>, next: <NextLink to={`${ROUTES.stockTransfers}?transfer=${transfer.id}`}>Track branch receipt</NextLink> },
  ].filter(Boolean)

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-on-surface">Next in your queues</h2>
        <span className="text-[11px] text-outline">Selected open work · across inventory queues</span>
      </header>
      <Table headings={['Reference', 'Queue / context', 'Status', 'Next step']} minWidth={760} empty={rows.length ? null : 'No open work in the inventory queues.'}>
        {rows.map((row) => (
          <Row key={row.ref}>
            <Cell className="font-semibold">{row.ref}</Cell>
            <Cell className="text-xs">{row.queue}</Cell>
            <Cell>{row.status}</Cell>
            <Cell>{row.next}</Cell>
          </Row>
        ))}
      </Table>
    </section>
  )
}

// Frame of the inventory workspace: header actions, store switch, attention strip and the tab bar around the tab pages.
export default function InventoryLayout() {
  const { state } = useStock()
  const [params, setParams] = useSearchParams()
  const loc = params.get('store') ?? centralId()
  const counts = attentionCounts(state, loc, NOW.date)

  const changeStore = (event) => {
    const next = new URLSearchParams(params)
    if (event.target.value === centralId()) next.delete('store')
    else next.set('store', event.target.value)
    setParams(next, { replace: true })
  }

  return (
    <WorkspacePage>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-9 font-bold tracking-tight text-on-surface">Inventory</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Stock, purchasing and movement across Central Stores and your pharmacy branches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton variant="brand" icon={Plus} to={ROUTES.inventoryOrderNew}>Create Purchase Order</ActionButton>
          <ActionButton icon={Package} to={ROUTES.inventoryReceiveNew}>Receive Stock</ActionButton>
          <ActionButton icon={ArrowLeftRight} to={ROUTES.stockTransfers}>Stock Transfer</ActionButton>
          <ActionButton icon={Settings} to={ROUTES.inventorySetup}>Setup</ActionButton>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
          <Building2 className="size-4 text-outline" aria-hidden="true" />
          <span>Store / branch:</span>
          <select aria-label="Store / branch" value={loc} onChange={changeStore} className="bg-transparent font-medium outline-none">
            {LOCATIONS.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-outline">
          <Link to={ROUTES.suppliers} className={REF_CLASS}>Suppliers</Link> · {formatDate(NOW.date)} · {formatTime(NOW.time)} / All quantities in base units
        </p>
      </div>

      <Attention counts={counts} />

      <nav aria-label="Inventory sections" className="mb-5 flex flex-wrap gap-x-7 border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => cn('-mb-px border-b-2 py-3 text-[13px] font-medium', isActive ? 'border-brand font-semibold text-brand' : 'border-transparent text-on-surface-variant hover:text-on-surface')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ loc }} />
      <Queues state={state} />
    </WorkspacePage>
  )
}
