import { Package, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { pathFor, ROUTES } from '../../../config/routes'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { FactGrid, Pill, Section } from '../components/shared'
import { ORDER_TONE, RECEIPT_TONE, REF_CLASS } from '../components/tones'
import { locationName } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, money, qty } from '../format'
import { itemCountLabel, orderProgress, orderStatus, receiptState, supplierOf, unresolvedOf } from '../selectors'

export default function PurchaseOrderPage() {
  const { orderId } = useParams()
  const { state } = useStock()
  const order = state.orders.find((row) => row.id === orderId)
  if (!order) return <MissingRecord what="purchase order" backTo={ROUTES.inventoryOrders} backLabel="Back to purchase orders" />

  const supplier = supplierOf(state, order.supplierId)
  const progress = orderProgress(order, state.receipts)
  const status = orderStatus(order, state.receipts)
  const receipts = state.receipts.filter((receipt) => receipt.orderId === order.id)
  const open = receipts.find((receipt) => !receipt.posted)
  const sum = (key) => progress.reduce((total, line) => total + line[key], 0)
  const unit = itemById(order.lines[0].itemId).unitPlural
  const value = order.lines.reduce((total, line) => total + line.ordered * line.rate, 0)
  const unresolved = receipts.flatMap(unresolvedOf)
  const blocked = unresolved.length > 0

  return (
    <DetailFrame
      crumbs={[{ label: 'Purchase Orders', to: ROUTES.inventoryOrders }, { label: 'View purchase order' }]}
      title={order.id}
      badge={<Pill tone={ORDER_TONE[status]}>{status}</Pill>}
      subtitle={`${supplier.name} · ${formatDate(order.date)} · ${locationName(order.store)}`}
      actions={
        <>
          <ActionButton icon={Printer} onClick={() => window.print()}>Print PO</ActionButton>
          {open ? (
            <ActionButton variant="brand" icon={Package} to={pathFor(ROUTES.inventoryReceipt, { receiptId: open.id })}>Review receipt</ActionButton>
          ) : (
            status !== 'Completed' && status !== 'Closed' && !order.draft && <ActionButton variant="brand" icon={Package} to={`${ROUTES.inventoryReceiveNew}?order=${order.id}`}>Receive stock</ActionButton>
          )}
        </>
      }
    >
      <section className="mb-5 grid overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-[1fr_2fr]">
        <div className="border-b border-slate-200 p-5 lg:border-r lg:border-b-0">
          <h2 className="mb-3 text-sm font-semibold">Supplier</h2>
          <Link to={pathFor(ROUTES.supplier, { supplierId: supplier.id })} className="text-lg font-semibold text-on-surface hover:underline">{supplier.name}</Link>
          <p className="text-xs text-outline">{supplier.id}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-outline">Contact</p><p className="font-medium">{supplier.contact || '—'}</p></div>
            <div><p className="text-outline">Email</p><p className="font-medium">{supplier.email || '—'}</p></div>
          </div>
        </div>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Order information</h2>
          <FactGrid facts={[['Order date', formatDate(order.date)], ['Store / branch', locationName(order.store)], ['Expected delivery', order.expected ? formatDate(order.expected) : '—'], ['Items', `${itemCountLabel(order.lines.length)} · ${unit}`], ['Created by', order.createdBy || '—'], ['Order value', value ? money(value) : '—']]} />
        </div>
      </section>

      <Section title="Order items" aside={`All quantities in base units · ${unit}`} className="mb-5">
        <Table headings={['Item / Unit', 'Ordered', 'Received', 'Accepted', 'Rejected', 'Short', 'Posted']} minWidth={760}>
          {progress.map((line) => (
            <Row key={line.itemId}>
              <Cell><Link to={pathFor(ROUTES.inventoryItem, { itemId: line.itemId })} className="font-semibold text-on-surface hover:underline">{itemById(line.itemId).name}</Link><p className="text-[11px] text-outline">{itemById(line.itemId).unitPlural}</p></Cell>
              <Cell className="font-semibold">{qty(line.ordered)}</Cell>
              <Cell className="font-semibold">{qty(line.received)}</Cell>
              <Cell className="font-semibold">{qty(line.accepted)}</Cell>
              <Cell className="font-semibold">{qty(line.rejected)}</Cell>
              <Cell className="font-semibold">{qty(line.short)}</Cell>
              <Cell className="font-semibold">{qty(line.posted)}</Cell>
            </Row>
          ))}
        </Table>
        <p className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-outline">
          <span>{qty(sum('received'))} received = {qty(sum('accepted'))} accepted + {qty(sum('rejected'))} rejected</span>
          <span>{qty(sum('ordered') || order.lines.reduce((total, line) => total + line.ordered, 0))} ordered − {qty(sum('received'))} received = {qty(sum('short'))} short</span>
        </p>
      </Section>

      {(status === 'Part received · open' || blocked) && (
        <InfoNote tone="brand" className="mb-5">
          <p className="text-sm font-semibold text-on-surface">Purchase order remains open · receipt requires reconciliation</p>
          <p className="mt-1">{qty(sum('short'))} {unit} short · {qty(sum('rejected'))} {unit} rejected. Supplier confirmation and manager approval are pending. {sum('posted') ? `${qty(sum('posted'))} accepted units have been posted.` : 'No accepted units have been posted.'}</p>
        </InfoNote>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Section title="Receiving" aside={`${receipts.length} linked receipt${receipts.length === 1 ? '' : 's'}`}>
          {receipts.length === 0 && <p className="text-sm text-on-surface-variant">Nothing has been received against this order yet.</p>}
          {receipts.map((receipt) => (
            <div key={receipt.id} className="mb-4 last:mb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })} className={REF_CLASS}>{receipt.id} ↗</Link>
                  <p className="text-xs text-outline">Supplier receipt · {locationName(receipt.store)}</p>
                </div>
                <Pill tone={RECEIPT_TONE[receiptState(receipt)]}>{receiptState(receipt)}</Pill>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 rounded-md bg-surface-lowest p-3 text-xs">
                {[['Physically received', receipt.lines.reduce((total, line) => total + line.received, 0)], ['Accepted', receipt.lines.reduce((total, line) => total + line.accepted, 0)], ['Rejected', receipt.lines.reduce((total, line) => total + line.rejected, 0)]].map(([label, value]) => (
                  <div key={label}><dt className="text-outline">{label}</dt><dd className="text-xl font-semibold">{qty(value)}</dd></div>
                ))}
              </dl>
              {unresolvedOf(receipt)[0] && <p className="mt-2 flex justify-between text-xs"><span>Short delivery: {unresolvedOf(receipt)[0].qty} {unit} · unresolved</span><Link to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })} className={REF_CLASS}>Review receipt ↗</Link></p>}
            </div>
          ))}
        </Section>
        <Section title="Stock posting" aside={<Pill tone={blocked ? 'danger' : sum('posted') ? 'success' : 'neutral'}>{blocked ? 'Blocked' : sum('posted') ? 'Posted' : 'Not started'}</Pill>}>
          <dl className="flex flex-col gap-2.5 text-sm">
            {[['Accepted quantity', sum('accepted')], ['Posted to stock', sum('posted')], ['Accepted pending posting', Math.max(0, sum('accepted') - sum('posted'))]].map(([label, value]) => (
              <div key={label} className="flex justify-between"><dt className="text-on-surface-variant">{label}</dt><dd className="font-semibold">{qty(value)} {unit}</dd></div>
            ))}
          </dl>
          {blocked && <p className="mt-3 text-[11px] text-outline">Posting is blocked while the linked receipt requires reconciliation.</p>}
        </Section>
      </div>
      <p className="mt-4 text-[11px] text-outline">Ordered quantities are not available stock. Received, accepted and posted quantities are tracked separately; open balances require an explicit, approved disposition.</p>
    </DetailFrame>
  )
}
