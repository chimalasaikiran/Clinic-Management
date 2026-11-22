import { useState } from 'react'
import { Eye, Search, UserPlus, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import PageIntro from '../../../components/workspace/PageIntro'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { staffApi } from '../../staff/api'
import { configApi } from '../api'
import AddPeopleDrawer from '../components/AddPeopleDrawer'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_STATUS, initialsOf } from '../configView'

const PAGE_SIZE = 25
const EMPTY_FILTERS = { type: '', department: '', status: '' }
const STATUS_LABEL = { active: 'Active', draft: 'Draft', inactive: 'Inactive', on_leave: 'On leave' }

function RosterFilters({ query, onQuery, filters, onFilter, onClear, options, total, branchName }) {
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
            placeholder="Search staff or doctors by name or staff code…"
            className="w-72 max-w-full rounded-md border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        {options.map((filter) => (
          <select
            key={filter.key}
            aria-label={filter.label}
            value={filters[filter.key]}
            onChange={(event) => onFilter(filter.key, event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-on-surface outline-none focus:border-brand"
          >
            <option value="">{filter.label}</option>
            {filter.options.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        ))}
      </div>
      <p className="flex items-center gap-3 text-xs text-on-surface-variant">
        <span>
          <strong className="text-on-surface">{total}</strong> {hasFilters ? 'matching' : 'people assigned to'} {branchName}
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

function RosterRow({ person, branchId }) {
  const active = person.status === 'active'
  const here = person.branches.find((branch) => branch.id === branchId)
  const profile = pathFor(ROUTES.staffProfile, { staffId: person.id })
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-surface-lowest">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials={initialsOf(person.fullName)} tone={person.type === 'doctor' ? 'teal' : 'slate'} />
          <div className="min-w-0">
            <Link to={profile} className="text-[13px] font-semibold text-on-surface hover:text-brand">{person.fullName}</Link>
            <p className="text-[11px] text-outline">{person.staffCode}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusPill tone={person.type === 'doctor' ? 'success' : 'neutral'} className="rounded">{person.type === 'doctor' ? 'Doctor' : 'Staff'}</StatusPill>
      </td>
      <td className="px-4 py-3 text-[13px] text-on-surface">{person.designation}</td>
      <td className="px-4 py-3 text-[13px] text-on-surface">{person.department ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-on-surface">
        <span className="mr-2">{here?.isPrimary ? 'Primary branch' : 'Additional branch'}</span>
        {person.branches.length > 1 && <span className="rounded bg-surface-high px-1.5 py-0.5 text-[11px] text-on-surface-variant">{person.branches.length} branches</span>}
      </td>
      <td className="px-4 py-3">
        <span className={cn('flex items-center gap-1.5 text-xs font-medium', active ? 'text-brand' : 'text-outline')}>
          <span className="size-1.5 rounded-full bg-current" />
          {person.onLeave ? 'On leave' : STATUS_LABEL[person.status] ?? person.status}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <Link to={profile} aria-label={`View ${person.fullName}`} className="inline-flex text-outline hover:text-on-surface">
          <Eye className="size-4" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  )
}

export default function BranchStaffPage() {
  const { branchId } = useParams()
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const branch = useApiResource(() => configApi.branch(branchId), `config-branch:${branchId}`)
  const departments = useApiResource(() => configApi.departments(), 'departments').data ?? []
  const params = { branchId, query: query.trim() || undefined, type: filters.type || undefined, department: filters.department || undefined, status: filters.status || undefined, page, pageSize: PAGE_SIZE }
  const roster = useApiResource(() => staffApi.list(params), `branch-staff:${JSON.stringify(params)}#${attempt}`)

  if (!branch.data) {
    return (
      <ConfigPage>
        <PageIntro title={branch.error?.status === 404 ? 'Branch not found' : 'Staff & Doctors'} />
        {branch.error?.status !== 404 && <LoadingState label="Loading branch…" error={branch.error} onRetry={branch.reload} />}
      </ConfigPage>
    )
  }

  const current = branch.data
  const people = roster.data?.data ?? []
  const total = roster.data?.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const options = [
    { key: 'type', label: 'All types', options: [['doctor', 'Doctors'], ['staff', 'Staff']] },
    { key: 'department', label: 'All departments', options: departments.map((department) => [department.name, department.name]) },
    { key: 'status', label: 'All statuses', options: Object.entries(STATUS_LABEL) },
  ]
  const [statusLabel] = BRANCH_STATUS[current.status]
  const setFilter = (key, value) => {
    setFilters((state) => ({ ...state, [key]: value }))
    setPage(1)
  }
  const clearFilters = () => {
    setQuery('')
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Branch scope: {current.name}</span>
            <span className="text-outline">{current.code}</span>
            <span className="text-brand">● {statusLabel} branch</span>
          </>
        }
        title="Staff & Doctors"
        description="Manage the people assigned to this branch. Deploy existing physicians, nursing officers, and administrative staff from the organization directory."
        actions={
          <>
            <ActionButton to={ROUTES.staffDirectory}>Staff directory</ActionButton>
            {can('staff.create') && <ActionButton variant="primary" icon={UserPlus} onClick={() => setDrawerOpen(true)}>Add people</ActionButton>}
          </>
        }
      />

      {notice && <Banner tone="brand" title={notice} className="mb-5" />}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <RosterFilters
          query={query}
          onQuery={(value) => {
            setQuery(value)
            setPage(1)
          }}
          filters={filters}
          onFilter={setFilter}
          onClear={clearFilters}
          options={options}
          total={total}
          branchName={current.name}
        />

        {!roster.data ? (
          <LoadingState label="Loading staff…" error={roster.error} onRetry={roster.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-surface-lowest text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">
                <tr>
                  {['Person', 'Type', 'Role / Designation', 'Department', 'Branch assignment', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} scope="col" className={cn('px-4 py-3', heading === 'Actions' && 'text-center')}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <RosterRow key={person.id} person={person} branchId={branchId} />
                ))}
              </tbody>
            </table>
            {people.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">{query || Object.values(filters).some(Boolean) ? 'No people match your filters.' : 'No one is deployed to this branch yet.'}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-on-surface-variant">
          <p>
            Showing <strong className="text-on-surface">{total ? `${(page - 1) * PAGE_SIZE + 1} – ${(page - 1) * PAGE_SIZE + people.length}` : 0}</strong> of <strong className="text-on-surface">{total}</strong> assigned personnel
          </p>
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <ActionButton size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</ActionButton>
              <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">{page}</span>
              <ActionButton size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</ActionButton>
            </nav>
          )}
        </div>
      </div>

      {can('staff.create') && (
        <AddPeopleDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          branch={current}
          onAdded={(text) => {
            setNotice(text)
            setAttempt((count) => count + 1)
          }}
        />
      )}
    </ConfigPage>
  )
}
