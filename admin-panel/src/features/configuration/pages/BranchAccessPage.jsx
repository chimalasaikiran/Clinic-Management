import { useState } from 'react'
import { ArrowUpRight, Download, Eye, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import GrantAccessDrawer from '../components/GrantAccessDrawer'
import { ACCESS_LEVELS, ACCESS_SUMMARY, ACCESS_TIERS, BRANCH_ACCESS } from '../data/access'

const LEVEL_FILTERS = ['Full', 'Work', 'View only']
const SOURCE_FILTERS = ['Role-based', 'Direct', 'Inherited']

const levelGroup = (levelKey) => (levelKey.startsWith('full') ? 'Full' : levelKey.startsWith('work') ? 'Work' : 'View only')

export default function BranchAccessPage() {
  const { branchId } = useParams()
  const navigate = useNavigate()
  // The drawer is its own route so the "Add access" state can be linked to and survives a reload.
  const drawerOpen = Boolean(useMatch(ROUTES.branchAccessAdd))
  const openDrawer = () => navigate(pathFor(ROUTES.branchAccessAdd, { branchId }))
  const closeDrawer = () => navigate(pathFor(ROUTES.branchAccess, { branchId }))
  const [filters, setFilters] = useState({ query: '', level: '', source: '', department: '' })

  const set = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }))
  const needle = filters.query.trim().toLowerCase()
  const departments = [...new Set(BRANCH_ACCESS.map((entry) => entry.department))]

  const rows = BRANCH_ACCESS.filter(
    (entry) =>
      (!needle || `${entry.name} ${entry.detail}`.toLowerCase().includes(needle)) &&
      (!filters.level || levelGroup(entry.level) === filters.level) &&
      (!filters.source || entry.source === filters.source) &&
      (!filters.department || entry.department === filters.department),
  )

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Branch scope: Main Clinic (HYD-HQ-01)</span>
            <StatusPill>Security classification: Restricted facility</StatusPill>
          </>
        }
        title="Access & permissions"
        description="Control who can authenticate and execute operational workflows within this branch. Branch access provisions facility-level authentication boundaries without altering central organizational credentials or global RBAC policies."
        actions={
          <>
            <ActionButton icon={ArrowUpRight} to={ROUTES.organisation}>
              Manage organizational roles
            </ActionButton>
            <ActionButton variant="primary" icon={UserPlus} onClick={openDrawer}>
              Add access
            </ActionButton>
          </>
        }
      />

      <StatTiles items={ACCESS_SUMMARY.map((tile) => ({ ...tile, hint: `${tile.hint} · ${tile.note}` }))} />

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <SearchBox value={filters.query} onChange={set('query')} label="Search people or roles" placeholder="Search people or roles by name or email…" className="w-72 max-w-full" />
          <FilterSelect label="Access level" value={filters.level} onChange={set('level')} allLabel="All levels" options={LEVEL_FILTERS} />
          <FilterSelect label="Source" value={filters.source} onChange={set('source')} allLabel="All sources" options={SOURCE_FILTERS} />
          <FilterSelect label="Department" value={filters.department} onChange={set('department')} allLabel="All departments" options={departments} />
          <span className="ml-auto flex items-center gap-3 text-xs text-on-surface-variant">
            {rows.length} of 18 assignments found
            <ActionButton size="sm" icon={Download}>
              Export roster
            </ActionButton>
          </span>
        </div>

        <Table headings={['Person / Role', 'Access level', 'Physical / shift scope', 'Department', 'Status', 'Source', 'Actions']} minWidth={980} empty={rows.length ? null : 'No assignments match your filters.'}>
          {rows.map((entry) => {
            const level = ACCESS_LEVELS[entry.level]
            return (
              <Row key={entry.id}>
                <Cell>
                  <div className="flex items-center gap-3">
                    <Avatar initials={entry.initials} tone={entry.level === 'fullSovereign' ? 'ink' : 'slate'} />
                    <div>
                      <Link to={pathFor(ROUTES.staffProfile, { staffId: entry.id })} className="font-semibold hover:text-brand">
                        {entry.name}
                      </Link>
                      <p className="text-[11px] text-outline">{entry.detail}</p>
                    </div>
                  </div>
                </Cell>
                <Cell>
                  <StatusPill tone={level.tone}>{level.label}</StatusPill>
                </Cell>
                <Cell>
                  <p className="font-medium">{entry.scope}</p>
                  <p className="text-[11px] text-outline">{entry.scopeNote}</p>
                </Cell>
                <Cell>{entry.department}</Cell>
                <Cell>
                  <StatusPill tone="success">{entry.status}</StatusPill>
                </Cell>
                <Cell className="text-xs">{entry.source}</Cell>
                <Cell>
                  {entry.sourceLink ? (
                    <Link to={ROUTES.organisation} className="text-xs font-medium text-brand hover:underline">
                      View source
                    </Link>
                  ) : (
                    <Link to={pathFor(ROUTES.staffProfile, { staffId: entry.id })} aria-label={`View ${entry.name}`} className="inline-flex text-outline hover:text-on-surface">
                      <Eye className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                </Cell>
              </Row>
            )
          })}
        </Table>

        <TableFooter summary={`Showing ${rows.length} of 18 assigned individuals & roles · Facility ID: HYD-HQ-01`}>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <ActionButton size="sm" disabled>Previous</ActionButton>
            <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">1</span>
            <ActionButton size="sm">2</ActionButton>
            <ActionButton size="sm">3</ActionButton>
            <ActionButton size="sm">Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <section aria-labelledby="tiers-heading" className="mt-6">
        <div className="flex items-center justify-between pb-3">
          <h2 id="tiers-heading" className="text-base font-semibold text-on-surface">Facility access tiers & operational authority</h2>
          <span className="text-[11px] text-outline">ABDM Milestone 3 Architecture</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {ACCESS_TIERS.map((tier) => (
            <Panel key={tier.id} title={<span className="flex items-center gap-2"><span className={`size-2 rounded-full ${tier.tone}`} />{tier.title}</span>}>
              <p className="text-xs leading-5 text-on-surface-variant">{tier.detail}</p>
              <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-outline">{tier.foot}</p>
            </Panel>
          ))}
        </div>
      </section>

      <aside className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-3 text-xs text-on-surface-variant">
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
          Last branch access review conducted on <strong className="text-on-surface">12 Sep 2026</strong> by Dr. Julian Vance. All access events are cryptographically recorded in the ABDM-compliant immutable audit log.
        </p>
        <Link to={pathFor(ROUTES.branch, { branchId })} className="font-semibold text-brand hover:underline">
          View branch access audit ledger
        </Link>
      </aside>

      <GrantAccessDrawer open={drawerOpen} onClose={closeDrawer} />
    </ConfigPage>
  )
}
