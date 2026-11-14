import { useState } from 'react'
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { daysBetween } from '../../patients/format'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { FactGrid, NextLink, Pill, Section } from '../components/shared'
import { REF_CLASS, STOCK_TONE } from '../components/tones'
import { locationName, NOW } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import RecordAdjustmentDrawer from '../drawers/RecordAdjustmentDrawer'
import { formatDate, qty, shortDateTime } from '../format'
import { supplierOf, unresolvedOf } from '../selectors'
import { isExpired, nearExpiry, stockStatus, summarise } from '../stockLogic'

const signed = (value) => (value > 0 ? `+${qty(value)}` : qty(value))

// Where a movement's reference leads: receipts, transfers and adjustments each have a screen.
function referenceLink(ref) {
  if (ref.startsWith('GRN-')) return pathFor(ROUTES.inventoryReceipt, { receiptId: ref })
  if (ref.startsWith('TR-')) return `${ROUTES.stockTransfers}?transfer=${ref}`
  return null
}

export default function ItemDetailPage() {
  const { itemId } = useParams()
  const { state, run } = useStock()
  const [adjusting, setAdjusting] = useState(false)
  const item = itemById(itemId)
  if (!item) return <MissingRecord what="item" backTo={ROUTES.inventory} backLabel="Back to inventory" />

  const loc = 'central'
  const stock = summarise(state.batches, item.id, loc)
  const status = stockStatus(stock, item.reorder)
  const incoming = state.receipts.filter((receipt) => !receipt.posted && receipt.status !== 'Draft' && receipt.lines.some((line) => line.itemId === item.id))
  const inTransit = state.transfers.filter((transfer) => transfer.status === 'In transit' && transfer.from === loc).reduce((sum, transfer) => sum + transfer.lines.filter((line) => line.itemId === item.id).reduce((total, line) => total + line.qty, 0), 0)
  const unposted = incoming.reduce((sum, receipt) => sum + receipt.lines.filter((line) => line.itemId === item.id).reduce((total, line) => total + line.received, 0), 0)
  const history = state.movements.filter((entry) => entry.itemId === item.id && entry.loc === loc)
  const suppliers = item.suppliers.map((id) => supplierOf(state, id)).filter(Boolean)

  const download = () => exportCsv(`${item.id}-audit-trail.csv`, [['Date', 'Actor', 'Event', 'Reference', 'Batch', 'Posted change', 'Available after', 'Reason'], ...history.map((entry) => [entry.date, entry.actor, entry.kind, entry.ref, entry.batchLabel, entry.delta, entry.availableAfter, entry.reason])])

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Stock on hand' }, { label: item.id }]}
      title={item.name}
      badge={<Pill tone={STOCK_TONE[status]}>{status}</Pill>}
      subtitle={`${item.id} · ${item.category} · ${item.dose ?? item.unit} · ${locationName(loc)}`}
      actions={
        <>
          <ActionButton icon={ArrowLeftRight} to={`${ROUTES.stockTransferNew}?item=${item.id}`}>Stock Transfer</ActionButton>
          <ActionButton icon={SlidersHorizontal} onClick={() => setAdjusting(true)}>Record adjustment</ActionButton>
        </>
      }
    >
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-outline">
          <span className="font-semibold tracking-wide uppercase">{locationName(loc)} · {item.unitPlural}</span>
          <span>As of {formatDate(NOW.date)} · {NOW.time}</span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[['Accepted & posted', stock.posted], ['Reserved', stock.reserved], ['Quarantine', stock.quarantine], ['Available to allocate', stock.available, true]].map(([label, value, highlight]) => (
            <div key={label}>
              <dt className="text-xs text-outline">{label}</dt>
              <dd className={`mt-1 text-3xl font-semibold ${highlight ? 'text-brand' : 'text-on-surface'}`}>{qty(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-outline">
          {locationName(loc)} only. {inTransit ? `${qty(inTransit)} ${item.unitPlural} in transit to a branch` : 'Nothing in transit'}{unposted ? ` and ${qty(unposted)} ${item.unitPlural} in an unposted supplier receipt` : ''} are excluded. Branch stock is not combined with central availability.
        </p>
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Section title="Stock policy">
          <FactGrid columns={3} facts={[['Reorder threshold', `${qty(item.reorder)} ${item.unitPlural}`], ['Target stock', `${qty(item.target)} ${item.unitPlural}`], ['Issue strategy', 'First expiry, first out']]} />
          <p className="mt-4 text-[11px] text-outline">Base unit: {item.unit} · Pack size: {item.pack ?? `1 ${item.unit}`} · {item.storage ?? 'Ambient storage'}</p>
        </Section>
        <Section title="Suppliers" aside={`${suppliers.length} approved`}>
          <ul className="flex flex-col gap-3">
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold">{supplier.name}</p>
                  <p className="text-[11px] text-outline">{supplier.id}{supplier.id === item.preferred ? ' · Preferred' : ''}</p>
                </div>
                <NextLink to={pathFor(ROUTES.supplier, { supplierId: supplier.id })}>View supplier</NextLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Batches &amp; expiry</h2>
          <span className="text-[11px] text-outline">{stock.rows.length} posted batches · nearest expiry first</span>
        </header>
        <Table headings={['Batch / Location', 'Expiry', 'Posted', 'Reserved', 'Quarantine', 'Available', 'Status']} minWidth={820}>
          {stock.rows.map((batch) => {
            const expired = isExpired(batch)
            const near = nearExpiry(batch)
            return (
              <Row key={batch.id}>
                <Cell><p className="font-mono font-semibold">{batch.batchNo}</p><p className="text-[11px] text-outline">{locationName(batch.loc)} · {batch.bin}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{formatDate(batch.expiry)}</p><p className="text-outline">{expired ? 'Expired' : `${daysBetween(NOW.date, batch.expiry)} days remaining`}</p></Cell>
                <Cell>{qty(batch.posted)}</Cell>
                <Cell>{qty(batch.reserved)}</Cell>
                <Cell>{qty(batch.quarantine)}</Cell>
                <Cell className="font-semibold text-brand">{qty(expired ? 0 : Math.max(0, batch.posted - batch.reserved - batch.quarantine))}</Cell>
                <Cell><Pill tone={expired ? 'danger' : near ? 'warning' : 'success'}>{expired ? 'Expired' : near ? 'Near expiry' : 'Available'}</Pill></Cell>
              </Row>
            )
          })}
        </Table>
        {incoming.map((receipt) => (
          <p key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-xs text-on-surface-variant">
            <span>
              Incoming batch {receipt.lines.find((line) => line.itemId === item.id).batches.map((entry) => entry.batchNo).join(' / ')} · {qty(receipt.lines.find((line) => line.itemId === item.id).received)} received · {qty(receipt.lines.find((line) => line.itemId === item.id).accepted)} accepted{unresolvedOf(receipt).length ? ' pending reconciliation' : ''} · not posted
            </span>
            <Link to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })} className={REF_CLASS}>{receipt.id} ↗</Link>
          </p>
        ))}
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Movement &amp; audit history</h2>
          <button type="button" onClick={download} className="text-xs font-semibold text-brand hover:underline">Export audit trail ↓</button>
        </header>
        <Table headings={['Date / Actor', 'Event / Reference', 'Batch', 'Posted Δ', 'Available after', 'Reason / Trace']} minWidth={900} empty={history.length ? null : 'No movements are recorded for this item yet.'}>
          {history.map((entry) => {
            const link = referenceLink(entry.ref)
            return (
              <Row key={entry.id}>
                <Cell className="text-xs"><p className="font-semibold">{shortDateTime(entry.date, entry.time)}</p><p className="text-outline">{entry.actor}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{entry.kind}</p>{link ? <Link to={link} className={REF_CLASS}>{entry.ref} ↗</Link> : <p className="text-outline">{entry.ref}</p>}</Cell>
                <Cell className="font-mono text-xs">{entry.batchLabel}</Cell>
                <Cell>{signed(entry.delta)}</Cell>
                <Cell>{qty(entry.availableAfter)}</Cell>
                <Cell className="max-w-72 text-xs text-on-surface-variant">{entry.reason}</Cell>
              </Row>
            )
          })}
        </Table>
      </section>

      <InfoNote tone="brand">
        <p className="text-sm font-semibold text-on-surface">Every stock change retains its source.</p>
        <p className="mt-1">Transfers link issue, dispatch and destination receipt. Adjustments retain reason, evidence, approver and timestamp; corrections create a new audit entry, never overwrite the original.</p>
      </InfoNote>

      <RecordAdjustmentDrawer key={String(adjusting)} open={adjusting} onClose={() => setAdjusting(false)} batches={state.batches.filter((batch) => batch.loc === loc)} initial={{ itemId: item.id }} onSave={(payload) => run('adjustment/save', payload)} />
    </DetailFrame>
  )
}
