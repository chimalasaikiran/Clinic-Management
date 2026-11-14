import { useState } from 'react'
import { ArrowRight, Building2, Plus, Printer } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { InfoNote } from '../../../components/workspace/controls'
import { ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import DetailFrame from '../components/DetailFrame'
import { ListCard, ListFooter, Pill, Toolbar } from '../components/shared'
import { REF_CLASS, TRANSFER_TONE } from '../components/tones'
import { LOCATIONS, locationName, NOW } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, qty, shortDateTime } from '../format'
import { transferNote } from '../selectors'

const NEXT = { 'In transit': 'Track receipt', 'Ready for dispatch': 'Dispatch', Draft: 'Edit draft', Received: 'View receipt', Cancelled: 'View history' }
const TILES = [
  ['Draft', 'Complete and submit'],
  ['Ready for dispatch', 'Approved · awaiting handover'],
  ['In transit', 'Dispatched · receipt pending'],
  ['Received', 'Receipt posted to destination'],
]

function TrackingPanel({ transfer, onDispatch, onReceive, onCancel }) {
  const [received, setReceived] = useState(() => Object.fromEntries(transfer.lines.map((line, index) => [index, String(line.qty)])))
  const [error, setError] = useState('')
  const total = transfer.lines.reduce((sum, line) => sum + line.qty, 0)

  const post = () => {
    const parsed = transfer.lines.map((line, index) => Number(received[index]))
    if (parsed.some((value, index) => !Number.isInteger(value) || value < 0 || value > transfer.lines[index].qty)) return setError('Received quantities must be whole numbers no greater than what was dispatched.')
    setError('')
    onReceive(Object.fromEntries(parsed.map((value, index) => [index, value])))
  }

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-3 text-lg font-semibold">Tracking transfer <span className="font-mono text-xs font-normal text-outline">{transfer.id}</span><Pill tone={TRANSFER_TONE[transfer.status]}>{transfer.status}</Pill></h2>
        <div className="flex items-center gap-2">
          {transfer.status === 'Ready for dispatch' && <ActionButton variant="brand" onClick={onDispatch}>Dispatch stock</ActionButton>}
          {transfer.status === 'Draft' && <ActionButton variant="brand" to={`${ROUTES.stockTransferNew}?draft=${transfer.id}`}>Edit draft</ActionButton>}
          {['Draft', 'Ready for dispatch'].includes(transfer.status) && <ActionButton onClick={onCancel}>Cancel transfer</ActionButton>}
        </div>
      </header>
      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        <div className="p-5">
          <div className="mb-4 flex items-center gap-6 text-sm">
            <div><p className="text-[10px] tracking-wide text-outline uppercase">From</p><p className="font-semibold">{locationName(transfer.from)}</p></div>
            <ArrowRight className="size-4 text-brand" aria-hidden="true" />
            <div><p className="text-[10px] tracking-wide text-outline uppercase">To</p><p className="font-semibold">{locationName(transfer.to)}</p></div>
          </div>
          {transfer.lines.map((line, index) => {
            const item = itemById(line.itemId)
            return (
              <div key={`${line.batchId}-${index}`} className="mb-4 flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                <div><p className="font-semibold">{item.name}</p><p className="text-[11px] text-outline">{item.id} · {item.unitPlural}</p><p className="mt-2 text-[11px] text-outline">Batch <span className="font-mono font-semibold text-on-surface">{line.batchNo}</span> · Expiry {formatDate(line.expiry)}</p></div>
                <div className="text-right">
                  <p className="text-xl font-semibold">{qty(line.qty)} {item.unitPlural}</p>
                  <p className="text-[11px] text-outline">Received {qty(line.received)} {item.unitPlural}</p>
                  {transfer.status === 'In transit' && (
                    <label className="mt-2 flex items-center justify-end gap-2 text-xs">
                      <span>Received now</span>
                      <input type="number" min="0" max={line.qty} aria-label={`Received quantity for ${item.name}`} value={received[index]} onChange={(event) => setReceived((current) => ({ ...current, [index]: event.target.value }))} className="w-24 rounded border border-slate-200 px-2 py-1 text-[13px] outline-none focus:border-brand" />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
            <span>{transfer.lines.length} item · {transfer.lines.length} batch · {transfer.status === 'In transit' ? 'Full quantity awaiting receipt' : transferNote(transfer)}</span>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Printer className="size-3.5" aria-hidden="true" />Dispatch note</button>
          </div>
          {transfer.status === 'In transit' && (
            <div className="mt-4">
              <ActionButton variant="brand" onClick={post}>Record receipt</ActionButton>
              {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
              <p className="mt-2 text-[11px] text-outline">A shortage stays on the transfer as a traceable exception; only the received quantity is posted at {locationName(transfer.to)}.</p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-5 lg:border-t-0 lg:border-l">
          <h3 className="mb-3 text-sm font-semibold">Movement history</h3>
          <ol className="flex flex-col gap-3 text-xs">
            {transfer.history.map((entry, index) => (
              <li key={`${entry.time}-${index}`} className="flex justify-between gap-3">
                <div><p className="font-semibold">{entry.text}</p><p className="text-outline">{entry.by}</p></div>
                <span className="shrink-0 text-outline">{shortDateTime(entry.date, entry.time)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {transfer.status === 'In transit' && <p className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900">Dispatched, not received. These {qty(total)} {itemById(transfer.lines[0].itemId).unitPlural} are in transit and are not available at {locationName(transfer.to)}. Only accepted, posted receipt quantities become available at the destination.</p>}
    </section>
  )
}

export default function StockTransfersPage() {
  const { state, run } = useStock()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [scope, setScope] = useState('')
  const all = state.transfers.filter((transfer) => !scope || transfer.from === scope || transfer.to === scope)
  const needle = query.trim().toLowerCase()
  const rows = all.filter((transfer) => (!status || transfer.status === status) && (!from || locationName(transfer.from) === from) && (!to || locationName(transfer.to) === to) && (!needle || `${transfer.id} ${transfer.lines.map((line) => `${itemById(line.itemId).name} ${line.batchNo}`).join(' ')}`.toLowerCase().includes(needle)))
  const selectedId = params.get('transfer')
  const selected = all.find((transfer) => transfer.id === selectedId) ?? all.find((transfer) => transfer.status === 'In transit') ?? all[0]
  const select = (id) => setParams({ transfer: id }, { replace: true })
  const names = LOCATIONS.map((location) => location.name)

  const download = () => exportCsv('stock-transfers.csv', [['Transfer', 'From', 'To', 'Items', 'Status'], ...rows.map((transfer) => [transfer.id, locationName(transfer.from), locationName(transfer.to), transfer.lines.length, transfer.status])])

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Stock transfers' }]}
      title="Stock transfers"
      subtitle="Manage stock movement between Central Stores, Main Pharmacy and OPD Pharmacy."
      actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.stockTransferNew}>New transfer</ActionButton>}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
          <Building2 className="size-4 text-outline" aria-hidden="true" />
          <span>Store / branch:</span>
          <select aria-label="Store / branch" value={scope} onChange={(event) => setScope(event.target.value)} className="bg-transparent font-medium outline-none">
            <option value="">All locations</option>
            {LOCATIONS.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <p className="text-[11px] text-outline">{formatDate(NOW.date)} · Quantities shown with units</p>
      </div>

      <dl className="mb-5 grid overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map(([label, hint]) => (
          <div key={label} className="border-b border-slate-100 p-5 lg:border-r lg:border-b-0 last:border-0">
            <dt className="text-xs font-semibold">{label}</dt>
            <dd className="mt-2 text-3xl font-semibold text-brand">{all.filter((transfer) => transfer.status === label).length}</dd>
            <p className="text-[11px] text-outline">{hint}</p>
          </div>
        ))}
      </dl>

      <ListCard title="All transfers" count={`${all.length} transfers`} onExport={download}>
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search transfer, item or batch"
          filters={[
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: ['Draft', 'Ready for dispatch', 'In transit', 'Received', 'Cancelled'] },
            { label: 'From', value: from, onChange: setFrom, all: 'From: Any location', options: names },
            { label: 'To', value: to, onChange: setTo, all: 'To: Any location', options: names },
          ]}
        />
        <Table headings={['Transfer / Created', 'Source → Destination', 'Item / Batch / Quantity', 'Status', 'Dispatch / Receipt', 'Next action']} minWidth={940} empty={rows.length ? null : 'No transfers match the current filters.'}>
          {rows.map((transfer) => {
            const line = transfer.lines[0]
            const item = itemById(line.itemId)
            return (
              <Row key={transfer.id} muted={transfer.status === 'Cancelled'}>
                <Cell><button type="button" onClick={() => select(transfer.id)} className={REF_CLASS}>{transfer.id}</button><p className="text-[11px] text-outline">Created {formatDate(transfer.created)}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{locationName(transfer.from)}</p><p className="text-outline">→ {locationName(transfer.to)}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{item.name}{transfer.lines.length > 1 ? ` +${transfer.lines.length - 1}` : ''}</p><p className="text-outline">{item.id} · Batch {line.batchNo}</p><p className="font-semibold">{qty(transfer.lines.reduce((sum, entry) => sum + entry.qty, 0))} {item.unitPlural}</p></Cell>
                <Cell><Pill tone={TRANSFER_TONE[transfer.status]}>{transfer.status}</Pill></Cell>
                <Cell className="text-xs"><p>{transfer.dispatched ? shortDateTime(transfer.dispatched, transfer.dispatchedTime) : 'Not dispatched'}</p><p className={transfer.status === 'In transit' ? 'text-amber-700' : 'text-outline'}>{transfer.received ? shortDateTime(transfer.received, transfer.receivedTime ?? '00:00') : transfer.status === 'In transit' ? 'Receipt pending' : 'Not received'}</p></Cell>
                <Cell>
                  {transfer.status === 'Draft' ? (
                    <Link to={`${ROUTES.stockTransferNew}?draft=${transfer.id}`} className="text-xs font-semibold text-brand hover:underline">Edit draft ↗</Link>
                  ) : transfer.status === 'Ready for dispatch' ? (
                    <button type="button" onClick={() => run('transfer/dispatch', { id: transfer.id })} className="text-xs font-semibold text-brand hover:underline">Dispatch ↗</button>
                  ) : (
                    <button type="button" onClick={() => select(transfer.id)} className="text-xs font-semibold text-brand hover:underline">{NEXT[transfer.status]} ⌄</button>
                  )}
                </Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="transfers">{` · ${scope ? locationName(scope) : 'All locations'}`}</ListFooter>
      </ListCard>

      {selected && (
        <TrackingPanel
          key={`${selected.id}-${selected.status}`}
          transfer={selected}
          onDispatch={() => run('transfer/dispatch', { id: selected.id })}
          onReceive={(received) => run('transfer/receive', { id: selected.id, received })}
          onCancel={() => run('transfer/cancel', { id: selected.id })}
        />
      )}

      <InfoNote tone="neutral" className="mt-5">Stock impact: drafts do not change stock. Ready transfers reserve source stock. Dispatch deducts source on-hand stock and moves it to in transit. Receipt posts accepted stock at the destination; discrepancies remain unavailable until reconciled.</InfoNote>
    </DetailFrame>
  )
}
