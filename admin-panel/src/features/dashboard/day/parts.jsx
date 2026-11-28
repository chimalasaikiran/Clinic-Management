import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Banner } from '../../../components/workspace/RecordKit'
import WorkspaceLayout from '../../../components/workspace/WorkspaceLayout'
import { cn } from '../../../lib/cn'
import LoadingState from '../../patients/components/LoadingState'
import { formatLongDate } from '../../patients/format'

const timeOf = (instant, timeZone) => new Date(instant).toLocaleTimeString('en-IN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })

// The frame shared by the desk dashboards: heading, refresh, feedback, and the loading and error states.
export function DayPage({ day, eyebrow, title, subtitle, children }) {
  const { view, error, loading, reload, notice } = day
  return (
    <WorkspaceLayout>
      <div className="flex flex-col gap-5 pb-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand uppercase">{eyebrow}</p>}
            <h1 className="font-sans text-[28px] leading-9 font-bold tracking-tight text-on-surface">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {view && <p className="text-xs text-outline">{formatLongDate(view.date)} · as of {timeOf(view.generatedAt, view.timeZone)}</p>}
            <ActionButton size="sm" icon={RefreshCw} onClick={reload} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
          </div>
        </header>
        <div aria-live="polite">{notice && <Banner tone={notice.tone}>{notice.text}</Banner>}</div>
        {!view ? (
          <LoadingState label="Loading your day…" error={loading ? null : error} onRetry={reload} />
        ) : (
          <>
            {error && <LoadingState error={error} onRetry={reload} />}
            {children}
          </>
        )}
      </div>
    </WorkspaceLayout>
  )
}

export function Stats({ items }) {
  return (
    <dl className={cn('grid gap-3 sm:grid-cols-2', items.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
            {item.label}
            {item.icon && <item.icon className="size-4 text-brand" aria-hidden="true" />}
          </dt>
          <dd className="mt-2 text-[28px] leading-8 font-semibold text-on-surface">{item.value}</dd>
          <dd className="mt-2 text-[11px] text-outline">{item.hint}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Card({ title, aside, subtitle, children, className, id }) {
  return (
    <section id={id} aria-label={title} className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-outline">{subtitle}</p>}
        </div>
        {aside && <div className="text-xs text-outline">{aside}</div>}
      </header>
      {children}
    </section>
  )
}

export const Empty = ({ children }) => <p className="px-5 py-8 text-center text-sm text-on-surface-variant">{children}</p>

export function ArrowLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

export function Table({ headings, children, minWidth = 'min-w-[820px]' }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-xs', minWidth)}>
        <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">
          <tr>{headings.map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Filter({ label, value, onChange, options, all }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-outline">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent font-medium text-on-surface">
        {all && <option value="">{all}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

// A titled list of follow-up work with its true total (the list itself is capped by the API).
export function TaskCard({ title, list, empty, render, footer }) {
  return (
    <section aria-label={title} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="flex items-center justify-between text-[13px] font-semibold text-on-surface">
        {title}
        <span className="text-lg text-brand">{list.total}</span>
      </h3>
      {list.items.length === 0 ? (
        <p className="mt-3 text-xs text-outline">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 text-xs">{list.items.slice(0, 4).map((item) => <li key={item.id}>{render(item)}</li>)}</ul>
      )}
      {list.total > 4 && <p className="mt-3 text-[11px] text-outline">{list.total - 4} more not shown here.</p>}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </section>
  )
}
