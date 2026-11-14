import { ArrowUpRight, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../../lib/cn'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'

export function CountChip({ children }) {
  return <span className="rounded bg-surface-low px-1.5 py-0.5 text-[11px] font-medium text-on-surface-variant">{children}</span>
}

// White card with a title, count chip and an Export link, used by every list on the inventory screens.
export function ListCard({ title, count, onExport, action, children, className }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-on-surface">
          {title}
          {count && <CountChip>{count}</CountChip>}
        </h2>
        <div className="flex items-center gap-3">
          {onExport && (
            <button type="button" onClick={onExport} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              Export <Download className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {action}
        </div>
      </header>
      {children}
    </section>
  )
}

// Search box plus any number of select filters. Each filter is { label, value, onChange, all, options }.
export function Toolbar({ search, onSearch, placeholder, filters = [] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-4">
      <SearchBox value={search} onChange={onSearch} label={placeholder} placeholder={placeholder} className="min-w-64 flex-1" />
      {filters.map((filter) => (
        <FilterSelect key={filter.label} label={filter.label} value={filter.value} onChange={filter.onChange} allLabel={filter.all} options={filter.options} />
      ))}
    </div>
  )
}

export function ListFooter({ shown, total, noun, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-on-surface-variant">
      <p>
        Showing {total ? `1–${shown}` : '0'} of {total} {noun}
        {children}
      </p>
      <div className="flex items-center gap-1.5" aria-label="Pagination">
        <button type="button" disabled className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
        <span className="rounded bg-teal-50 px-2 py-1 font-semibold text-brand">1</span>
        <button type="button" disabled className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
      </div>
    </div>
  )
}

// "Review request ↗" style link to the next screen of a flow.
export function NextLink({ to, children, state }) {
  return (
    <Link to={to} state={state} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

export function Pill({ tone = 'neutral', children }) {
  return <StatusPill tone={tone}>{children}</StatusPill>
}

// Section card used on the detail pages: bold heading, optional right-hand note.
export function Section({ title, aside, children, className }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        {aside && <span className="text-[11px] text-outline">{aside}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

// Label over value pairs in a grid (supplier details, order information).
export function FactGrid({ facts, columns = 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3')}>
      {facts.map(([label, value, note]) => (
        <div key={label}>
          <dt className="text-xs text-outline">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-on-surface">{value || 'Not provided'}</dd>
          {note && <p className="text-[11px] text-outline">{note}</p>}
        </div>
      ))}
    </dl>
  )
}
