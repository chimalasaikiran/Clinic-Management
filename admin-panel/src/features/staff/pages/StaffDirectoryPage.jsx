import { useState } from 'react'
import { BadgeCheck, Download, MoreVertical, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useStaffDirectory } from '../context/useStaffDirectory'
import { DIRECTORY_FILTERS, DIRECTORY_SUMMARY, DIRECTORY_TOTAL } from '../data/directory'

const EMPTY_FILTERS = { query: '', type: '', department: '', branch: '', status: '' }

function SummaryTiles() {
  return (
    <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {DIRECTORY_SUMMARY.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-outline uppercase">
            {tile.label}
            {tile.badge && <StatusPill tone={tile.badge.startsWith('+') ? 'success' : 'warning'}>{tile.badge}</StatusPill>}
          </dt>
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
          <Avatar initials={person.initials} tone={person.tone === 'teal' ? 'teal' : person.tone === 'ink' ? 'ink' : 'slate'} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-semibold">
              {person.name}
              {person.verified && <BadgeCheck className="size-3.5 text-brand" aria-label="Credentials verified" />}
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
          {visibleBranches.map((branch, index) => (
            <span key={branch} className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">
              {index === 0 && <span className="mr-1 text-brand">●</span>}
              {branch}
            </span>
          ))}
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
        <span className="flex items-center gap-3">
          <Link to={profilePath} className="text-xs font-semibold text-brand hover:underline">Profile</Link>
          <button type="button" aria-label={`More actions for ${person.name}`} className="text-outline hover:text-on-surface">
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </span>
      </Cell>
    </Row>
  )
}

export default function StaffDirectoryPage() {
  const { people } = useStaffDirectory()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [compact, setCompact] = useState(false)

  const set = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }))
  const needle = filters.query.trim().toLowerCase()
  const rows = people.filter(
    (person) =>
      (!needle || `${person.name} ${person.staffCode} ${person.registry}`.toLowerCase().includes(needle)) &&
      (!filters.type || person.type === filters.type) &&
      (!filters.department || person.department === filters.department) &&
      (!filters.branch || person.branches.includes(filters.branch)) &&
      (!filters.status || person.status === filters.status),
  )
  const filtered = Object.values(filters).some(Boolean)
  const total = DIRECTORY_TOTAL + (people.length - 8)

  return (
    <WorkspacePage>
      <PageIntro
        eyebrow={
          <>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Organization workforce master · 3 network branches</span>
            <StatusPill tone="success">ABDM HPR Linked</StatusPill>
          </>
        }
        title="Staff & doctors"
        description="Manage your organization's workforce, professional credentials, and multi-branch clinical assignments."
        actions={
          <>
            <ActionButton icon={Download}>Export Directory</ActionButton>
            <ActionButton variant="primary" icon={Plus} to={ROUTES.staffNew}>Add person</ActionButton>
          </>
        }
      />

      <SummaryTiles />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <SearchBox value={filters.query} onChange={set('query')} label="Search staff" placeholder="Search by name, registration number, or staff ID…" className="w-72 max-w-full" />
          <FilterSelect label="Type" value={filters.type} onChange={set('type')} allLabel="All Types" options={DIRECTORY_FILTERS.type} />
          <FilterSelect label="Department" value={filters.department} onChange={set('department')} allLabel="All Departments" options={DIRECTORY_FILTERS.department} />
          <FilterSelect label="Branch" value={filters.branch} onChange={set('branch')} allLabel="All Branches (3 Sites)" options={DIRECTORY_FILTERS.branch} />
          <FilterSelect label="Status" value={filters.status} onChange={set('status')} allLabel="Status: All" options={DIRECTORY_FILTERS.status} />
          {filtered && (
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-medium text-brand hover:underline">Reset</button>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs text-on-surface-variant">
            <div role="group" aria-label="Row density" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
              {[
                ['Normal', false],
                ['Compact', true],
              ].map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={compact === value}
                  onClick={() => setCompact(value)}
                  className={cn('rounded px-2.5 py-1 font-medium', compact === value ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}
                >
                  {label}
                </button>
              ))}
            </div>
            Showing 1–{rows.length} of {filtered ? rows.length : total}
          </div>
        </div>

        <Table headings={['Person & credentials', 'Type & specialty', 'Primary department', 'Branch assignments', 'Status', 'Actions']} minWidth={960} empty={rows.length ? null : 'No people match your filters.'}>
          {rows.map((person) => (
            <PersonRow key={person.id} person={person} compact={compact} />
          ))}
        </Table>

        <TableFooter summary={`Showing ${rows.length} of ${filtered ? rows.length : total} workforce members · Last organization directory sync 14 Sep 2026, 10:15 AM IST`}>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <ActionButton size="sm" disabled>Previous</ActionButton>
            <span className="rounded bg-black px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">1</span>
            {[2, 3, 4, 5].map((page) => (
              <ActionButton key={page} size="sm" disabled title="Sample data covers the first page only">{page}</ActionButton>
            ))}
            <ActionButton size="sm" disabled>Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <InfoNote tone="neutral" className="mt-5">
        <strong className="text-on-surface">Ayushman Bharat Digital Mission (ABDM) Compliance Protocol:</strong> Workforce master records are synchronized across all connected branch gateways under ABDM Healthcare Professionals Registry (HPR) standards. Changes made to medical council registrations trigger instant cross-branch compliance validation.
      </InfoNote>
    </WorkspacePage>
  )
}
