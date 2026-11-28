import { dispensaryId, PHARMACIES } from '../../inventory/constants'
import { useState } from 'react'
import { AlertTriangle, ClipboardList, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { FilterTabs } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useStock } from '../../inventory/context/useStock'
import { money, qty } from '../../inventory/format'
import { ListFooter } from '../../inventory/components/shared'
import RxDrawerHost from '../components/RxDrawerHost'
import BatchDrawer from '../drawers/BatchDrawer'
import ReceiveStockDrawer from '../drawers/ReceiveStockDrawer'
import { remainingOf, RX_TONE } from '../dispensing'
import { activityLedger, minutesAgoLabel, nearExpiryValue, queueCounts, slaLabel, stockExceptions } from '../selectors'

const VIEWS = [
  { id: 'all', label: 'All Queued', test: (rx) => rx.status !== 'Dispensed' },
  { id: 'awaiting', label: 'Awaiting Dispense', test: (rx) => rx.status === 'Awaiting dispensing' },
  { id: 'partial', label: 'In Progress / Partial', test: (rx) => rx.status === 'Partially dispensed' },
  { id: 'hold', label: 'On Hold / Review', test: (rx) => rx.status === 'On hold' || rx.status === 'Blocked' },
  { id: 'done', label: 'Completed Today', test: (rx) => rx.status === 'Dispensed' },
]

const PRIORITY_STYLE = { STAT: 'border-red-200 bg-red-50 text-danger', ROUTINE: 'border-slate-200 bg-slate-100 text-slate-600', STATUTORY: 'border-amber-200 bg-amber-50 text-amber-800' }
const TILE_DOT = { red: 'bg-red-500', amber: 'bg-amber-500', teal: 'bg-brand' }

function Tile({ label, value, tag, hint, dot }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><p className="text-[11px] font-semibold tracking-wide text-outline uppercase">{label}</p><span className={cn('size-2 rounded-full', TILE_DOT[dot])} /></div>
      <p className="mt-2 flex items-center gap-3 text-4xl font-semibold">{value}{tag && <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-danger">{tag}</span>}</p>
      <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
    </div>
  )
}

export default function PharmacyPage() {
  const { state, run, dispensary, chooseDispensary } = useStock()
  const [view, setView] = useState('all')
  const [rxId, setRxId] = useState(null)
  const [batchItem, setBatchItem] = useState(null)
  const [receiving, setReceiving] = useState(false)
  const counts = queueCounts(state.rxQueue)
  const exceptions = stockExceptions(state.batches)
  const expiring = nearExpiryValue(state.batches)
  const selected = VIEWS.find((entry) => entry.id === view)
  const rows = state.rxQueue.filter(selected.test)
  const ledger = activityLedger(state).slice(0, 4)
  const awaitingCases = state.cases.filter((entry) => entry.status === 'Awaiting review').length
  const inbound = state.transfers.filter((transfer) => transfer.status === 'In transit' && transfer.to === dispensaryId())

  return (
    <WorkspacePage>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] leading-9 font-bold tracking-tight">Pharmacy</h1>
          {PHARMACIES.length === 0
            ? <Link to={ROUTES.inventorySetup} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 hover:underline">No pharmacy location yet · set one up</Link>
            : <label className="flex items-center gap-2 text-[11px] text-outline">Dispensing from<select aria-label="Dispensing pharmacy" value={dispensary ?? ''} onChange={(event) => chooseDispensary(event.target.value)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-800">{PHARMACIES.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton to={ROUTES.pharmacyReturns} icon={ClipboardList}>Returns &amp; Discrepancies{awaitingCases ? <span className="ml-1 rounded bg-surface-low px-1.5 text-[10px]">{awaitingCases}</span> : null}</ActionButton>
          <ActionButton to={ROUTES.pharmacyRefills}>Refill Requests</ActionButton>
          <ActionButton to={ROUTES.pharmacyRequests}>Stock Requests</ActionButton>
          <ActionButton icon={PackageCheck} onClick={() => setReceiving(true)}>Receive Stock (GRN){inbound.length ? <span className="ml-1 rounded bg-surface-low px-1.5 text-[10px]">{inbound.length}</span> : null}</ActionButton>
          <ActionButton variant="primary" to={ROUTES.pharmacyQueue}>Open Prescription Queue <span className="ml-1 rounded bg-teal-700 px-1.5 text-[10px]">{counts.queued}</span></ActionButton>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Awaiting dispensing" value={counts.awaiting} tag={counts.stat ? `${counts.stat} STAT Priority` : null} hint={`Avg wait: ${counts.averageWait}m · Target SLA < 15m`} dot="red" />
        <Tile label="In-progress / partial" value={counts.partial} tag={null} hint={counts.partial ? `${counts.partial} partly dispensed · balance pending` : 'No partial dispenses'} dot="amber" />
        <Tile label="Stock exceptions" value={exceptions.length} tag={exceptions.length ? 'Action Required' : null} hint={`${exceptions.filter((entry) => entry.status === 'Out of stock').length} stockout · ${exceptions.filter((entry) => entry.status === 'Low stock').length} below safety buffer`} dot="red" />
        <Tile label="Near expiry (<90d)" value={expiring.count} tag={expiring.count ? 'FEFO Tagged' : null} hint={`Auto-rotation active · Value: ${money(expiring.value)}`} dot="teal" />
      </div>

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <h2 className="text-xl font-semibold">Pending Dispensing &amp; Work Queue</h2>
            <p className="mt-1 text-xs text-on-surface-variant">Real-time prescription pipeline synchronized with Ambulatory Care &amp; Inpatient units</p>
          </div>
          <FilterTabs label="Queue view" value={view} onChange={setView} options={VIEWS.map((entry) => ({ id: entry.id, label: entry.label, count: state.rxQueue.filter(entry.test).length }))} />
        </header>
        <Table headings={['Priority', 'Rx ID & timing', 'Patient & UHID', 'Prescriber & dept', 'Prescribed regimen', 'Clinical safety & interlocks']} minWidth={980} empty={rows.length ? null : 'No prescriptions in this view.'}>
          {rows.map((rx) => (
            <Row key={rx.id}>
              <Cell>
                <span className={cn('inline-block rounded border px-2 py-0.5 text-[10px] font-semibold', PRIORITY_STYLE[rx.priority])}>{rx.priority}</span>
                <p className="mt-1 text-[11px] text-outline">{slaLabel(rx)}</p>
              </Cell>
              <Cell className="text-xs"><button type="button" onClick={() => setRxId(rx.id)} className="font-mono font-semibold text-brand hover:underline" aria-label={`Open prescription ${rx.id}`}>#{rx.id}</button><p className="text-outline">{rx.time} ({minutesAgoLabel(rx.date, rx.time)})</p></Cell>
              <Cell className="text-xs"><p className="font-semibold">{rx.patient.name}</p><p className="text-outline">{rx.patient.age}{rx.patient.gender} · {rx.patient.uhid}</p><StatusPill tone="success">{rx.patient.payer}</StatusPill></Cell>
              <Cell className="text-xs"><p className="font-semibold">{rx.prescriber}</p><p className="text-outline">{rx.department}{rx.chamber ? ` · ${rx.chamber}` : ''}</p></Cell>
              <Cell className="text-xs"><ul className="flex flex-col gap-1">{rx.lines.map((line) => <li key={line.id} className="flex items-center justify-between gap-3 rounded bg-surface-lowest px-2 py-1"><span>{line.name}</span><span className={cn('font-mono text-[10px]', line.dispensed >= line.qty ? 'text-emerald-700' : 'text-outline')}>{line.dispensed >= line.qty ? 'dispensed' : `${remainingOf(line)} ${line.unit}`}</span></li>)}</ul></Cell>
              <Cell className="text-xs"><StatusPill tone={RX_TONE[rx.status]}>{rx.status}</StatusPill><p className="mt-1 text-[11px] text-on-surface-variant">{rx.hold ?? rx.notes}</p></Cell>
            </Row>
          ))}
        </Table>
        <ListFooter shown={rows.length} total={rows.length} noun="queue items" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <header className="mb-4 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="size-4 text-danger" aria-hidden="true" />Stock &amp; Expiry Exceptions</h2><span className="text-[11px] text-outline">Requires Staff Review</span></header>
          {exceptions.length === 0 && <p className="text-sm text-on-surface-variant">No stock or expiry exceptions at the dispensary.</p>}
          <ul className="flex flex-col gap-3">
            {exceptions.map(({ item, stock, status, batch, days }) => {
              const out = status === 'Out of stock'
              const near = status === 'Near expiry'
              return (
                <li key={item.id} className={cn('rounded-md border p-4', out ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold"><span className={cn('rounded border px-1.5 py-0.5 text-[10px]', out ? 'border-red-300 bg-red-100 text-danger' : 'border-amber-300 bg-amber-100 text-amber-800')}>{out ? 'CRITICAL' : near ? 'FEFO ROTATION' : 'LOW STOCK'}</span>{item.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{out ? `Stockout · 0 in stock, minimum required ${item.safety} ${item.unitPlural}` : near ? `Near expiry · ${batch.batchNo} expires in ${days} days · ${qty(batch.posted)} ${item.unitPlural} earmarked for priority allocation` : `${qty(stock.available)} ${item.unitPlural} remaining · safety buffer ${item.safety}`}</p>
                    </div>
                    {out && <ActionButton variant="danger" to={`${ROUTES.pharmacyRequestNew}?item=${item.id}&qty=${item.safety}&priority=Urgent`}>Emergency Transfer</ActionButton>}
                    {!out && !near && <ActionButton to={`${ROUTES.pharmacyRequestNew}?item=${item.id}&qty=${Math.max(item.safety - stock.available, item.safety)}`}>Review Reorder</ActionButton>}
                    {near && <ActionButton onClick={() => setBatchItem(item)}>Review Batch</ActionButton>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <header className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Activity &amp; Statutory Ledger</h2><span className="text-[11px] text-emerald-700">● Live Ledger Stream</span></header>
          {ledger.length === 0 && <p className="text-sm text-on-surface-variant">No dispensing activity has been recorded yet.</p>}
          <ol className="flex flex-col gap-3">
            {ledger.map((entry) => (
              <li key={entry.key} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                <div className="flex justify-between gap-3"><p className="font-semibold text-on-surface">{entry.title}</p><span className="shrink-0 text-outline">{minutesAgoLabel(entry.date, entry.time)}</span></div>
                <p className="mt-1 text-on-surface-variant">{entry.detail}</p>
                <p className="mt-1 font-mono text-[10px] text-outline">{entry.seal}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <p className="mt-4 text-[11px] text-outline">Dispensing deducts the earliest-expiry batch at the dispensary; stock that Central Stores dispatches appears here once it is received. <Link to={ROUTES.inventory} className="font-semibold text-brand hover:underline">Open Inventory</Link></p>

      {rxId && <RxDrawerHost key={rxId} rxId={rxId} onClose={() => setRxId(null)} />}
      {batchItem && <BatchDrawer item={batchItem} loc={dispensaryId()} batches={state.batches} movements={state.movements} receipts={state.receipts} onClose={() => setBatchItem(null)} />}
      {receiving && <ReceiveStockDrawer transfers={inbound} onClose={() => setReceiving(false)} onReceive={(id, received) => run('transfer/receive', { id, received })} />}
    </WorkspacePage>
  )
}
