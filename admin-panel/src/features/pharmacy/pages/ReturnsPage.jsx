import { AlertTriangle, ChevronRight, Plus, RotateCcw, ShieldCheck, Search } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import DetailFrame from '../../inventory/components/DetailFrame'
import { NOW } from '../../inventory/constants'
import { useStock } from '../../inventory/context/useStock'
import { daysBetween } from '../../patients/format'
import { shortDateTime } from '../../inventory/format'
import { CASE_TONE } from '../caseTones'

const PAGE_SIZE = 8
const RANGES = { 'Last 7 days': 7, 'Last 30 days': 30, 'All time': Infinity }
const STATUSES = ['Awaiting review', 'Investigating', 'Approved', 'Resolved', 'Rejected', 'Draft']
const TYPES = ['Return', 'Discrepancy']
const CLOSED = ['Resolved', 'Rejected']

const TILES = [
  ['Awaiting review', ['Awaiting review'], 'Reported · not yet reviewed', 'bg-amber-500'],
  ['Investigating', ['Investigating'], 'Assessment in progress', 'bg-sky-500'],
  ['Approved', ['Approved'], 'Awaiting final action', 'bg-emerald-500'],
  ['Closed', CLOSED, null, 'bg-slate-400'],
]

// The list keeps its filters and page in the address so the case detail can send you back to exactly where you were.
export default function ReturnsPage() {
  const { state } = useStock()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const type = params.get('type') ?? ''
  const status = params.get('status') ?? ''
  const range = params.get('range') ?? 'Last 30 days'
  const page = Number(params.get('page')) || 1

  const change = (key, value) => {
    const next = new URLSearchParams(params)
    if (value && !(key === 'range' && value === 'Last 30 days')) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const cases = state.cases.filter((entry) => entry.status !== 'Draft' || status === 'Draft')
  const needle = query.trim().toLowerCase()
  const rows = cases
    .filter((entry) => daysBetween(entry.date, NOW.date) <= RANGES[range] && (!type || entry.type === type) && (!status || entry.status === status) && (!needle || `${entry.id} ${entry.medicine} ${entry.batchNo} ${entry.origin} ${entry.originNote}`.toLowerCase().includes(needle)))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const closedDetail = `${cases.filter((entry) => entry.status === 'Resolved').length} resolved · ${cases.filter((entry) => entry.status === 'Rejected').length} rejected`

  const download = () => exportCsv('returns-and-discrepancies.csv', [['Case', 'Type', 'Medicine', 'Batch', 'Quantity', 'Origin', 'Reason', 'Assignee', 'Status'], ...rows.map((entry) => [entry.id, entry.type, entry.medicine, entry.batchNo, `${entry.qty} ${entry.unit}`, entry.origin, entry.reason, entry.assignee, entry.status])])

  return (
    <DetailFrame
      crumbs={[{ label: 'Pharmacy', to: ROUTES.pharmacy }, { label: 'Returns & Discrepancies' }]}
      title="Returns & Discrepancies"
      subtitle="Find, review and track medicine returns and stock discrepancies."
      actions={
        <>
          <ActionButton icon={AlertTriangle} to={`${ROUTES.pharmacyReturnNew}?type=Discrepancy`}>Report discrepancy</ActionButton>
          <ActionButton variant="primary" icon={Plus} to={ROUTES.pharmacyReturnNew}>New medicine return</ActionButton>
        </>
      }
    >
      <p className="mb-2 flex justify-between text-[10px] font-semibold tracking-wide text-outline uppercase"><span>Case overview</span><span className="font-normal normal-case">Reported in the last 30 days · All locations</span></p>
      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map(([label, set, hint, dot]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-4">
            <dt className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">{label}<span className={cn('size-2 rounded-full', dot)} /></dt>
            <dd className="mt-1 flex items-baseline gap-3"><span className="text-3xl font-semibold">{cases.filter((entry) => set.includes(entry.status)).length}</span><span className="text-xs text-on-surface-variant">{hint ?? closedDetail}</span></dd>
          </div>
        ))}
      </dl>

      <p className="mb-5 flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-3 text-xs text-on-surface-variant"><ShieldCheck className="size-4 text-brand" aria-hidden="true" />Returns remain off available stock until reviewed. Approved returns require a separate inventory posting.</p>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5"><h2 className="flex items-center gap-2 text-lg font-semibold">All cases <span className="rounded bg-surface-low px-1.5 py-0.5 text-[11px] font-medium text-on-surface-variant">{rows.length}</span></h2><button type="button" onClick={download} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Export list</button></header>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
          <label className="block text-[11px] text-outline">Search cases
            <span className="relative mt-1 block"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-outline" aria-hidden="true" /><input type="search" aria-label="Search cases" value={query} onChange={(event) => change('q', event.target.value)} placeholder="Case ID, medicine, batch or origin…" className="w-full rounded-md border border-slate-200 py-2 pr-3 pl-8 text-xs text-on-surface outline-none focus:border-brand" /></span>
          </label>
          {[['Case type', type, 'All types', TYPES], ['Status', status, 'All statuses', STATUSES]].map(([label, value, all, options]) => (
            <label key={label} className="block text-[11px] text-outline">{label}<select aria-label={label} value={value} onChange={(event) => change(label === 'Case type' ? 'type' : 'status', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-on-surface outline-none focus:border-brand"><option value="">{all}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
          ))}
          <label className="block text-[11px] text-outline">Reported date<select aria-label="Reported date" value={range} onChange={(event) => change('range', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-on-surface outline-none focus:border-brand">{Object.keys(RANGES).map((option) => <option key={option}>{option}</option>)}</select></label>
          <button type="button" onClick={() => setParams({}, { replace: true })} className="pb-2 text-xs font-semibold text-brand hover:underline">Reset</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Case / Reported', 'Type', 'Medicine / Batch', 'Affected qty', 'Origin', 'Reason', 'Assignee', 'Status', ''].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {shown.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 align-top hover:bg-surface-lowest">
                  <td className="px-4 py-3 text-xs"><Link to={pathFor(ROUTES.pharmacyReturn, { caseId: entry.id })} state={{ search: location.search }} className="font-mono font-semibold text-brand hover:underline">{entry.id}</Link><p className="text-outline">{shortDateTime(entry.date, entry.time)}</p></td>
                  <td className="px-4 py-3 text-xs"><p className={cn('inline-flex items-center gap-1 font-semibold', entry.type === 'Return' ? 'text-brand' : 'text-amber-800')}>{entry.type === 'Return' ? <RotateCcw className="size-3" aria-hidden="true" /> : <AlertTriangle className="size-3" aria-hidden="true" />}{entry.type}</p><p className="text-outline">{entry.subtype}</p></td>
                  <td className="px-4 py-3 text-xs"><p className="font-semibold">{entry.medicine}</p><p className="text-outline">B: {entry.batchNo}</p></td>
                  <td className="px-4 py-3 text-xs"><p className="font-semibold">{entry.qty}</p><p className="text-outline">{entry.unit}</p></td>
                  <td className="px-4 py-3 text-xs"><p className="font-semibold">{entry.origin}</p><p className="text-outline">{entry.originNote}</p></td>
                  <td className="px-4 py-3 text-xs"><p className="font-semibold">{entry.reason}</p><p className="text-outline">{entry.reasonNote}</p></td>
                  <td className="px-4 py-3 text-xs"><p className="font-semibold">{entry.assignee}</p><p className="text-outline">{entry.assigneeRole}</p></td>
                  <td className="px-4 py-3"><StatusPill tone={CASE_TONE[entry.status]} dot>{entry.status}</StatusPill><p className="mt-1 text-[11px] text-outline">{entry.statusNote}</p></td>
                  <td className="px-4 py-3"><Link to={pathFor(ROUTES.pharmacyReturn, { caseId: entry.id })} state={{ search: location.search }} aria-label={`Open ${entry.id}`} className="text-brand"><ChevronRight className="size-4" aria-hidden="true" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No cases match the current filters.</p>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-on-surface-variant">
          <span>Showing {rows.length ? `${(current - 1) * PAGE_SIZE + 1}–${(current - 1) * PAGE_SIZE + shown.length}` : 0} of {rows.length} cases</span>
          <span className="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
            <button type="button" disabled={current === 1} onClick={() => change('page', String(current - 1))} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={number === current ? 'page' : undefined} onClick={() => change('page', number === 1 ? '' : String(number))} className={cn('rounded border px-2.5 py-1', number === current ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>{number}</button>)}
            <button type="button" disabled={current === pages} onClick={() => change('page', String(current + 1))} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
          </span>
        </footer>
        <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-outline">Newest reported first · All times IST</p>
      </section>
    </DetailFrame>
  )
}
