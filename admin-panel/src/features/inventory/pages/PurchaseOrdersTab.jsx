import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { InfoNote } from '../../../components/workspace/controls'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { ListCard, ListFooter, NextLink, Pill, Toolbar } from '../components/shared'
import { ORDER_TONE, REF_CLASS } from '../components/tones'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, qty, shortDate } from '../format'
import { isOpenOrder, orderProgress, orderStatus, quantityLabel, supplierOf, unresolvedOf } from '../selectors'

export default function PurchaseOrdersTab() {
  const { state } = useStock()
  const [query, setQuery] = useState('')
  const [supplier, setSupplier] = useState('')
  const [status, setStatus] = useState('')

  const all = state.orders.map((order) => ({ order, progress: orderProgress(order, state.receipts), status: orderStatus(order, state.receipts), supplier: supplierOf(state, order.supplierId) }))
  const needle = query.trim().toLowerCase()
  const rows = all.filter(
    (row) =>
      (!supplier || row.supplier.name === supplier) &&
      (!status || row.status === status) &&
      (!needle || `${row.order.id} ${row.supplier.name} ${row.order.lines.map((line) => itemById(line.itemId).name).join(' ')}`.toLowerCase().includes(needle)),
  )
  const pending = all.filter((row) => isOpenOrder(row.status))
  const blocked = all.find((row) => state.receipts.some((receipt) => receipt.orderId === row.order.id && unresolvedOf(receipt).length))
  const blockedReceipt = blocked && state.receipts.find((receipt) => receipt.orderId === blocked.order.id && unresolvedOf(receipt).length)

  const download = () => exportCsv('purchase-orders.csv', [['Purchase order', 'Supplier', 'Ordered', 'Status'], ...rows.map((row) => [row.order.id, row.supplier.name, quantityLabel(row.order.lines, 'ordered'), row.status])])

  return (
    <>
      <ListCard title="Purchase Orders" count={`${pending.length} pending`} onExport={download}>
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search PO, supplier or item"
          filters={[
            { label: 'Supplier', value: supplier, onChange: setSupplier, all: 'All suppliers', options: [...new Set(all.map((row) => row.supplier.name))] },
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: [...new Set(all.map((row) => row.status))] },
          ]}
        />
        <Table headings={['Purchase order / Date', 'Supplier / Order', 'Ordered', 'Received / Posted', 'Status', 'Next step']} minWidth={900} empty={rows.length ? null : 'No purchase orders match the current filters.'}>
          {rows.map(({ order, progress, status: label, supplier: owner }) => {
            const received = progress.reduce((sum, line) => sum + line.received, 0)
            const posted = progress.reduce((sum, line) => sum + line.posted, 0)
            const accepted = progress.reduce((sum, line) => sum + line.accepted, 0)
            const rejected = progress.reduce((sum, line) => sum + line.rejected, 0)
            const short = progress.reduce((sum, line) => sum + line.short, 0)
            const receipt = state.receipts.find((entry) => entry.orderId === order.id)
            return (
              <Row key={order.id}>
                <Cell><Link to={pathFor(ROUTES.inventoryOrder, { orderId: order.id })} className={REF_CLASS}>{order.id}</Link><p className="text-[11px] text-outline">{shortDate(order.date)} {order.date.slice(0, 4)}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{owner.name}</p><p className="text-outline">{owner.code || owner.id} · {order.lines.map((line) => itemById(line.itemId).name).join(', ')}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{quantityLabel(order.lines, 'ordered')}</p><p className="text-outline">{order.lines.length} {order.lines.length === 1 ? 'item' : 'items'}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{qty(received)} received</p><p className="text-outline">{qty(posted)} posted{accepted ? ` · ${qty(accepted)} accepted` : ''}</p></Cell>
                <Cell>
                  <Pill tone={ORDER_TONE[label]}>{label}</Pill>
                  <p className="mt-1 text-[11px] text-outline">{label === 'Awaiting delivery' ? `Expected ${formatDate(order.expected)}` : label === 'Completed' ? `${receipt?.id ?? ''}` : short || rejected ? `${short} short · ${rejected} rejected` : ''}</p>
                </Cell>
                <Cell><NextLink to={pathFor(ROUTES.inventoryOrder, { orderId: order.id })}>{label === 'Completed' ? 'View receipt' : 'View purchase order'}</NextLink></Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="purchase orders">{' · Central Stores'}</ListFooter>
      </ListCard>
      <p className="mt-4 text-[11px] text-outline">Ordered quantities are not available stock. Received, accepted and posted quantities are tracked separately; open balances require an explicit, approved disposition.</p>
      {blocked && (
        <InfoNote tone="brand" className="mt-4">
          <p className="text-sm font-semibold text-on-surface">{blocked.order.id} remains open · linked receipt requires reconciliation</p>
          <p className="mt-1">
            {blockedReceipt.id}: {blockedReceipt.lines[0].received} physically received = {blockedReceipt.lines[0].accepted} accepted pending posting + {blockedReceipt.lines[0].rejected} rejected. The {unresolvedOf(blockedReceipt)[0].qty}-tablet short delivery remains unresolved; supplier confirmation and manager approval are pending. No accepted units have been posted.{' '}
            <Link to={pathFor(ROUTES.inventoryReceipt, { receiptId: blockedReceipt.id })} className={REF_CLASS}>Review receipt</Link>
          </p>
        </InfoNote>
      )}
    </>
  )
}
