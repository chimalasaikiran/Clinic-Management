import { useState } from 'react'
import { BadgeCheck, ExternalLink, MoreVertical, UserPlus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import DepartmentPeopleDrawer from '../components/DepartmentPeopleDrawer'
import DetailUnavailable from '../components/DetailUnavailable'
import { DEPARTMENT_STAFF } from '../data/departments'

export default function DepartmentStaffPage() {
  const { departmentId } = useParams()
  const [filterId, setFilterId] = useState('all')
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (departmentId !== 'cardiology') {
    return <DetailUnavailable title="Department staff" backTo={ROUTES.departments} backLabel="Back to departments" />
  }

  const { facts, filters, people } = DEPARTMENT_STAFF
  const activeFilter = filters.find((filter) => filter.id === filterId)
  const needle = query.trim().toLowerCase()
  const rows = people.filter((person) => activeFilter.match(person) && (!needle || `${person.name} ${person.registry}`.toLowerCase().includes(needle)))
  const tabs = filters.map((filter) => ({ id: filter.id, label: filter.label, count: people.filter(filter.match).length }))

  return (
    <ConfigPage>
      <PageIntro
        title="Department Staff"
        description={
          <>
            Manage the doctors and staff associated with this department. Personnel master profiles, credentials, and employment contracts are governed in{' '}
            <Link to={pathFor(ROUTES.branchStaff, { branchId: 'main' })} className="font-medium text-brand hover:underline">Staff & People</Link>.
          </>
        }
        actions={
          <>
            <ActionButton icon={ExternalLink} to={pathFor(ROUTES.branchStaff, { branchId: 'main' })}>Manage staff & doctors</ActionButton>
            <ActionButton variant="primary" icon={UserPlus} onClick={() => setDrawerOpen(true)}>Add people</ActionButton>
          </>
        }
      />

      <dl className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="text-outline">{label}:</dt>
            <dd className="font-medium text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Rostered Department Personnel</h2>
            <FilterTabs options={tabs} value={filterId} onChange={setFilterId} label="Personnel type" className="mt-2" />
          </div>
          <SearchBox value={query} onChange={setQuery} label="Search people" placeholder="Search people by name, registration ID" className="w-72 max-w-full" />
        </div>

        <Table headings={['Person & credentials', 'Type', 'Clinical designation / role', 'Assigned locations', 'Clinical scope / privileges', 'Status', 'Action']} minWidth={980} empty={rows.length ? null : 'No personnel match your search.'}>
          {rows.map((person) => (
            <Row key={person.id} muted={person.derostered}>
              <Cell>
                <div className="flex items-center gap-3">
                  <Avatar initials={person.initials} tone={person.type === 'Doctor' ? 'teal' : 'slate'} />
                  <div>
                    <p className="flex items-center gap-1 font-semibold">
                      {person.name}
                      {person.verified && <BadgeCheck className="size-3.5 text-brand" aria-label="Verified" />}
                    </p>
                    <p className="text-[11px] text-outline">{person.registry}</p>
                  </div>
                </div>
              </Cell>
              <Cell>
                <StatusPill tone={person.type === 'Doctor' ? 'info' : 'neutral'} className="rounded">{person.type}</StatusPill>
                {person.derostered && <p className="mt-1 text-[10px] text-outline">De-rostered</p>}
              </Cell>
              <Cell>
                <p className="font-medium">{person.role}</p>
                <p className="text-[11px] text-outline">{person.credentials}</p>
              </Cell>
              <Cell>
                <span className="flex flex-col items-start gap-1">
                  {person.locations.map((location) => (
                    <span key={location} className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">{location}</span>
                  ))}
                </span>
              </Cell>
              <Cell className="text-xs">{person.scope}</Cell>
              <Cell>
                <StatusPill tone={person.status === 'Active' ? 'success' : 'neutral'} dot>{person.status}</StatusPill>
              </Cell>
              <Cell>
                <button type="button" aria-label={`Actions for ${person.name}`} className="text-outline hover:text-on-surface">
                  <MoreVertical className="size-4" aria-hidden="true" />
                </button>
              </Cell>
            </Row>
          ))}
        </Table>

        <TableFooter summary={`Showing ${rows.length} associated personnel · Association Governance: Cardiology Roster Ver. 4.2`}>
          <span className="text-[11px] text-outline">ABDM HFR Node #HYD-MSP-01</span>
        </TableFooter>
      </div>

      <InfoNote tone="brand" className="mt-5">
        <strong className="text-brand">Department Association Safeguard:</strong> Removing a person from Cardiology removes their department-level scheduling association without modifying their master employment profile, historical encounter signatures, or credentials in other departments.
      </InfoNote>

      <DepartmentPeopleDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ConfigPage>
  )
}
