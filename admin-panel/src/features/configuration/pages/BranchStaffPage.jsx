import { useState } from 'react'
import { Eye, Search, UserPlus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import AddPeopleDrawer from '../components/AddPeopleDrawer'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_ROSTER, ROSTER_FILTERS, ROSTER_TOTAL } from '../data/staff'

const EMPTY_FILTERS = { type: '', department: '', status: '' }

function RosterFilters({ query, onQuery, filters, onFilter, onClear, resultCount }) {
  const hasFilters = query || Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search staff</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-outline" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search staff or doctors by name, employee ID, NPI…"
            className="w-72 max-w-full rounded-md border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        {ROSTER_FILTERS.map((filter) => (
          <select
            key={filter.key}
            aria-label={filter.label}
            value={filters[filter.key]}
            onChange={(event) => onFilter(filter.key, event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-on-surface outline-none focus:border-brand"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ))}
      </div>
      <p className="flex items-center gap-3 text-xs text-on-surface-variant">
        <span>
          <strong className="text-on-surface">{hasFilters ? resultCount : ROSTER_TOTAL}</strong> people assigned to Main Clinic
        </span>
        {hasFilters && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-outline hover:text-on-surface">
            <X className="size-3" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </p>
    </div>
  )
}

function RosterRow({ person }) {
  const active = person.status === 'Active'
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-surface-lowest">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials={person.initials} tone={person.tone} />
          <div className="min-w-0">
            <Link to={pathFor(ROUTES.staffProfile, { staffId: person.id })} className="text-[13px] font-semibold text-on-surface hover:text-brand">
              {person.name}
            </Link>
            <p className="text-[11px] text-outline">{person.registry}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusPill tone={person.type === 'Doctor' ? 'success' : 'neutral'} className="rounded">
          {person.type}
        </StatusPill>
      </td>
      <td className="px-4 py-3 text-[13px] text-on-surface">{person.role}</td>
      <td className="px-4 py-3 text-[13px] text-on-surface">{person.department}</td>
      <td className="px-4 py-3 text-xs text-on-surface">
        <span className="mr-2">{person.branch}</span>
        <span className="rounded bg-surface-high px-1.5 py-0.5 text-[11px] text-on-surface-variant">{person.slot}</span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('flex items-center gap-1.5 text-xs font-medium', active ? 'text-brand' : 'text-outline')}>
          <span className="size-1.5 rounded-full bg-current" />
          {person.status}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <Link
          to={pathFor(ROUTES.staffProfile, { staffId: person.id })}
          aria-label={`View ${person.name}`}
          className="inline-flex text-outline hover:text-on-surface"
        >
          <Eye className="size-4" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  )
}

export default function BranchStaffPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const needle = query.trim().toLowerCase()
  const people = BRANCH_ROSTER.filter(
    (person) =>
      (!needle || `${person.name} ${person.registry} ${person.role}`.toLowerCase().includes(needle)) &&
      (!filters.type || person.type === filters.type) &&
      (!filters.department || person.department === filters.department) &&
      (!filters.status || person.status === filters.status),
  )

  const clearFilters = () => {
    setQuery('')
    setFilters(EMPTY_FILTERS)
  }

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Branch scope: Main Clinic</span>
            <span className="text-outline">HYD-HQ-01</span>
            <span className="text-brand">● Operational branch</span>
          </>
        }
        title="Staff & Doctors"
        description="Manage the people assigned to this branch. Authorize existing physicians, nursing officers, and administrative staff for local scheduling, chamber allocation, and encounter signing."
        actions={
          <>
            <span className="mr-2 text-right text-[11px] text-outline">
              Assignment mode
              <br />
              <span className="text-on-surface-variant">Existing Directory Roster</span>
            </span>
            <ActionButton>View branch roster</ActionButton>
            <ActionButton variant="primary" icon={UserPlus} onClick={() => setDrawerOpen(true)}>
              Add people
            </ActionButton>
          </>
        }
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <RosterFilters
          query={query}
          onQuery={setQuery}
          filters={filters}
          onFilter={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={clearFilters}
          resultCount={people.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-surface-lowest text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">
              <tr>
                {['Person', 'Type', 'Role / Designation', 'Department', 'Branch assignment', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} scope="col" className={cn('px-4 py-3', heading === 'Actions' && 'text-center')}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <RosterRow key={person.id} person={person} />
              ))}
            </tbody>
          </table>
          {people.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No people match your filters.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-on-surface-variant">
          <p>
            Showing <strong className="text-on-surface">1 – {people.length}</strong> of <strong className="text-on-surface">{ROSTER_TOTAL}</strong> assigned personnel
          </p>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <ActionButton size="sm" disabled>
              Previous
            </ActionButton>
            <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">1</span>
            <ActionButton size="sm">2</ActionButton>
            <ActionButton size="sm">3</ActionButton>
            <ActionButton size="sm">Next</ActionButton>
          </nav>
        </div>
      </div>

      <AddPeopleDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ConfigPage>
  )
}
