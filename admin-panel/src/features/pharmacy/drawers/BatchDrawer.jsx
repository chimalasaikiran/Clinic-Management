import { Printer } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { daysBetween } from '../../patients/format'
import { locationName, NOW } from '../../inventory/constants'
import { formatDate, qty, shortDateTime } from '../../inventory/format'
import { availableOf, isExpired, nearExpiry, stockStatus, summarise } from '../../inventory/stockLogic'

const signed = (value) => (value > 0 ? `+${qty(value)}` : qty(value))

// Batch registry of one medicine at one pharmacy: availability, FEFO priority and the movement history behind it.
export default function BatchDrawer({ item, loc, batches, movements, receipts, onClose }) {
  const stock = summarise(batches, item.id, loc)
  const status = stockStatus(stock, item.safety)
  const live = stock.rows.filter((batch) => !isExpired(batch) && batch.posted > 0)
  const history = movements.filter((entry) => entry.itemId === item.id && entry.loc === loc)
  const receiptFor = (batch) => receipts.find((receipt) => receipt.lines.some((line) => line.itemId === item.id && line.batches.some((entry) => entry.batchNo === batch.batchNo)))
  const tier = (batch) => (isExpired(batch) ? 'Statutory hold · expired' : `Tier ${live.indexOf(batch) + 1}${live.indexOf(batch) === 0 ? ' · priority dispense' : ''}`)

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Pharmacy dispensary · Inventory traceability · Batch inspection"
      title="Medicine & Batch Details"
      description={`${item.name} · ${item.id} · ${locationName(loc)}`}
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ActionButton onClick={onClose}>← Return (Esc)</ActionButton>
          <div className="flex gap-2">
            <ActionButton to={`${ROUTES.pharmacyRequestNew}?item=${item.id}`}>Request Transfer</ActionButton>
            <ActionButton variant="primary" icon={Printer} onClick={() => window.print()}>Print Batch Labels</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <StatusPill tone={status === 'Available' ? 'success' : status === 'Out of stock' ? 'danger' : 'warning'}>{status}</StatusPill>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Stock segregation &amp; availability</h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Total on-hand', stock.posted], ['Available stock', stock.available, true], ['Reserved / staged', stock.reserved], ['Safety buffer', item.safety]].map(([label, value, highlight]) => (
              <div key={label} className={`rounded-md border p-3 ${highlight ? 'border-brand' : 'border-slate-200'}`}>
                <dt className="text-[10px] tracking-wide text-outline uppercase">{label}</dt>
                <dd className={`mt-1 text-xl font-semibold ${highlight ? 'text-brand' : ''}`}>{qty(value)}</dd>
                <p className="text-[11px] text-outline">{item.unitPlural}</p>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">Batch registry &amp; FEFO priority allocation <span className="text-[10px] font-normal text-outline">First expiry, first out enforced</span></h3>
          <Table headings={['Batch', 'Expiry', 'Available', 'Location', 'Priority']} minWidth={560} empty={stock.rows.length ? null : 'No batches are held at this location.'}>
            {stock.rows.map((batch) => (
              <Row key={batch.id}>
                <Cell className="font-mono text-xs font-semibold">{batch.batchNo}</Cell>
                <Cell className="text-xs">{formatDate(batch.expiry)}<p className="text-outline">{isExpired(batch) ? 'Expired' : `${daysBetween(NOW.date, batch.expiry)} days${nearExpiry(batch) ? ' · near expiry' : ''}`}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{qty(availableOf(batch))}</p><p className="text-outline">of {qty(batch.posted)} posted</p></Cell>
                <Cell className="text-xs">{batch.bin}</Cell>
                <Cell><StatusPill tone={isExpired(batch) ? 'danger' : nearExpiry(batch) ? 'warning' : 'success'}>{tier(batch)}</StatusPill></Cell>
              </Row>
            ))}
          </Table>
        </section>

        <section className="rounded-md border border-slate-200 p-4 text-xs">
          <h3 className="mb-3 text-sm font-semibold">Traceability &amp; safety verification</h3>
          {stock.rows.map((batch) => {
            const receipt = receiptFor(batch)
            return <p key={batch.id} className="mb-1.5"><span className="font-mono font-semibold">{batch.batchNo}</span> · {receipt ? `Inward receipt ${receipt.id}, challan ${receipt.challan}` : 'Inward receipt not recorded in this system'}</p>
          })}
          <p className="mt-2 text-[11px] text-outline">Storage: {item.storage ?? 'Ambient, as per label'}{item.schedule ? ` · ${item.schedule} (prescription only)` : ''}</p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Audit ledger &amp; movement history</h3>
          <ol className="flex flex-col gap-3 text-xs">
            {history.length === 0 && <li className="text-on-surface-variant">No movements have been recorded at this location yet.</li>}
            {history.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3 border-l-2 border-brand pl-3">
                <div><p className="font-semibold">{entry.kind} ({signed(entry.delta)} {item.unitPlural})</p><p className="text-on-surface-variant">{entry.ref} · {entry.reason}</p><p className="text-outline">{entry.actor}</p></div>
                <span className="shrink-0 text-outline">{shortDateTime(entry.date, entry.time)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  )
}
