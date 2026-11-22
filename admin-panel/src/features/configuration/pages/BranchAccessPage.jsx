import { useState } from 'react'
import { ArrowUpRight, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { accessApi } from '../../auth/api'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { ACCESS_LEVEL_TONES, ACCESS_TIERS, accessRoster } from '../access'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import GrantAccessDrawer from '../components/GrantAccessDrawer'
import { BRANCH_STATUS, initialsOf } from '../configView'

const LEVEL_FILTERS = ['Full', 'Work', 'View only']
const SOURCE_FILTERS = ['Organisation-wide role', 'Branch role']

export default function BranchAccessPage() {
  const { branchId } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  // The drawer is its own route so the "Add access" state can be linked to and survives a reload.
  const drawerOpen = Boolean(useMatch(ROUTES.branchAccessAdd))
  const openDrawer = () => navigate(pathFor(ROUTES.branchAccessAdd, { branchId }))
  const closeDrawer = () => navigate(pathFor(ROUTES.branchAccess, { branchId }))
  const [filters, setFilters] = useState({ query: '', level: '', source: '', role: '' })
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const branch = useApiResource(() => configApi.branch(branchId), `config-branch:${branchId}`)
  const roles = useApiResource(() => accessApi.roles(), `roles#${attempt}`)
  const members = useApiResource(() => accessApi.members(), `members#${attempt}`)
  const error = branch.error ?? roles.error ?? members.error

  if (!branch.data || !roles.data || !members.data) {
    return (
      <ConfigPage>
        <PageIntro title={branch.error?.status === 404 ? 'Branch not found' : 'Access & permissions'} />
        {branch.error?.status !== 404 && <LoadingState label="Loading branch access…" error={error} onRetry={() => { branch.reload(); roles.reload(); members.reload() }} />}
      </ConfigPage>
    )
  }

  const current = branch.data
  const roster = accessRoster(members.data, roles.data, [branchId])
  const set = (key) => (value) => setFilters((state) => ({ ...state, [key]: value }))
  const needle = filters.query.trim().toLowerCase()
  const roleNames = [...new Set(roster.flatMap((entry) => entry.roles.map((role) => role.name)))].sort()
  const rows = roster.filter(
    (entry) =>
      (!needle || `${entry.member.user.fullName} ${entry.member.user.email} ${entry.roles.map((role) => role.name).join(' ')}`.toLowerCase().includes(needle)) &&
      (!filters.level || entry.level === filters.level) &&
      (!filters.source || entry.source === filters.source) &&
      (!filters.role || entry.roles.some((role) => role.name === filters.role)),
  )
  const coveringRoles = roles.data.filter((role) => role.status === 'active' && (role.scope === 'org' || role.branchIds.includes(branchId)))
  const tiles = [
    { label: 'People with access', value: roster.length, hint: `${roster.filter((entry) => entry.member.status === 'active').length} active` },
    { label: 'Full access', value: roster.filter((entry) => entry.level === 'Full').length, hint: 'Can change settings or roles' },
    { label: 'Roles covering branch', value: coveringRoles.length, hint: `${coveringRoles.filter((role) => role.scope === 'branch').length} branch-limited` },
    { label: 'Branch status', value: BRANCH_STATUS[current.status][0], hint: current.code },
  ]
  const [statusLabel] = BRANCH_STATUS[current.status]

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Branch scope: {current.name} ({current.code})</span>
            <StatusPill>{statusLabel}</StatusPill>
          </>
        }
        title="Access & permissions"
        description="Who can work at this branch. Access comes from roles: organisation-wide roles reach every branch, branch-limited roles reach the branches they list."
        actions={
          <>
            <ActionButton icon={ArrowUpRight} to={ROUTES.roles}>Manage organizational roles</ActionButton>
            {can('settings.roles') && <ActionButton variant="primary" icon={UserPlus} onClick={openDrawer}>Add access</ActionButton>}
          </>
        }
      />

      {message && <Banner tone="brand" title={message} className="mb-5" />}

      <StatTiles items={tiles} />

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <SearchBox value={filters.query} onChange={set('query')} label="Search people or roles" placeholder="Search people or roles by name or email…" className="w-72 max-w-full" />
          <FilterSelect label="Access level" value={filters.level} onChange={set('level')} allLabel="All levels" options={LEVEL_FILTERS} />
          <FilterSelect label="Source" value={filters.source} onChange={set('source')} allLabel="All sources" options={SOURCE_FILTERS} />
          <FilterSelect label="Role" value={filters.role} onChange={set('role')} allLabel="All roles" options={roleNames} />
          <span className="ml-auto text-xs text-on-surface-variant">{rows.length} of {roster.length} people</span>
        </div>

        <Table headings={['Person', 'Access level', 'Roles giving access', 'Status', 'Source']} minWidth={860} empty={rows.length ? null : roster.length ? 'No people match your filters.' : 'No one has a role covering this branch yet.'}>
          {rows.map((entry) => (
            <Row key={entry.member.id} muted={entry.member.status !== 'active'}>
              <Cell>
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(entry.member.user.fullName)} tone={entry.level === 'Full' ? 'ink' : 'slate'} />
                  <div>
                    <p className="font-semibold">{entry.member.user.fullName}</p>
                    <p className="text-[11px] text-outline">{entry.member.user.email}</p>
                  </div>
                </div>
              </Cell>
              <Cell><StatusPill tone={ACCESS_LEVEL_TONES[entry.level]}>{entry.level}</StatusPill></Cell>
              <Cell>
                <span className="flex flex-wrap gap-1">
                  {entry.roles.map((role) => <span key={role.id} className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">{role.name}</span>)}
                </span>
              </Cell>
              <Cell><StatusPill tone={entry.member.status === 'active' ? 'success' : 'neutral'}>{entry.member.status === 'active' ? 'Active' : entry.member.status}</StatusPill></Cell>
              <Cell className="text-xs">{entry.source}</Cell>
            </Row>
          ))}
        </Table>

        <TableFooter summary={`Showing ${rows.length} of ${roster.length} people with access · ${current.name} (${current.code})`} />
      </div>

      <section aria-labelledby="tiers-heading" className="mt-6">
        <div className="flex items-center justify-between pb-3">
          <h2 id="tiers-heading" className="text-base font-semibold text-on-surface">Facility access tiers & operational authority</h2>
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
          Every role and access change is recorded in the audit log with who made it and when.
        </p>
        <Link to={pathFor(ROUTES.branch, { branchId })} className="font-semibold text-brand hover:underline">Back to branch</Link>
      </aside>

      {can('settings.roles') && (
        <GrantAccessDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          branch={current}
          roles={roles.data}
          members={members.data}
          onGranted={(text) => {
            setMessage(text)
            setAttempt((count) => count + 1)
          }}
        />
      )}
    </ConfigPage>
  )
}
