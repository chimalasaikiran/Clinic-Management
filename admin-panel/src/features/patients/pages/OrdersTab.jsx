import { useState } from 'react'
import { FlaskConical, Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { StatTiles } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { clinicalApi } from '../api'
import { toOrderRequest } from '../clinicalAdapters'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import CreateOrderDrawer from '../drawers/CreateOrderDrawer'
import { CancelOrderDrawer, ResultDrawer, ResultEntryDrawer, SpecimenDrawer } from '../drawers/OrderDrawers'
import { ORDER_STEPS } from '../data/catalog'
import { formatDate, formatTime } from '../format'
import { byNewest } from '../selectors'

const TABS = [
  { id: 'all', label: 'All Orders', test: () => true },
  { id: 'review', label: 'Awaiting Review', test: (order) => order.status === 'Awaiting Review' },
  { id: 'processing', label: 'Processing', test: (order) => ['Ordered', 'Processing'].includes(order.status) },
  { id: 'completed', label: 'Completed', test: (order) => order.status.startsWith('Completed') },
]

const statusTone = (status) => (status === 'Awaiting Review' ? 'danger' : status === 'Processing' || status === 'Ordered' ? 'neutral' : status === 'Cancelled' ? 'neutral' : 'success')
const edge = (status) => (status === 'Awaiting Review' ? 'border-l-danger' : status === 'Processing' || status === 'Ordered' ? 'border-l-slate-900' : 'border-l-brand')

function Stepper({ order }) {
  const steps = ORDER_STEPS[order.kind] ?? ORDER_STEPS.lab
  return (
    <ol className="flex flex-wrap gap-1 text-[10px]" aria-label="Order progress">
      {steps.map((step, index) => (
        <li key={step} className={cn('rounded border px-2 py-1', index === order.stage ? (order.status === 'Awaiting Review' ? 'border-danger bg-danger text-white' : 'border-black bg-black text-white') : index < order.stage ? 'border-brand text-brand' : 'border-slate-200 text-outline')}>
          {index + 1}. {step}
        </li>
      ))}
    </ol>
  )
}

export default function OrdersTab() {
  const { patient, mine, refresh } = usePatient()
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [drawer, setDrawer] = useState(null)
  const orders = mine('orders').sort(byNewest)
  const encounter = mine('encounters').find((entry) => entry.status === 'In Progress')
  const diagnoses = mine('diagnoses').filter((entry) => entry.encounterId === encounter?.id && entry.status === 'Active')

  const pipeline = orders.filter((order) => ['Ordered', 'Processing', 'Awaiting Review'].includes(order.status))
  const awaiting = orders.filter((order) => order.status === 'Awaiting Review')
  const processing = orders.filter((order) => ['Ordered', 'Processing'].includes(order.status))
  const archived = orders.filter((order) => order.status.startsWith('Completed'))
  const selected = TABS.find((entry) => entry.id === tab)
  const needle = query.trim().toLowerCase()
  const rows = orders.filter((order) => selected.test(order) && (!category || order.category === category) && (!needle || `${order.reference} ${order.title}`.toLowerCase().includes(needle)))
  const order = drawer ? orders.find((entry) => entry.id === drawer.id) : null

  // Every step is done by the server; the chart is reloaded afterwards so the cards and alerts match it.
  const run = async (call) => {
    await call
    await refresh()
  }
  const place = (draft) => run(clinicalApi.placeOrder(patient.id, toOrderRequest(draft, { encounterId: encounter?.id, branchId: patient.branchId })))
  const sign = (id, review) => run(clinicalApi.reviewResult(id, review))
  const saveResult = (id, result) => run(clinicalApi.recordResult(id, result))
  const cancel = (id, reason) => run(clinicalApi.cancelOrder(id, reason))
  const collect = async (id) => {
    try {
      await run(clinicalApi.collectSpecimen(id))
      setNotice(null)
    } catch (error) {
      setNotice(error.message)
    }
  }

  return (
    <div>
      <StatTiles
        className="mb-5 lg:grid-cols-5"
        items={[
          { label: 'Active diagnostic orders', value: pipeline.length, hint: 'In pipeline' },
          { label: 'Awaiting clinician review', value: awaiting.length, hint: awaiting[0] ? `Urgent sign-off · ${awaiting[0].title}` : 'Nothing to sign off' },
          { label: 'Processing in lab / imaging', value: processing.length, hint: processing[0]?.performing ?? '—' },
          { label: 'Reviewed & archived', value: archived.length, hint: 'Signed · past 12 months' },
          { label: 'Urgent orders', value: pipeline.filter((order) => order.urgent).length, hint: 'Urgent or STAT priority in pipeline' },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">Orders &amp; Results</h2><p className="text-sm text-on-surface-variant">Track this patient&apos;s diagnostic order lifecycle, laboratory specimens, imaging studies, and physician sign-off status.</p></div>
        <ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create diagnostic order</ActionButton>
      </div>

      {notice && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-danger">{notice}</p>}
      {orders.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No orders yet" action={<ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create diagnostic order</ActionButton>}>Laboratory and imaging orders placed for this patient will be tracked here.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <FilterTabs label="Order status" value={tab} onChange={setTab} options={TABS.map((entry) => ({ id: entry.id, label: entry.label, count: orders.filter(entry.test).length }))} />
            <div className="flex gap-2"><SearchBox value={query} onChange={setQuery} label="Search orders" placeholder="Search order ID, test name…" className="w-56" /><FilterSelect label="Modality" value={category} onChange={setCategory} allLabel="All Modalities" options={[...new Set(orders.map((entry) => entry.category))]} /></div>
          </div>

          <div className="flex flex-col gap-4">
            {rows.map((entry) => (
              <article key={entry.id} className={cn('rounded-lg border border-slate-200 border-l-4 bg-white p-5', edge(entry.status))}>
                <header className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono">#{entry.reference}</span>
                  <span className="text-on-surface-variant">{formatDate(entry.date)}, {formatTime(entry.time)}</span>
                  <StatusPill tone={statusTone(entry.status)} dot>{entry.status}</StatusPill>
                  <StatusPill>{entry.category}</StatusPill>
                </header>
                <h3 className="mt-2 text-base font-bold">{entry.title}</h3>
                <div className="my-3"><Stepper order={entry} /></div>
                <div className="grid gap-4 md:grid-cols-[1fr_1.2fr_auto]">
                  <dl className="text-xs"><dt className="text-outline">Ordering clinician</dt><dd className="font-semibold">{entry.ordering}</dd>{entry.encounterReference && <dd className="font-mono text-brand">Linked encounter: #{entry.encounterReference}</dd>}<dt className="mt-2 text-outline">Performing provider</dt><dd className="font-semibold">{entry.performing}</dd>{entry.performingNote && <dd className="text-on-surface-variant">{entry.performingNote}</dd>}</dl>
                  <div className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                    {entry.findings && <><p className="font-semibold">KEY FINDINGS PREVIEW <StatusPill tone="danger">{entry.findings.headline}</StatusPill></p><p className="mt-1 leading-5">{entry.findings.text}</p><p className="mt-1 text-[11px] text-brand">{entry.findings.baseline}</p></>}
                    {entry.specimen && <><p className="font-semibold">SPECIMEN TELEMETRY &amp; TRACKING <span className="font-mono text-[10px] text-outline">#{entry.specimen.accession}</span></p><p className="mt-1 leading-5">{entry.specimen.note}</p><p className="mt-1 text-[11px]">Estimated turnaround: <strong>{entry.specimen.turnaround}</strong></p></>}
                    {entry.summary && !entry.findings && <><p className="font-semibold">RESULTS SUMMARY <span className="text-brand">{entry.summaryTone}</span></p><p className="mt-1 leading-5">{entry.summary}</p></>}
                    {!entry.findings && !entry.specimen && !entry.summary && <p className="text-on-surface-variant">Awaiting processing at {entry.performing}.</p>}
                  </div>
                  <div className="flex min-w-40 flex-col gap-2">
                    {entry.status === 'Awaiting Review' && <ActionButton variant="brand" onClick={() => setDrawer({ type: 'result', id: entry.id })}>Review Result</ActionButton>}
                    {entry.status === 'Ordered' && entry.kind === 'lab' && <ActionButton variant="brand" onClick={() => collect(entry.id)}>Record Specimen Collection</ActionButton>}
                    {(entry.status === 'Processing' || (entry.status === 'Ordered' && entry.kind === 'imaging')) && <ActionButton variant="brand" onClick={() => setDrawer({ type: 'enter', id: entry.id })}>Enter Result</ActionButton>}
                    {entry.status === 'Processing' && entry.specimen && <ActionButton onClick={() => setDrawer({ type: 'specimen', id: entry.id })}>Track Specimen</ActionButton>}
                    {['Ordered', 'Processing'].includes(entry.status) && <ActionButton variant="danger" onClick={() => setDrawer({ type: 'cancel', id: entry.id })}>Cancel</ActionButton>}
                    {entry.status.startsWith('Completed') && <ActionButton onClick={() => setDrawer({ type: 'result', id: entry.id })}>View Result Detail</ActionButton>}
                    {entry.reviewedBy && <p className="text-[11px] text-on-surface-variant">Reviewed by {entry.reviewedBy}<br />{entry.reviewedAt}</p>}
                  </div>
                </div>
              </article>
            ))}
            {rows.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-on-surface-variant">No orders match the current filters.</p>}
          </div>
        </>
      )}

      {drawer?.type === 'result' && <ResultDrawer key={drawer.id} order={order} patient={patient} onClose={() => setDrawer(null)} onSign={sign} />}
      {drawer?.type === 'specimen' && <SpecimenDrawer order={order} patient={patient} onClose={() => setDrawer(null)} />}
      {drawer?.type === 'enter' && <ResultEntryDrawer key={drawer.id} order={order} patient={patient} onClose={() => setDrawer(null)} onSave={saveResult} />}
      {drawer?.type === 'cancel' && <CancelOrderDrawer key={drawer.id} order={order} onClose={() => setDrawer(null)} onCancel={cancel} />}
      <CreateOrderDrawer open={drawer?.type === 'create'} onClose={() => setDrawer(null)} patient={patient} encounter={encounter} diagnoses={diagnoses} onSubmit={place} />
    </div>
  )
}
