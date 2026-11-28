import { useState } from 'react'
import { Ban, Building2, CircleCheck, Copy, Download, Eye, Lock, LockKeyhole, Pencil, Plus, ShieldCheck, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import RoleInspector from '../components/RoleInspector'
import { CATEGORY_ICONS, STATUS_TONES } from '../components/roleIcons'
import { useRoles } from '../context/useRoles'
import { PERMISSION_GROUPS, SCOPES, STAFF_CATEGORIES } from '../data/roles'
import { scopeLabel } from '../rolePermissions'
import { validateRole } from '../validation'

const VIEWS = [
  { id: 'table', label: 'Table' },
  { id: 'matrix', label: 'Matrix' },
]

const STATUSES = ['Active', 'Inactive', 'Draft']

function MetricCard({ label, icon: Icon, value, badge, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
        <Icon className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
      </div>
      <dd className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-2xl leading-8 font-bold text-on-surface">{value}</span>
        {badge}
      </dd>
      <p className="mt-1 text-xs leading-4 text-on-surface-variant">{hint}</p>
    </div>
  )
}

function IconAction({ label, icon: Icon, onClick, disabled, active }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded p-1 transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        active ? 'text-brand' : 'text-on-surface-variant hover:text-on-surface',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}

export default function RolesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { roles, branches, updateRole } = useRoles()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('')
  const [status, setStatus] = useState('')
  const [view, setView] = useState('table')
  const [selectedId, setSelectedId] = useState(location.state?.roleId ?? roles.find((role) => !role.system)?.id)
  const [editing, setEditing] = useState(false)
  const [failure, setFailure] = useState('')

  const search = query.trim().toLowerCase()
  const rows = roles.filter(
    (role) =>
      (!search || [role.name, role.category, role.description].some((text) => text.toLowerCase().includes(search))) &&
      (!category || role.category === category) &&
      (!scope || SCOPES[role.scope] === scope) &&
      (!status || role.status === status),
  )
  const selected = roles.find((role) => role.id === selectedId)

  const systemCount = roles.filter((role) => role.system).length
  const totalUsers = roles.reduce((sum, role) => sum + role.users, 0)
  const activeUsers = roles.filter((role) => role.status === 'Active').reduce((sum, role) => sum + role.users, 0)
  const orgRoles = roles.filter((role) => role.scope === 'org')
  const categoryCount = new Set(rows.map((role) => role.category)).size

  const resetFilters = () => {
    setQuery('')
    setCategory('')
    setScope('')
    setStatus('')
  }

  const inspect = (id, edit = false) => {
    setSelectedId(id)
    setEditing(edit)
  }

  const duplicate = (id) => navigate(ROUTES.roleNew, { state: { duplicateOf: id } })

  const toggleStatus = async (role) => {
    setFailure('')
    try {
      await updateRole(role.id, { status: role.status === 'Active' ? 'Inactive' : 'Active' })
    } catch (error) {
      setFailure(error.message)
    }
  }

  const download = () =>
    exportCsv('roles.csv', [
      ['Role', 'Staff category', 'Users', 'Access scope', 'Status', 'Permissions', 'Last modified', 'Modified by'],
      ...rows.map((role) => [role.name, role.category, role.users, scopeLabel(role), role.status, role.permissions.length, role.modifiedOn, role.modifiedBy]),
    ])

  return (
    <WorkspacePage>
      <PageIntro
        eyebrow={
          <>
            <span className="text-on-surface-variant">Access control</span>
            <StatusPill tone="info">DPDP role shield enabled</StatusPill>
          </>
        }
        title="Role management"
        description="Manage staff roles, operational boundaries, and granular clinical permissions across every clinic branch."
        actions={
          <>
            <ActionButton icon={Download} onClick={download}>
              Export
            </ActionButton>
            <ActionButton icon={Users} to={ROUTES.roleMembers}>
              Members
            </ActionButton>
            <ActionButton variant="primary" icon={Plus} to={ROUTES.roleNew}>
              Add role
            </ActionButton>
          </>
        }
      />

      {failure && (
        <Banner tone="danger" className="mb-5">
          {failure}
        </Banner>
      )}

      <dl className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total defined roles"
          icon={ShieldCheck}
          value={`${roles.length} roles`}
          badge={<StatusPill tone="success">+{roles.length - systemCount} custom</StatusPill>}
          hint={`${systemCount} protected system ${systemCount === 1 ? 'role' : 'roles'} · ${roles.length - systemCount} custom`}
        />
        <MetricCard
          label="Total assigned users"
          icon={Users}
          value={`${totalUsers} users`}
          badge={<StatusPill tone="info">{totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0}% active</StatusPill>}
          hint={`Across all ${branches.length} clinic branches`}
        />
        <MetricCard
          label="Org-wide master roles"
          icon={Building2}
          value={`${orgRoles.length} roles`}
          badge={<StatusPill>Unrestricted</StatusPill>}
          hint={orgRoles.map((role) => role.name).join(', ')}
        />
        <MetricCard
          label="Branch-scoped & restricted"
          icon={LockKeyhole}
          value={`${roles.length - orgRoles.length} roles`}
          badge={<StatusPill tone="brand">DPDP enforced</StatusPill>}
          hint="Strict cross-branch data isolation"
        />
      </dl>

      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={query} onChange={setQuery} label="Search roles" placeholder="Search by role title, category, or keyword…" className="min-w-60 flex-1" />
        <FilterSelect label="Staff category" value={category} onChange={setCategory} allLabel="Staff type: All types" options={STAFF_CATEGORIES} />
        <FilterSelect label="Access scope" value={scope} onChange={setScope} allLabel="Scope: All access levels" options={Object.values(SCOPES)} />
        <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="Status: All statuses" options={STATUSES} />
        <button type="button" onClick={resetFilters} className="text-xs font-semibold text-brand hover:underline">
          Reset filters
        </button>
        <FilterTabs options={VIEWS} value={view} onChange={setView} label="View mode" className="ml-auto" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {view === 'table' ? (
            <Table
              headings={['Role name & type', 'Users', 'Access scope', 'Status', 'Last modified', 'Actions']}
              minWidth={680}
              empty={rows.length ? null : 'No roles match your filters.'}
            >
              {rows.map((role) => {
                const Icon = CATEGORY_ICONS[role.category] ?? ShieldCheck
                const isSelected = role.id === selectedId
                const canActivate =
                  role.status === 'Active' ||
                  Object.keys(validateRole({ ...role, branchCount: role.branchIds.length, permissionCount: role.permissions.length })).length === 0
                return (
                  <tr
                    key={role.id}
                    className={cn(
                      'border-b border-l-2 border-b-slate-100 align-top last:border-b-0',
                      isSelected ? 'border-l-brand bg-teal-50/40' : 'border-l-transparent hover:bg-surface-lowest',
                      role.status !== 'Active' && 'text-outline',
                    )}
                  >
                    <Cell>
                      <div className="flex items-start gap-3">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', isSelected ? 'bg-teal-50 text-brand' : 'bg-surface-low text-on-surface-variant')}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => inspect(role.id)}
                            aria-current={isSelected ? 'true' : undefined}
                            className="flex items-center gap-1 text-left font-semibold hover:text-brand"
                          >
                            {role.name}
                            {role.system && <Lock className="size-3 text-brand" aria-label="System role" />}
                          </button>
                          <p className="text-[11px] text-outline">{role.category}</p>
                        </div>
                      </div>
                    </Cell>
                    <Cell className="font-semibold whitespace-nowrap">{role.users} users</Cell>
                    <Cell>
                      <StatusPill tone={role.scope === 'org' ? 'neutral' : 'info'}>{scopeLabel(role)}</StatusPill>
                      {role.scopeNote && <p className="mt-1 text-[11px] text-outline">{role.scopeNote}</p>}
                    </Cell>
                    <Cell>{role.system ? <StatusPill tone="info">Protected</StatusPill> : <StatusPill tone={STATUS_TONES[role.status]}>{role.status}</StatusPill>}</Cell>
                    <Cell className="text-xs text-on-surface-variant">
                      <p className="whitespace-nowrap">{role.modifiedOn}</p>
                      <p>by {role.modifiedBy}</p>
                    </Cell>
                    <Cell>
                      <div className="flex items-center gap-0.5">
                        <IconAction label={`View ${role.name}`} icon={Eye} onClick={() => inspect(role.id)} active={isSelected && !editing} />
                        <IconAction label={`Edit ${role.name}`} icon={Pencil} onClick={() => inspect(role.id, true)} disabled={role.system} active={isSelected && editing} />
                        <IconAction label={`Duplicate ${role.name}`} icon={Copy} onClick={() => duplicate(role.id)} />
                        <IconAction
                          label={`${role.status === 'Active' ? 'Deactivate' : 'Activate'} ${role.name}`}
                          icon={role.status === 'Active' ? Ban : CircleCheck}
                          onClick={() => toggleStatus(role)}
                          disabled={role.system || !canActivate}
                        />
                      </div>
                    </Cell>
                  </tr>
                )
              })}
            </Table>
          ) : (
            <Table headings={['Role', ...PERMISSION_GROUPS.map((group) => group.label)]} minWidth={960} empty={rows.length ? null : 'No roles match your filters.'}>
              {rows.map((role) => (
                <tr key={role.id} className={cn('border-b border-slate-100 last:border-0', role.id === selectedId ? 'bg-teal-50/40' : 'hover:bg-surface-lowest')}>
                  <Cell>
                    <button type="button" onClick={() => inspect(role.id)} className="text-left font-semibold hover:text-brand">
                      {role.name}
                    </button>
                  </Cell>
                  {PERMISSION_GROUPS.map((group) => {
                    const count = group.permissions.filter((permission) => role.permissions.includes(permission.id)).length
                    return (
                      <Cell key={group.id} className={cn('text-xs font-semibold', count === group.permissions.length ? 'text-brand' : count ? 'text-on-surface' : 'text-outline')}>
                        {count}/{group.permissions.length}
                      </Cell>
                    )
                  })}
                </tr>
              ))}
            </Table>
          )}
          <TableFooter summary={`Showing ${rows.length} of ${roles.length} roles across ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`} />
        </div>

        {selected ? (
          <RoleInspector
            key={`${selected.id}-${editing}`}
            role={selected}
            editing={editing}
            onEdit={() => setEditing(true)}
            onCancel={() => setEditing(false)}
            onSave={async (changes) => {
              await updateRole(selected.id, changes)
              setEditing(false)
            }}
            onDuplicate={() => duplicate(selected.id)}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-on-surface-variant">Select a role to inspect its permissions.</p>
        )}
      </div>
    </WorkspacePage>
  )
}
