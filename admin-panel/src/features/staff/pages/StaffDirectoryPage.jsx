import { useEffect, useState } from 'react'
import { BadgeCheck, Download, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import { useAuth } from '../../auth/context/useAuth'
import { branchesApi } from '../../patients/api'
import { STATUS_VALUES, toPersonView } from '../adapters'
import { staffApi } from '../api'

const EMPTY_FILTERS = { query: '', type: '', department: '', branch: '', status: '' }
const PAGE_SIZE = 25
const SEARCH_DELAY_MS = 300
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '0%')

function SummaryTiles({ summary }) {
  const tiles = summary
    ? [
        { label: 'Total people', value: summary.total, hint: 'records', foot: 'Doctors and staff' },
        { label: 'Doctors', value: summary.doctors, hint: percent(summary.doctors, summary.total), foot: 'Specialists & generalists' },
        { label: 'Staff', value: summary.staff, hint: percent(summary.staff, summary.total), foot: 'Nursing, pharmacy, tech & admin' },
        { label: 'Active', value: summary.active, hint: 'on roster', foot: 'Active master records' },
        { label: 'Inactive / leave', value: summary.inactive + summary.onLeave, hint: 'people', foot: `${summary.onLeave} on leave today · ${summary.inactive} inactive or draft` },
      ]
    : []
  return (
    <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{tile.label}</dt>
          <dd className="mt-1 text-2xl font-bold text-on-surface">
            {tile.value} <span className="text-xs font-normal text-on-surface-variant">{tile.hint}</span>
          </dd>
          <p className="mt-0.5 text-[11px] text-outline">{tile.foot}</p>
        </div>
      ))}
    </dl>
  )
}

function PersonRow({ person, compact }) {
  const profilePath = pathFor(ROUTES.staffMember, { staffId: person.id })
  const onLeave = person.status === 'On Leave'
  const visibleBranches = person.branches.slice(0, 2)

  return (
    <Row>
      <Cell className={compact ? 'py-1.5' : undefined}>
        <div className="flex items-center gap-3">
          <Avatar initials={person.initials} tone={person.tone} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-semibold">
              <Link to={profilePath} className="hover:underline">{person.name}</Link>
              {person.record.account.linked && <BadgeCheck className="size-3.5 text-brand" aria-label="Has a ClinicOS login" />}
            </p>
            {!compact && <p className="font-mono text-[11px] text-outline">{person.staffCode} · {person.registry}</p>}
          </div>
        </div>
      </Cell>
      <Cell>
        <StatusPill tone={person.type === 'Doctor' ? 'success' : 'info'} className="rounded">{person.type}</StatusPill>
        {!compact && <p className="mt-1 max-w-48 text-[11px] text-on-surface-variant">{person.role}</p>}
      </Cell>
      <Cell className="text-xs">{person.department}</Cell>
      <Cell>
        <span className="flex flex-col items-start gap-1">
          {visibleBranches.map((branch) => (
            <span key={branch} className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">
              {branch === person.primaryBranch && <span className="mr-1 text-brand">●</span>}
              {branch}
            </span>
          ))}
          {person.branches.length > 2 && <span className="text-[11px] text-outline">+{person.branches.length - 2} more</span>}
          {person.branches.length === 0 && <span className="text-[11px] text-outline">Not assigned yet</span>}
        </span>
      </Cell>
      <Cell>
        {onLeave ? (
          <StatusPill tone="warning">On Leave {person.leaveNote && `(${person.leaveNote})`}</StatusPill>
        ) : (
          <StatusPill tone={person.status === 'Active' ? 'success' : 'neutral'} dot>{person.status}</StatusPill>
        )}
      </Cell>
      <Cell>
        <Link to={profilePath} className="text-xs font-semibold text-brand hover:underline">Profile</Link>
      </Cell>
    </Row>
  )
}

export default function StaffDirectoryPage() {
  const { can } = useAuth()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters.query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [filters.query])

  const summary = useApiResource(() => staffApi.summary(), 'summary')
  const branches = useApiResource(() => branchesApi.list(), 'branches')
  const branchList = branches.data ?? []
  const params = {
    query,
    type: filters.type.toLowerCase() || undefined,
    department: filters.department || undefined,
    branchId: branchList.find((branch) => branch.name === filters.branch)?.id,
    status: STATUS_VALUES[filters.status],
    page,
    pageSize: PAGE_SIZE,
  }
  const result = useApiResource(() => staffApi.list(params), JSON.stringify(params))
  const rows = (result.data?.data ?? []).map(toPersonView)
  const total = result.data?.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const last = (page - 1) * PAGE_SIZE + rows.length

  const set = (key) => (value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }
  const filtered = Object.values(filters).some(Boolean)
  const download = () => exportCsv('staff-directory.csv', [['Staff ID', 'Name', 'Type', 'Designation', 'Department', 'Branches', 'Status', 'Registration'], ...rows.map((person) => [person.staffCode, person.name, person.type, person.role, person.department, person.branches.join('; '), person.status, person.registry])])

  return (
    <WorkspacePage>
      <PageIntro
        eyebrow={<span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Organization workforce master · {branchList.length} {branchList.length === 1 ? 'branch' : 'branches'}</span>}
        title="Staff & doctors"
        description="Manage your organization's workforce, professional credentials, and multi-branch clinical assignments."
        actions={
          <>
            <ActionButton icon={Download} onClick={download} disabled={rows.length === 0}>Export Directory</ActionButton>
            {can('staff.create') && <ActionButton variant="primary" icon={Plus} to={ROUTES.staffNew}>Add person</ActionButton>}
          </>
        }
      />

      <SummaryTiles summary={summary.data} />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <SearchBox value={filters.query} onChange={set('query')} label="Search staff" placeholder="Search by name, registration number, or staff ID…" className="w-72 max-w-full" />
          <FilterSelect label="Type" value={filters.type} onChange={set('type')} allLabel="All Types" options={['Doctor', 'Staff']} />
          <FilterSelect label="Department" value={filters.department} onChange={set('department')} allLabel="All Departments" options={summary.data?.departments ?? []} />
          <FilterSelect label="Branch" value={filters.branch} onChange={set('branch')} allLabel="All Branches" options={branchList.map((branch) => branch.name)} />
          <FilterSelect label="Status" value={filters.status} onChange={set('status')} allLabel="Status: All" options={['Active', 'On Leave', 'Draft', 'Inactive']} />
          {filtered && (
            <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }} className="text-xs font-medium text-brand hover:underline">Reset</button>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs text-on-surface-variant">
            <div role="group" aria-label="Row density" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
              {[['Normal', false], ['Compact', true]].map(([label, value]) => (
                <button key={label} type="button" aria-pressed={compact === value} onClick={() => setCompact(value)} className={cn('rounded px-2.5 py-1 font-medium', compact === value ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
                  {label}
                </button>
              ))}
            </div>
            Showing {first}–{last} of {total}
          </div>
        </div>

        <Table
          headings={['Person & credentials', 'Type & specialty', 'Primary department', 'Branch assignments', 'Status', 'Actions']}
          minWidth={960}
          empty={rows.length ? null : result.error ? result.error.message : result.loading ? 'Loading staff…' : filtered ? 'No people match your filters.' : 'No staff records yet. Add the first person to get started.'}
        >
          {rows.map((person) => (
            <PersonRow key={person.id} person={person} compact={compact} />
          ))}
        </Table>

        <TableFooter summary={`Showing ${first}–${last} of ${total} workforce members`}>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <ActionButton size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</ActionButton>
            <span className="rounded bg-black px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">{page}</span>
            <span className="px-1 text-xs text-outline">of {pages}</span>
            <ActionButton size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <InfoNote tone="neutral" className="mt-5">
        <strong className="text-on-surface">Logins are optional:</strong> a staff record exists whether or not the person signs in to ClinicOS. Give someone a login from their profile; the record links to their account once they accept the invitation.
      </InfoNote>
    </WorkspacePage>
  )
}
