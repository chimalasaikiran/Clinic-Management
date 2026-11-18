import { Link, NavLink } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { Banner, FilterField } from '../../../components/workspace/RecordKit'
import { SearchBox } from '../../../components/workspace/controls'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'

const TABS = [['Overview', ROUTES.reports, true], ['Operations', ROUTES.reportsOperations], ['Financial', ROUTES.reportsFinancial], ['Pharmacy & Inventory', ROUTES.reportsPharmacy]]

// Shared frame for the owner reports: trail, workflow code, title, report tabs, scope filters and the source note.
// `period` labels the dates a report covers; `branch` ({ value, onChange, options }) makes the branch filter live,
// otherwise it shows `scopeLabel`.
export default function ReportsFrame({ code, title, description, back, query, onQuery, notes, children, extraFilters, period, scopeLabel, branch }) {
  return (
    <WorkspacePage>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link to={back?.to ?? ROUTES.dashboard} className="font-medium text-brand hover:underline">{back?.label ?? 'Owner Panel → Reports'}</Link>
        <span className="text-outline">Owner Panel / Reports / {code}</span>
      </div>
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand uppercase">{code} / Owner reports</p>
      <h1 className="text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
      <p className="mt-1 mb-5 text-sm text-on-surface-variant">{description}</p>
      <nav aria-label="Report" className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">{TABS.map(([label, to, end]) => <NavLink key={label} to={to} end={Boolean(end)} className={({ isActive }) => cn('-mb-px border-b-2 px-4 py-2.5 text-[13px]', isActive ? 'border-brand font-semibold text-brand' : 'border-transparent text-on-surface-variant hover:text-on-surface')}>{label}</NavLink>)}</nav>
      <div className="mb-5 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {branch
            ? <FilterField label="Branch" value={branch.value} onChange={branch.onChange} options={branch.options} />
            : <FilterField label="Branch · permission verification required" value="" disabled options={[['', scopeLabel ?? 'All permitted locations']]} />}
          {onQuery && <div><p className="mb-1.5 text-xs font-medium text-on-surface-variant">Search</p><SearchBox value={query} onChange={onQuery} label="Search reports or measures" placeholder="Search reports or measures" /></div>}
          {extraFilters}
        </div>
        <p className="mt-3 text-[11px] text-outline">Asia/Kolkata (UTC+05:30){period ? ` · ${period.label} · source dates inclusive` : ' · each report states its own period'}</p>
      </div>
      {notes && <Banner tone="brand" title={notes.title} className="mb-6">{notes.text}</Banner>}
      {children}
      <footer className="mt-8 flex items-center justify-between border-t border-slate-300 pt-4 text-xs"><Link to={ROUTES.reports} className="font-medium text-brand hover:underline">← Back to Overview · RPT-01</Link><span className="text-[11px] text-outline">ClinicOS · {code}</span></footer>
    </WorkspacePage>
  )
}
