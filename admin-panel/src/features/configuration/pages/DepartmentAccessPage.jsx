import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { accessApi } from '../../auth/api'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { ACCESS_LEVEL_TONES, accessLevel, accessRoster, coversBranch } from '../access'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { initialsOf } from '../configView'

// Access is granted per branch through roles, so a department's access is that of the branches it operates at.
export default function DepartmentAccessPage() {
  const { departmentId } = useParams()
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const department = useApiResource(() => configApi.department(departmentId), `department:${departmentId}`)
  const roles = useApiResource(() => accessApi.roles(), 'roles')
  const members = useApiResource(() => accessApi.members(), 'members')

  if (!department.data || !roles.data || !members.data) {
    return (
      <ConfigPage>
        <PageIntro title={department.error?.status === 404 ? 'Department not found' : 'Access & Permissions'} />
        {department.error?.status !== 404 && <LoadingState label="Loading access…" error={department.error ?? roles.error ?? members.error} onRetry={() => { department.reload(); roles.reload(); members.reload() }} />}
      </ConfigPage>
    )
  }

  const current = department.data
  const branchIds = current.branches.map((branch) => branch.id)
  const roster = accessRoster(members.data, roles.data, branchIds)
  const needle = query.trim().toLowerCase()
  const rows = roster.filter((entry) => (!level || entry.level === level) && (!needle || `${entry.member.user.fullName} ${entry.member.user.email} ${entry.roles.map((role) => role.name).join(' ')}`.toLowerCase().includes(needle)))
  const coveringRoles = roles.data.filter((role) => branchIds.some((branchId) => coversBranch(role, branchId)))
  const summary = [
    { label: 'Department', value: current.name, hint: current.code },
    { label: 'Branches', value: current.branches.length, hint: current.branches.map((branch) => branch.name).join(', ') },
    { label: 'People with access', value: roster.length, hint: 'Through their roles' },
    { label: 'Full access', value: roster.filter((entry) => entry.level === 'Full').length, hint: 'Can change settings or roles' },
    { label: 'Roles involved', value: coveringRoles.length, hint: `${coveringRoles.filter((role) => role.scope === 'org').length} organisation-wide` },
  ]
  const where = (role) => (role.scope === 'org' ? 'Every branch' : current.branches.filter((branch) => role.branchIds.includes(branch.id)).map((branch) => branch.name).join(', '))

  return (
    <ConfigPage>
      <PageIntro
        title="Access & Permissions"
        description="Who can work with this department. Access is granted by role and branch: anyone whose role covers a branch where this department operates can work with it there."
        actions={<ActionButton to={pathFor(ROUTES.department, { departmentId })}>Back to department</ActionButton>}
      />

      <dl className="mb-5 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
        {summary.map((item) => (
          <div key={item.label} className="bg-white p-4">
            <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{item.label}</dt>
            <dd className="mt-1 text-[13px] font-semibold text-on-surface">{item.value}</dd>
            {item.hint && <p className="text-[11px] text-outline">{item.hint}</p>}
          </div>
        ))}
      </dl>

      <Panel title="Department access policy & inheritance" action={<StatusPill>Policy: Role-based</StatusPill>} className="mb-5" bodyClassName="p-0">
        <p className="px-5 pt-4 text-xs leading-5 text-on-surface-variant">To give someone access, add it at a branch where {current.name} operates:</p>
        <ul className="divide-y divide-slate-100">
          {current.branches.map((branch) => (
            <li key={branch.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <p className="text-[13px] font-semibold text-on-surface">{branch.name} <span className="font-normal text-outline">· {branch.code}</span></p>
              <span className="flex gap-2">
                <ActionButton size="sm" to={pathFor(ROUTES.branchAccess, { branchId: branch.id })}>View access</ActionButton>
                {can('settings.roles') && <ActionButton size="sm" variant="primary" icon={UserPlus} to={pathFor(ROUTES.branchAccessAdd, { branchId: branch.id })}>Add access</ActionButton>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            People with Department Access <StatusPill>{roster.length} people</StatusPill>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={query} onChange={setQuery} label="Search people" placeholder="Search people or roles…" className="w-56" />
            <FilterSelect label="Access level" value={level} onChange={setLevel} allLabel="All Levels" options={Object.keys(ACCESS_LEVEL_TONES)} />
          </div>
        </div>

        <Table headings={['Person', 'Access level', 'Roles giving access', 'Status']} minWidth={760} empty={rows.length ? null : roster.length ? 'No people match your filters.' : 'No one has a role covering this department’s branches.'}>
          {rows.map((entry) => (
            <Row key={entry.member.id} muted={entry.member.status !== 'active'}>
              <Cell>
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(entry.member.user.fullName)} tone="teal" size="sm" />
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
              <Cell><StatusPill tone={entry.member.status === 'active' ? 'success' : 'neutral'} dot>{entry.member.status === 'active' ? 'Active' : entry.member.status}</StatusPill></Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${roster.length} people with access to ${current.name}.`} />
      </div>

      <Panel title="Roles reaching this department" subtitle="Each role’s access level and where it applies." className="mt-5" bodyClassName="p-0">
        <Table headings={['Role', 'Access level', 'Permissions', 'Where']} minWidth={640} empty={coveringRoles.length ? null : 'No active role covers these branches.'}>
          {coveringRoles.map((role) => (
            <Row key={role.id}>
              <Cell className="font-semibold">{role.name}</Cell>
              <Cell><StatusPill tone={ACCESS_LEVEL_TONES[accessLevel(role.permissions)]}>{accessLevel(role.permissions)}</StatusPill></Cell>
              <Cell className="text-xs">{role.permissions.length}</Cell>
              <Cell className="text-xs">{where(role)}</Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="Zero-data loss guarantee & audit continuity">
          <p className="text-xs leading-5 text-on-surface-variant">
            Changing someone’s access does not delete or alter historical records, past encounters, clinical notes, prescriptions or invoices signed by that person.
          </p>
        </Panel>
        <Panel title="Administrative lockout protection">
          <p className="text-xs leading-5 text-on-surface-variant">The Owner role is a system role and cannot be changed or removed here, so the organisation cannot lock itself out. Every role and access change is recorded in the audit log.</p>
          <Link to={ROUTES.roles} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Roles & permissions</Link>
        </Panel>
      </div>
    </ConfigPage>
  )
}
