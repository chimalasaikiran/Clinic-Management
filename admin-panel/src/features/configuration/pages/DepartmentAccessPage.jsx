import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, SearchBox, Toggle } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import ConfigPage from '../components/ConfigPage'
import DepartmentAccessDrawer from '../components/DepartmentAccessDrawer'
import DetailUnavailable from '../components/DetailUnavailable'
import { DEPARTMENT_ACCESS } from '../data/departments'

const LEVEL_TONES = { 'Full access': 'success', 'Work access': 'warning', 'View only': 'neutral' }

export default function DepartmentAccessPage() {
  const { departmentId } = useParams()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modes, setModes] = useState(() => Object.fromEntries(DEPARTMENT_ACCESS.modes.map((mode) => [mode.id, mode.on])))

  if (departmentId !== 'cardiology') {
    return <DetailUnavailable title="Access & permissions" backTo={ROUTES.departments} backLabel="Back to departments" />
  }

  const { summary, principals, capabilities } = DEPARTMENT_ACCESS
  const needle = query.trim().toLowerCase()
  const rows = principals.filter((entry) => (!level || entry.level === level) && (!needle || `${entry.name} ${entry.detail}`.toLowerCase().includes(needle)))

  return (
    <ConfigPage>
      <PageIntro
        title="Access & Permissions"
        description="Control which users and roles can access this department and what they can do within it."
        actions={
          <>
            <ActionButton to={pathFor(ROUTES.department, { departmentId })}>Discard</ActionButton>
            <ActionButton variant="primary" disabled>Save changes</ActionButton>
          </>
        }
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

      <Panel title="Department access policy & inheritance" action={<StatusPill>Policy: Strict RBAC</StatusPill>} className="mb-5">
        <p className="text-xs leading-5 text-on-surface-variant">
          Grant the appropriate organization or branch roles inherit baseline access. Department-specific grants provide elevated clinical work, scheduling privileges, or administrative governance.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {DEPARTMENT_ACCESS.modes.map((mode) => (
            <div key={mode.id} className={cn('flex items-start justify-between gap-3 rounded-md border p-3', modes[mode.id] ? 'border-brand bg-teal-50/50' : 'border-slate-200')}>
              <div>
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
                  {mode.title}
                  <StatusPill tone={modes[mode.id] ? 'success' : 'neutral'}>{modes[mode.id] ? mode.badge : 'OFF'}</StatusPill>
                </p>
                <p className="mt-1 text-xs leading-4 text-on-surface-variant">{mode.detail}</p>
              </div>
              <Toggle checked={modes[mode.id]} onChange={(value) => setModes((current) => ({ ...current, [mode.id]: value }))} label={mode.title} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            Principals with Department Access <StatusPill>{principals.length} entities</StatusPill>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={query} onChange={setQuery} label="Search principals" placeholder="Search users or roles…" className="w-56" />
            <FilterSelect label="Access level" value={level} onChange={setLevel} allLabel="All Levels" options={Object.keys(LEVEL_TONES)} />
            <ActionButton variant="primary" size="sm" icon={UserPlus} onClick={() => setDrawerOpen(true)}>Add access</ActionButton>
          </div>
        </div>

        <Table headings={['User / role', 'Principal type', 'Access level', 'Scope & origin', 'Department status', 'Actions']} minWidth={900} empty={rows.length ? null : 'No principals match your filters.'}>
          {rows.map((entry) => (
            <Row key={entry.id}>
              <Cell>
                <div className="flex items-center gap-3">
                  <Avatar initials={entry.initials || 'R'} tone={entry.initials ? 'teal' : 'slate'} size="sm" />
                  <div>
                    <p className="font-semibold">{entry.name}</p>
                    <p className="text-[11px] text-outline">{entry.detail}</p>
                  </div>
                </div>
              </Cell>
              <Cell><StatusPill className="rounded">{entry.kind}</StatusPill></Cell>
              <Cell><StatusPill tone={LEVEL_TONES[entry.level]}>{entry.level}</StatusPill></Cell>
              <Cell>
                <p className="font-medium">{entry.scope}</p>
                <p className="text-[11px] text-outline">{entry.scopeNote}</p>
              </Cell>
              <Cell>
                <StatusPill tone="success" dot>Active</StatusPill>
                <p className="text-[11px] text-outline">{entry.modified}</p>
              </Cell>
              <Cell>
                <button type="button" className="text-xs font-medium text-brand hover:underline">Edit</button>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Displaying all ${rows.length} configured principals for Cardiology.`}>
          <span className="text-[11px] text-outline">Encrypted RBAC Ledger</span>
        </TableFooter>
      </div>

      <Panel title="Department granular capability matrix" subtitle="Explicit entitlement resolution for operations performed within Cardiology department resources." action={<StatusPill>RBAC v4.2 Spec</StatusPill>} className="mt-5" bodyClassName="p-0">
        <Table headings={['Capability', 'Full access', 'Work access', 'View only']} minWidth={640}>
          {capabilities.map(([name, ...cells]) => (
            <Row key={name}>
              <Cell>{name}</Cell>
              {cells.map((value, index) => (
                <Cell key={index} className={cn('text-xs font-semibold', value.startsWith('Allowed') ? 'text-brand' : 'text-outline')}>{value}</Cell>
              ))}
            </Row>
          ))}
        </Table>
      </Panel>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="Zero-data loss guarantee & audit continuity">
          <p className="text-xs leading-5 text-on-surface-variant">
            Removing or modifying department access does not delete or alter historical records, past encounters, completed clinical notes, prescriptions, or billing ledger events signed by that person. Historical records remain preserved under HIPAA & ABDM rules.
          </p>
        </Panel>
        <Panel title="Administrative lockout protection">
          <p className="text-xs leading-5 text-on-surface-variant">
            The primary organization administrator (Dr. Siddharth Verma, MD) maintains immutable supervisory access to prevent accidental lockout. All access and role changes are continuously logged into the Sovereign immutable audit trail.
          </p>
          <Link to={pathFor(ROUTES.department, { departmentId })} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Back to department</Link>
        </Panel>
      </div>

      <DepartmentAccessDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ConfigPage>
  )
}
