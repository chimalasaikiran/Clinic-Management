import { Fragment, useState } from 'react'
import { ChevronDown, ChevronUp, Flag, Plus, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import DetailFrame from '../../inventory/components/DetailFrame'
import { locationName, NOW, PHARMACIES, REQUEST_PRIORITIES, REQUEST_STATUS_TONE } from '../../inventory/constants'
import { useStock } from '../../inventory/context/useStock'
import { itemById } from '../../inventory/data/items'
import { formatDate, qty, shortDateTime } from '../../inventory/format'
import { daysBetween } from '../../patients/format'

const WINDOWS = { 'Last 7 days': 7, 'Last 30 days': 30, 'All time': Infinity }
const STATUSES = ['Draft', 'Submitted', 'Approved', 'Partially approved', 'Dispatched', 'Partially fulfilled', 'Fulfilled', 'Rejected', 'Cancelled']
const SUB = {
  Draft: 'Not submitted', Submitted: 'Awaiting approval', Approved: 'Awaiting issue', 'Partially approved': 'Balance open', Dispatched: 'Receipt pending', Rejected: 'See decision note', Cancelled: 'No stock movement',
}

function sub(request) {
  if (request.status === 'Partially fulfilled') return `${request.lines.reduce((sum, line) => sum + Math.max(0, line.requested - line.received), 0)} units pending`
  if (request.status === 'Fulfilled') return `${request.activity[0]?.text ?? 'Completed'}`
  if (request.status === 'Rejected') return request.decisionNote ?? SUB.Rejected
  return SUB[request.status] ?? ''
}

function Details({ request }) {
  const approved = request.activity.find((entry) => /^Approved/.test(entry.text))
  const issued = request.activity.find((entry) => /issue|Dispatched|receipt/i.test(entry.text))
  return (
    <div className="border-l-2 border-brand bg-surface-lowest px-6 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><p className="font-semibold">{request.id} · Fulfillment details</p><p className="text-outline">Required by {formatDate(request.required)} · {request.priority} priority</p></div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] tracking-wide text-outline uppercase"><th className="pb-2 font-semibold">Medicine</th><th className="pb-2 font-semibold">Requested</th><th className="pb-2 font-semibold">Issued</th><th className="pb-2 font-semibold">Pending</th></tr></thead>
          <tbody>
            {request.lines.map((line) => {
              const item = itemById(line.itemId)
              return <tr key={line.itemId}><td className="py-1">{item.name}</td><td>{qty(line.requested)} {item.unitPlural}</td><td>{qty(line.issued)} {item.unitPlural}</td><td className="font-semibold">{qty(Math.max(0, line.requested - line.issued))} {item.unitPlural}</td></tr>
            })}
          </tbody>
        </table>
        <div className="border-t border-slate-200 pt-3 text-xs text-on-surface-variant lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <p>{approved ? `${approved.text} · ${formatDate(approved.date)}` : 'Not yet approved by Inventory'}</p>
          {issued && <p className="mt-1">Last movement: {issued.text} · {shortDateTime(issued.date, issued.time)}</p>}
          {request.decisionNote ? <p className="mt-1">{request.decisionNote}</p> : request.status === 'Partially fulfilled' && <p className="mt-1 text-brand">Balance pending replenishment at Central Stores.</p>}
        </div>
      </div>
    </div>
  )
}

export default function PharmacyRequestsPage() {
  const { state } = useStock()
  const saved = useLocation().state
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [window, setWindow] = useState('Last 30 days')
  const [pharmacy, setPharmacy] = useState('')
  const [priority, setPriority] = useState('')
  const [pageSize, setPageSize] = useState(8)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState('')

  const needle = query.trim().toLowerCase()
  const inWindow = state.requests.filter((request) => daysBetween(request.date, NOW.date) <= WINDOWS[window])
  const rows = inWindow
    .filter((request) => (!status || request.status === status) && (!pharmacy || locationName(request.pharmacy) === pharmacy) && (!priority || request.priority === priority) && (!needle || `${request.id} ${request.lines.map((line) => itemById(line.itemId).name).join(' ')} ${request.requestedBy}`.toLowerCase().includes(needle)))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const shown = rows.slice((current - 1) * pageSize, current * pageSize)
  const count = (value) => inWindow.filter((request) => request.status === value).length
  const reset = (setter) => (value) => { setter(value); setPage(1) }

  return (
    <DetailFrame
      crumbs={[{ label: 'Pharmacy', to: ROUTES.pharmacy }, { label: 'Stock requests' }]}
      title="Stock Requests"
      subtitle="Track internal stock requests from your pharmacies to Central Stores."
      actions={<ActionButton variant="primary" icon={Plus} to={ROUTES.pharmacyRequestNew}>New Stock Request</ActionButton>}
    >
      {saved?.saved && <InfoNote tone="brand" className="mb-5">{saved.submitted ? `${saved.saved} was submitted to Central Stores for approval. Pharmacy stock is unchanged until it is issued.` : `${saved.saved} was saved as a draft. It has not been sent to Central Stores.`}</InfoNote>}
      <p className="mb-5 flex flex-wrap items-baseline gap-x-8 gap-y-1 rounded-lg border border-slate-200 bg-white px-5 py-4 text-xs text-on-surface-variant">
        <span><strong className="mr-2 text-3xl font-semibold text-on-surface">{inWindow.length}</strong>requests in the {window.toLowerCase()}</span>
        <span><strong className="text-sky-700">{count('Submitted')} submitted</strong> awaiting approval</span>
        <span><strong className="text-amber-800">{count('Partially fulfilled')} partially fulfilled</strong> awaiting balance</span>
        <span className="ml-auto"><strong className="text-emerald-700">{count('Fulfilled')} fulfilled</strong></span>
      </p>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center gap-3 px-5 pt-5"><h2 className="text-lg font-semibold">Request history</h2><span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-on-surface-variant">{rows.length} requests</span><span className="ml-auto text-[11px] text-outline">Newest first · Request date</span></header>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Search request ID, medicine or requester</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-outline" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => reset(setQuery)(event.target.value)} placeholder="Search request ID, medicine or requester" className="w-full rounded-md border border-slate-200 py-2 pr-3 pl-8 text-xs outline-none focus:border-brand" />
          </label>
          {[['Status', status, reset(setStatus), 'Status: All', STATUSES], ['Date range', window, reset(setWindow), null, Object.keys(WINDOWS)], ['Pharmacy', pharmacy, reset(setPharmacy), 'All pharmacies', PHARMACIES.map((entry) => entry.name)], ['Priority', priority, reset(setPriority), 'All priorities', REQUEST_PRIORITIES]].map(([label, value, onChange, all, options]) => (
            <select key={label} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand">
              {all && <option value="">{all}</option>}
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Request ID', 'Date', 'Requesting pharmacy', 'Source inventory', 'Items / requested quantity', 'Priority', 'Requested by', 'Status', 'Action'].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {shown.map((request) => {
                const expanded = open === request.id
                return (
                  <Fragment key={request.id}>
                    <tr className={cn('border-b border-slate-100 align-top hover:bg-surface-lowest', expanded && 'bg-surface-lowest')}>
                      <td className="px-4 py-3 text-[13px]"><p className="font-semibold">{request.id}</p><p className="text-[11px] text-outline">{request.lines.length} {request.lines.length === 1 ? 'item' : 'items'}</p></td>
                      <td className="px-4 py-3 text-xs"><p className="font-semibold">{formatDate(request.date)}</p><p className="text-outline">{shortDateTime(request.date, request.time).split('· ')[1]}</p></td>
                      <td className="px-4 py-3 text-xs"><p className="font-semibold">{locationName(request.pharmacy)}</p><p className="text-outline">Downtown · #0{PHARMACIES.findIndex((entry) => entry.id === request.pharmacy) + 1}</p></td>
                      <td className="px-4 py-3 text-xs"><p>Central Stores</p><p className="text-outline">Internal inventory</p></td>
                      <td className="px-4 py-3 text-xs">{request.lines.map((line) => <p key={line.itemId}>{itemById(line.itemId).name} · {qty(line.requested)} {itemById(line.itemId).unitPlural}</p>)}</td>
                      <td className="px-4 py-3 text-xs">{request.priority === 'Urgent' ? <span className="inline-flex items-center gap-1 font-semibold text-amber-800"><Flag className="size-3" aria-hidden="true" />Urgent</span> : 'Normal'}</td>
                      <td className="px-4 py-3 text-xs"><p className="font-semibold">{request.requestedBy}</p><p className="text-outline">{request.role}</p></td>
                      <td className="px-4 py-3"><StatusPill tone={REQUEST_STATUS_TONE[request.status]} dot>{request.status}</StatusPill><p className="mt-1 text-[11px] text-outline">{sub(request)}</p></td>
                      <td className="px-4 py-3 text-xs font-semibold text-brand">
                        {request.status === 'Draft' ? (
                          <Link to={`${ROUTES.pharmacyRequestNew}?draft=${request.id}`} className="hover:underline">Edit draft ›</Link>
                        ) : (
                          <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'View'} details for ${request.id}`} onClick={() => setOpen(expanded ? '' : request.id)} className="inline-flex items-center gap-1 hover:underline">{expanded ? 'Hide Details' : 'View Details'}{expanded ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}</button>
                        )}
                      </td>
                    </tr>
                    {expanded && <tr><td colSpan={9} className="p-0"><Details request={request} /></td></tr>}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No stock requests match the current filters.</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-on-surface-variant">
          <span>Showing {rows.length ? `${(current - 1) * pageSize + 1}–${(current - 1) * pageSize + shown.length}` : 0} of {rows.length} requests
            <label className="ml-4">Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="ml-1 rounded border border-slate-200 px-1.5 py-1">{[8, 16].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          </span>
          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={number === current ? 'page' : undefined} onClick={() => setPage(number)} className={cn('rounded border px-2.5 py-1', number === current ? 'border-brand bg-brand text-white' : 'border-slate-200')}>{number}</button>)}
            <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
          </nav>
        </footer>
      </section>
      <InfoNote className="mt-4">Internal pharmacy-to-inventory requests only. Stock moves after approval and issue by Central Stores.</InfoNote>
    </DetailFrame>
  )
}
