import { useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { DEPARTMENT_TYPES } from '../configView'

const SORTERS = {
  name: { label: 'Name (A–Z)', compare: (a, b) => a.name.localeCompare(b.name) },
  code: { label: 'Code', compare: (a, b) => a.code.localeCompare(b.code) },
  people: { label: 'Most people', compare: (a, b) => b.counts.staff + b.counts.doctors - (a.counts.staff + a.counts.doctors) },
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

export default function DepartmentsPage() {
  const { can } = useAuth()
  const resource = useApiResource(() => configApi.departments(), 'departments')
  const branchCount = useApiResource(() => configApi.branches(), 'config-branches').data?.length ?? 0
  const [group, setGroup] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('name')
  const departments = resource.data ?? []
  const active = departments.filter((department) => department.status === 'active')

  const tabs = [{ id: 'all', label: 'All Types', count: departments.length }, ...DEPARTMENT_TYPES.map((type) => ({ id: type, label: type, count: departments.filter((department) => department.type === type).length }))].filter((entry) => entry.id === 'all' || entry.count > 0)

  const rows = departments
    .filter((department) => (group === 'all' || department.type === group) && (status === 'all' || department.status === status))
    .sort(SORTERS[sort].compare)

  const summary = [
    { label: 'Active depts', value: active.length, hint: `${departments.length - active.length} inactive` },
    { label: 'Services', value: departments.reduce((sum, department) => sum + department.counts.services, 0), hint: 'In the billing catalogue' },
    { label: 'Doctors', value: departments.reduce((sum, department) => sum + department.counts.doctors, 0), hint: 'Practitioner records' },
    { label: 'Staff', value: departments.reduce((sum, department) => sum + department.counts.staff, 0), hint: 'Staff records' },
  ]

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="text-on-surface-variant">Organization configuration</span>}
        title="Departments"
        description="Organize clinical specialties, diagnostic suites, and operational service units across your clinic locations."
        actions={can('settings.organisation') && <ActionButton variant="primary" icon={Plus} to={ROUTES.departmentNew}>Add department</ActionButton>}
      />

      {!resource.data ? (
        <LoadingState label="Loading departments…" error={resource.error} onRetry={resource.reload} />
      ) : (
        <>
          <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="max-w-md">
              <StatusPill tone="success">Organisation master list</StatusPill>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                {plural(departments.length, 'department')} across {plural(branchCount, 'branch').replace('branchs', 'branches')}. Staff, doctor and service forms choose their department from the active ones here; renaming a department renames it on those records too.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {summary.map((item) => (
                <div key={item.label} className="min-w-24 rounded-md border border-slate-200 p-3">
                  <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{item.label}</dt>
                  <dd className="text-xl font-bold text-on-surface">{item.value}</dd>
                  <p className="text-[10px] text-outline">{item.hint}</p>
                </div>
              ))}
            </dl>
          </section>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <FilterTabs options={tabs} value={group} onChange={setGroup} label="Department type" />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <label className="flex items-center gap-1.5">
              Status:
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                <option value="all">All (Active/Inactive)</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Sort:
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                {Object.entries(SORTERS).map(([id, option]) => (
                  <option key={id} value={id}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Table
              headings={['Department & scope', 'Assigned locations', 'Configured services', 'Staff & practitioners', 'Status', '']}
              minWidth={980}
              empty={rows.length ? null : departments.length ? 'No departments match your filters.' : 'No departments yet. Add one, or finish onboarding to create them from your specialties.'}
            >
              {rows.map((department) => {
                const link = pathFor(ROUTES.department, { departmentId: department.id })
                return (
                  <Row key={department.id} muted={department.status !== 'active'}>
                    <Cell>
                      <Link to={link} className="font-semibold hover:text-brand">{department.name}</Link>
                      <p className="mt-0.5 text-[11px] text-outline">
                        {department.type} · <span className="rounded bg-surface-high px-1 py-0.5">{department.code}</span>
                      </p>
                    </Cell>
                    <Cell>
                      <p className="font-medium">{department.branches[0]?.name ?? 'No branch'}</p>
                      <p className="text-[11px] text-outline">{department.branches.length === branchCount && branchCount > 1 ? `All ${branchCount} branches` : department.branches.length > 1 ? `+ ${plural(department.branches.length - 1, 'more branch').replace('branchs', 'branches')}` : department.branches.length === 1 ? 'Only this branch' : ''}</p>
                    </Cell>
                    <Cell>
                      <p className="font-medium">{plural(department.counts.services, 'service')}</p>
                      <p className="text-[11px] text-outline">In the billing catalogue</p>
                    </Cell>
                    <Cell>
                      <p className="font-medium">{plural(department.counts.staff + department.counts.doctors, 'person').replace('persons', 'people')}</p>
                      <p className="text-[11px] text-outline">{plural(department.counts.doctors, 'doctor')} · {department.counts.staff} staff</p>
                    </Cell>
                    <Cell>
                      <StatusPill tone={department.status === 'active' ? 'success' : 'neutral'} dot>{department.status === 'active' ? 'Active' : 'Inactive'}</StatusPill>
                    </Cell>
                    <Cell>
                      <Link to={link} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                        View <ArrowRight className="size-3" aria-hidden="true" />
                      </Link>
                    </Cell>
                  </Row>
                )
              })}
            </Table>
            <TableFooter summary={`Showing ${rows.length} of ${departments.length} departments`} />
          </div>

          <aside className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-surface-low p-5">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold text-on-surface">Organizational topology</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Departments are organization-level units linked to one or more physical branches. Services name a department in the billing catalogue, and staff and doctors are assigned to one on their records.
              </p>
            </div>
            <ActionButton to={ROUTES.roles} className="text-brand">Roles & permissions</ActionButton>
          </aside>
        </>
      )}
    </ConfigPage>
  )
}
