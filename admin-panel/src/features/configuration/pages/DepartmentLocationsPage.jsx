import { useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import DepartmentLocationDrawer from '../components/DepartmentLocationDrawer'
import { BRANCH_STATUS, clock12, departmentPayload } from '../configView'

function todaysHours(branch) {
  if (!branch.hours.length) return ['Hours not set', 'Set them on the branch’s operating hours']
  const sessions = branch.hours.filter((session) => session.weekday === new Date().getDay())
  if (!sessions.length) return ['Closed today', `${new Set(branch.hours.map((session) => session.weekday)).size} days a week`]
  return ['Open today', sessions.map((session) => `${clock12(session.start)} – ${clock12(session.end)}`).join(', ')]
}

export default function DepartmentLocationsPage() {
  const { departmentId } = useParams()
  const { can } = useAuth()
  const resource = useApiResource(() => configApi.department(departmentId), `department:${departmentId}`)
  const branchList = useApiResource(() => configApi.branches(), 'config-branches')
  const [query, setQuery] = useState('')
  const [association, setAssociation] = useState('Active')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updated, setUpdated] = useState(null)
  const [message, setMessage] = useState(null)
  const [removing, setRemoving] = useState(null)
  const department = updated?.id === departmentId ? updated : resource.data
  const branches = branchList.data

  if (!department || !branches) {
    return (
      <ConfigPage>
        <PageIntro title={resource.error?.status === 404 ? 'Department not found' : 'Department Locations'} />
        {resource.error?.status !== 404 && <LoadingState label="Loading locations…" error={resource.error ?? branchList.error} onRetry={() => { resource.reload(); branchList.reload() }} />}
      </ConfigPage>
    )
  }

  const manage = can('settings.organisation')
  const linked = new Set(department.branches.map((branch) => branch.id))
  const allRows = branches.map((branch) => ({ ...branch, association: linked.has(branch.id) ? 'Active' : 'Inactive' }))
  const needle = query.trim().toLowerCase()
  const rows = allRows.filter((location) => (association === 'All' || location.association === association) && (!needle || `${location.name} ${location.city} ${location.code}`.toLowerCase().includes(needle)))
  const facts = [
    `${department.name} · ${department.type}`,
    `${department.branches.length} of ${branches.length} branches`,
    `${department.counts.services} services · ${department.counts.doctors + department.counts.staff} people`,
  ]

  const remove = async (branch) => {
    setMessage(null)
    try {
      const next = await configApi.updateDepartment(department.id, departmentPayload(department, { branchIds: department.branches.filter((entry) => entry.id !== branch.id).map((entry) => entry.id) }))
      setUpdated(next)
      setMessage({ tone: 'brand', title: `${department.name} removed from ${branch.name}.` })
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not removed', text: error.message })
    } finally {
      setRemoving(null)
    }
  }

  return (
    <ConfigPage>
      <PageIntro
        title={
          <span className="flex items-center gap-3">
            Department Locations
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-xs font-medium text-on-surface-variant">{department.code}</span>
          </span>
        }
        description={
          <>
            Manage the clinic locations where this department is available. Master branch records, facilities, and licensing are governed in{' '}
            <Link to={ROUTES.organisation} className="font-medium text-brand hover:underline">Organization & Branches</Link>.
          </>
        }
        actions={
          <>
            <ActionButton icon={ExternalLink} to={ROUTES.organisation}>Manage branches</ActionButton>
            {manage && <ActionButton variant="primary" icon={MapPin} onClick={() => setDrawerOpen(true)}>Add location</ActionButton>}
          </>
        }
      />

      {message && <Banner tone={message.tone} title={message.title} className="mb-5">{message.text}</Banner>}

      <ul className="mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-xs text-on-surface-variant">
        {facts.map((fact) => (
          <li key={fact} className="font-medium text-on-surface">{fact}</li>
        ))}
      </ul>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            Associated Clinic Locations <StatusPill>{branches.length} Registered Branches</StatusPill>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchBox value={query} onChange={setQuery} label="Search locations" placeholder="Search by branch name, city, or branch code" className="w-80 max-w-full" />
          <FilterSelect label="Association" value={association === 'All' ? '' : association} onChange={(value) => setAssociation(value || 'All')} allLabel="All associations" options={['Active', 'Inactive']} />
        </div>

        <Table headings={['Location & branch code', 'City / territory', 'Operating status', 'Department status', 'Actions']} minWidth={860} empty={rows.length ? null : 'No locations match your filters.'}>
          {rows.map((location) => {
            const [label, tone] = BRANCH_STATUS[location.status]
            const [hours, hoursNote] = todaysHours(location)
            const active = location.association === 'Active'
            return (
              <Row key={location.id} muted={!active}>
                <Cell>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {location.name}
                    <StatusPill tone={tone}>{location.isPrimary ? 'Primary' : label}</StatusPill>
                  </p>
                  <p className="text-[11px] text-outline">{location.code}{location.addressLine1 ? ` · ${location.addressLine1}` : ''}</p>
                </Cell>
                <Cell>
                  <p>{location.city}</p>
                  <p className="text-[11px] text-outline">{location.state}</p>
                </Cell>
                <Cell>
                  <p className="font-medium text-brand">{hours}</p>
                  <p className="text-[11px] text-outline">{hoursNote}</p>
                </Cell>
                <Cell>
                  <StatusPill tone={active ? 'success' : 'neutral'} dot>{active ? 'Active' : 'Not offered'}</StatusPill>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={pathFor(ROUTES.branch, { branchId: location.id })} className="text-xs font-semibold text-brand hover:underline">Open branch</Link>
                    {manage && active && department.branches.length > 1 && (removing === location.id ? (
                      <>
                        <ActionButton size="sm" variant="danger" onClick={() => remove(location)}>Confirm remove</ActionButton>
                        <ActionButton size="sm" onClick={() => setRemoving(null)}>Keep</ActionButton>
                      </>
                    ) : (
                      <ActionButton size="sm" onClick={() => setRemoving(location.id)}>Remove</ActionButton>
                    ))}
                  </div>
                </Cell>
              </Row>
            )
          })}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${allRows.length} organization branches · ${department.branches.length} active associations`} />
      </div>

      <aside className="mt-5 rounded-lg border border-teal-200 bg-teal-50/60 p-5 text-xs leading-5 text-on-surface-variant">
        <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">Safeguard guarantee</p>
        Removing a location removes {department.name}’s association with that branch. The branch, its services, its staff and past patient encounters are not changed. A department keeps at least one location.
      </aside>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="Removal safety workflow" action={<span className="text-[11px] text-outline">Action verification</span>}>
          <p className="text-xs leading-5 text-on-surface-variant">Removing asks for confirmation on the row first:</p>
          <div className="mt-3 rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs text-on-surface-variant">
            <p className="font-semibold text-on-surface">“Remove {department.name} from a branch?”</p>
            <p className="mt-1">This removes the department’s association with that location. The branch and its other departments remain unchanged.</p>
            <p className="mt-2 flex gap-4 text-[11px] text-brand"><span>✓ No records deleted</span><span>✓ People keep their department</span></p>
          </div>
        </Panel>
        <Panel title="Where this is used">
          <dl className="space-y-2 text-xs">
            {[
              ['Staff & doctor forms', 'Choose from active departments'],
              ['Billing catalogue', `${department.counts.services} services`],
              ['Branch page', 'Lists the departments at each branch'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">{label}</dt>
                <dd className="font-semibold text-brand">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {manage && (
        <DepartmentLocationDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          department={department}
          branches={branches}
          onSaved={(next, title) => {
            setUpdated(next)
            setMessage({ tone: 'brand', title })
          }}
        />
      )}
    </ConfigPage>
  )
}
