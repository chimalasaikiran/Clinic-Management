import { useState } from 'react'
import { ArrowRight, Network, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import { DEPARTMENT_GROUPS, DEPARTMENT_SUMMARY, DEPARTMENTS } from '../data/departments'

const SORTERS = {
  hierarchy: { label: 'Hierarchy', compare: () => 0 },
  name: { label: 'Name (A–Z)', compare: (a, b) => a.name.localeCompare(b.name) },
}

export default function DepartmentsPage() {
  const [group, setGroup] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('hierarchy')

  const tabs = DEPARTMENT_GROUPS.map((entry) => ({
    ...entry,
    count: entry.id === 'all' ? DEPARTMENTS.length : DEPARTMENTS.filter((department) => department.group === entry.id).length,
  })).filter((entry) => entry.id === 'all' || entry.count > 0)

  const rows = DEPARTMENTS.filter(
    (department) =>
      (group === 'all' || department.group === group) && (status === 'all' || (status === 'active') === (department.status === 'Active')),
  ).sort(SORTERS[sort].compare)

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="text-on-surface-variant">Organization configuration</span>}
        title="Departments"
        description="Organize clinical specialties, diagnostic suites, and operational service units across your clinic locations."
        actions={
          <>
            <ActionButton icon={Network}>Manage Organization Taxonomy</ActionButton>
            <ActionButton variant="primary" icon={Plus} to={ROUTES.departmentNew}>
              Add department
            </ActionButton>
          </>
        }
      />

      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="max-w-md">
          <StatusPill tone="success">Branch context: Main Clinic (Headquarters)</StatusPill>
          <p className="mt-2 text-[11px] font-semibold tracking-wide text-outline uppercase">HYD-CENTRAL-01</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            6 departments configured for this branch. Departments are organizational entities mapped to one or multiple clinic branches,
            inheriting unified clinical governance while maintaining localized practitioner rosters and room suites.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEPARTMENT_SUMMARY.map((item) => (
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
              <option key={id} value={id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table
          headings={['Department & scope', 'Assigned locations', 'Configured services', 'Staff & practitioners', 'Status', '']}
          minWidth={980}
          empty={rows.length ? null : 'No departments match your filters.'}
        >
          {rows.map((department) => (
            <Row key={department.id} muted={department.status !== 'Active'}>
              <Cell>
                <Link to={pathFor(ROUTES.department, { departmentId: department.id })} className="font-semibold hover:text-brand">
                  {department.name}
                </Link>
                <p className="mt-0.5 text-[11px] text-outline">
                  {department.kind} · <span className="rounded bg-surface-high px-1 py-0.5">{department.scope}</span>
                </p>
                {department.warning && <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{department.warning}</p>}
              </Cell>
              <Cell>
                <p className="font-medium">{department.location}</p>
                <p className={`text-[11px] ${department.exclusive ? 'text-amber-700' : 'text-outline'}`}>{department.locationNote}</p>
              </Cell>
              <Cell>
                <p className="font-medium">{department.services}</p>
                <p className="text-[11px] text-outline">{department.serviceNote}</p>
              </Cell>
              <Cell>
                <p className="font-medium">{department.people}</p>
                <p className="text-[11px] text-outline">{department.peopleNote}</p>
              </Cell>
              <Cell>
                <StatusPill tone={department.status === 'Active' ? 'success' : 'neutral'} dot>
                  {department.status}
                </StatusPill>
              </Cell>
              <Cell>
                <Link to={pathFor(ROUTES.department, { departmentId: department.id })} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                  View <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${DEPARTMENTS.length} mapped departmental profiles · Sync state: Clean`} />
      </div>

      <aside className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-surface-low p-5">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold text-on-surface">Organizational topology</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Departments are organization-level units linked to one or more physical branches. Services, fee structures, and clinical
            protocols defined at the department level cascade down to assigned branches, while room suite allocations and practitioner
            rosters remain branch-specific.
          </p>
        </div>
        <ActionButton to={pathFor(ROUTES.departmentAccess, { departmentId: 'cardiology' })} className="text-brand">
          Configure Role-Based Access (RBAC) by Department
        </ActionButton>
      </aside>
    </ConfigPage>
  )
}
