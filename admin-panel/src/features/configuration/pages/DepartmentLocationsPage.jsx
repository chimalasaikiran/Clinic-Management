import { useState } from 'react'
import { ExternalLink, MapPin, MoreVertical } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import DepartmentLocationDrawer from '../components/DepartmentLocationDrawer'
import DetailUnavailable from '../components/DetailUnavailable'
import { DEPARTMENT_LOCATIONS } from '../data/departments'

export default function DepartmentLocationsPage() {
  const { departmentId } = useParams()
  const [query, setQuery] = useState('')
  const [association, setAssociation] = useState('Active')
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (departmentId !== 'cardiology') {
    return <DetailUnavailable title="Department locations" backTo={ROUTES.departments} backLabel="Back to departments" />
  }

  const { facts, rows: allRows } = DEPARTMENT_LOCATIONS
  const needle = query.trim().toLowerCase()
  const rows = allRows.filter(
    (location) =>
      (association === 'All' || location.status === association) && (!needle || `${location.name} ${location.address} ${location.code}`.toLowerCase().includes(needle)),
  )

  return (
    <ConfigPage>
      <PageIntro
        title={
          <span className="flex items-center gap-3">
            Department Locations
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-xs font-medium text-on-surface-variant">#DEP-CARD</span>
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
            <ActionButton variant="primary" icon={MapPin} onClick={() => setDrawerOpen(true)}>Add location</ActionButton>
          </>
        }
      />

      <ul className="mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-xs text-on-surface-variant">
        {facts.map((fact) => (
          <li key={fact} className="font-medium text-on-surface">{fact}</li>
        ))}
      </ul>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            Associated Clinic Locations <StatusPill>3 Registered Branches</StatusPill>
          </h2>
          <p className="text-[11px] text-outline">Synchronized across all booking engines</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <SearchBox value={query} onChange={setQuery} label="Search locations" placeholder="Search by branch name, city, or branch code (#HYD-…)" className="w-80 max-w-full" />
          <FilterSelect label="Association" value={association === 'All' ? '' : association} onChange={(value) => setAssociation(value || 'All')} allLabel="All associations" options={['Active', 'Inactive']} />
        </div>

        <Table headings={['Location & branch code', 'City / territory', 'Operating status', 'Services assigned', 'People rostered', 'Department status', 'Actions']} minWidth={1000} empty={rows.length ? null : 'No locations match your filters.'}>
          {rows.map((location) => (
            <Row key={location.id} muted={location.muted}>
              <Cell>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {location.name}
                  <StatusPill tone={location.muted ? 'neutral' : 'success'}>{location.badge}</StatusPill>
                </p>
                <p className="text-[11px] text-outline">{location.code} · {location.address}</p>
              </Cell>
              <Cell>
                <p>{location.city}</p>
                <p className="text-[11px] text-outline">{location.cityNote}</p>
              </Cell>
              <Cell>
                <p className="font-medium text-brand">{location.hours}</p>
                <p className="text-[11px] text-outline">{location.hoursNote}</p>
                {location.hoursDetail && <p className="text-[11px] text-outline">{location.hoursDetail}</p>}
              </Cell>
              <Cell>
                <p className="font-medium">{location.services}</p>
                <p className="text-[11px] text-outline">{location.servicesNote}</p>
              </Cell>
              <Cell>
                <p className="font-medium">{location.people}</p>
                <p className="text-[11px] text-outline">{location.peopleNote}</p>
              </Cell>
              <Cell>
                <StatusPill tone={location.status === 'Active' ? 'success' : 'neutral'} dot>{location.status}</StatusPill>
              </Cell>
              <Cell>
                <Link to={pathFor(ROUTES.branch, { branchId: location.id })} aria-label={`Open ${location.name}`} className="inline-flex text-outline hover:text-on-surface">
                  <MoreVertical className="size-4" aria-hidden="true" />
                </Link>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${allRows.length} configured organization branches · 2 Active associations serving cardiology outpatient and surgical suites`}>
          <span className="text-[11px] text-outline">Rows per page: 10</span>
        </TableFooter>
      </div>

      <aside className="mt-5 rounded-lg border border-teal-200 bg-teal-50/60 p-5 text-xs leading-5 text-on-surface-variant">
        <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          Safeguard guarantee <StatusPill tone="brand">Enterprise vault protected</StatusPill>
        </p>
        Removing a location removes Cardiology's operational association and booking visibility at that specific branch. Master branch facilities, physical chambers, services, and historical patient encounters remain permanently preserved in the organization vault.
      </aside>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="Removal safety workflow preview" action={<span className="text-[11px] text-outline">Action verification</span>}>
          <p className="text-xs leading-5 text-on-surface-variant">
            When removing a department from a location, ClinicOS triggers an atomic uncoupling checklist:
          </p>
          <div className="mt-3 rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs text-on-surface-variant">
            <p className="font-semibold text-on-surface">“Remove Cardiology from Banjara Hills Clinic?”</p>
            <p className="mt-1">This will remove the department's association with this location. The branch and its other department associations will remain unchanged.</p>
            <p className="mt-2 flex gap-4 text-[11px] text-brand"><span>✓ Zero record purges</span><span>✓ Doctor roster reallocation prompt</span></p>
          </div>
        </Panel>
        <Panel title="Multi-branch synchronization status" action={<StatusPill tone="success">Stable</StatusPill>}>
          <dl className="space-y-2 text-xs">
            {[
              ['ABDM Health Facility Registry (HFR) Sync', 'Synchronized (04 mins ago)'],
              ['Real-Time Doctor Roster Availability Engine', 'Latency < 85ms'],
              ['Inter-Branch Chamber Allocation Lock', 'Safe Non-Conflicting'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">{label}</dt>
                <dd className="font-semibold text-brand">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-outline">Branch governance protocol v4.18</p>
        </Panel>
      </div>

      <DepartmentLocationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ConfigPage>
  )
}
