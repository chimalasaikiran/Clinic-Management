import { useState } from 'react'
import { FileText, Lock, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs, SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { useStock } from '../../inventory/context/useStock'
import DetailFrame from '../../inventory/components/DetailFrame'
import RxDrawerHost from '../components/RxDrawerHost'
import { RX_TONE } from '../dispensing'
import { minutesAgoLabel, queueCounts } from '../selectors'

const STATUS_TABS = [
  { id: 'all', label: 'All statuses', test: () => true },
  { id: 'open', label: 'Not dispensed', test: (rx) => rx.status === 'Awaiting dispensing' },
  { id: 'partial', label: 'Partially dispensed', test: (rx) => rx.status === 'Partially dispensed' },
  { id: 'hold', label: 'On hold', test: (rx) => rx.status === 'On hold' },
  { id: 'blocked', label: 'Blocked', test: (rx) => rx.status === 'Blocked' },
  { id: 'done', label: 'Dispensed', test: (rx) => rx.status === 'Dispensed' },
]

const STATUS_STYLE = { 'Awaiting dispensing': 'Not dispensed' }

function Progress({ done, total }) {
  return <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-100"><div className="h-full bg-amber-600" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} /></div>
}

export default function PrescriptionQueuePage() {
  const { state } = useStock()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [rxId, setRxId] = useState(null)
  const counts = queueCounts(state.rxQueue)
  const needle = query.trim().toLowerCase()
  const selected = STATUS_TABS.find((entry) => entry.id === tab)
  const rows = state.rxQueue.filter((rx) => selected.test(rx) && (!needle || `${rx.id} ${rx.patient.name} ${rx.patient.uhid} ${rx.prescriber}`.toLowerCase().includes(needle)))

  return (
    <DetailFrame
      crumbs={[{ label: 'Back to Pharmacy', to: ROUTES.pharmacy }, { label: 'Prescription Queue' }]}
      title="Prescription Queue"
      subtitle="Review prescriptions and dispensing progress across your authorized pharmacy branches."
    >
      <section className="mb-5 flex gap-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-xs">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <div><p className="text-sm font-semibold">Aura Health · All locations (3) · Authorized pharmacy branches</p><p className="mt-1 text-on-surface-variant">Pharmacist authorization is required to dispense. Owner access does not grant dispensing permission.</p></div>
      </section>

      <p className="mb-2 flex justify-between text-[11px] font-semibold tracking-wide text-outline uppercase"><span>Pharmacy workspace totals</span><span className="font-normal normal-case">Counts of the records held for this workspace</span></p>
      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[['All queued', counts.queued], ['Awaiting dispensing', counts.awaiting], ['In-progress / partial', counts.partial], ['On hold / review', counts.hold], ['Completed today', counts.completed]].map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs text-outline">{label}</dt><dd className="mt-1 text-3xl font-semibold">{value}</dd></div>
        ))}
      </dl>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={query} onChange={setQuery} label="Search prescriptions" placeholder="Search prescription ID, patient or clinician" className="min-w-72 flex-1" />
        <span className="rounded-md border border-slate-200 px-3 py-2 text-xs">Branch: All locations (3)</span>
        <span className="rounded-md border border-slate-200 px-3 py-2 text-xs">Date: All recorded dates</span>
        <div className="basis-full"><FilterTabs label="Prescription status" value={tab} onChange={setTab} options={STATUS_TABS.map((entry) => ({ id: entry.id, label: entry.label }))} /></div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-3 text-lg font-semibold">Prescription records <span className="rounded bg-surface-low px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">{rows.length} source records</span></h2>
        <span className="text-[11px] text-outline">Issue time · newest first</span>
      </div>

      <ul className="flex flex-col gap-4">
        {rows.length === 0 && <li className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-on-surface-variant">No prescriptions match the current filters.</li>}
        {[...rows].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).map((rx) => {
          const done = rx.lines.filter((line) => line.dispensed >= line.qty).length
          const finished = rx.status === 'Dispensed'
          return (
            <li key={rx.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-xs">
                <p><span className="font-mono font-semibold">#{rx.id}</span> <span className="text-outline">{rx.time} · {minutesAgoLabel(rx.date, rx.time)} in source</span></p>
                <StatusPill tone={RX_TONE[rx.status]}>{STATUS_STYLE[rx.status] ?? rx.status}</StatusPill>
              </header>
              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.3fr_1.7fr]">
                <div className="text-xs">
                  <p className="text-base font-semibold">{rx.patient.name}</p>
                  <p className="text-outline">{rx.patient.age}{rx.patient.gender} · {rx.patient.uhid}</p>
                  <p className="mt-3 font-semibold">{rx.prescriber}</p>
                  <p className="text-outline">{rx.department}{rx.chamber ? ` · ${rx.chamber}` : ''}</p>
                  <p className="mt-3 text-outline">Issue date: {rx.date}</p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold tracking-wide text-outline uppercase">Medicine summary</p>
                  <ul className="flex flex-col gap-1.5 text-xs">{rx.lines.map((line) => <li key={line.id} className="rounded bg-surface-lowest px-3 py-2">{line.name} · {line.qty} {line.unit}{line.dispensed >= line.qty ? ' · dispensed' : line.dispensed ? ` · ${line.dispensed} dispensed` : ''}</li>)}</ul>
                  <p className={`mt-2 text-xs font-semibold ${finished ? 'text-emerald-700' : rx.status === 'Partially dispensed' ? 'text-amber-700' : 'text-danger'}`}>{finished ? 'Dispensed & dual-checked' : done ? `${done}/${rx.lines.length} dispensed` : `Not dispensed · 0/${rx.lines.length}`}</p>
                  {!finished && done > 0 && <Progress done={done} total={rx.lines.length} />}
                </div>
                <div className="text-xs">
                  <p className="font-semibold">Validity: {rx.hold ? 'Held' : 'Verified at source'} · {rx.coverage}</p>
                  <p className="mt-2 text-on-surface-variant">{rx.notes}</p>
                  {rx.hold && <p className="mt-2 flex items-start gap-1.5 text-amber-800"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{rx.hold}</p>}
                  <ActionButton className="mt-3" icon={FileText} onClick={() => setRxId(rx.id)}>View Prescription</ActionButton>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 flex justify-between text-[11px] text-outline"><span>End of available source records · {rows.length} shown</span></p>
      {rxId && <RxDrawerHost key={rxId} rxId={rxId} onClose={() => setRxId(null)} />}
    </DetailFrame>
  )
}
