import { useState } from 'react'
import { ExternalLink, UserPlus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import DepartmentPeopleDrawer from '../components/DepartmentPeopleDrawer'
import { initialsOf } from '../configView'

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'doctor', label: 'Doctors', match: (person) => person.type === 'doctor' },
  { id: 'staff', label: 'Staff', match: (person) => person.type === 'staff' },
  { id: 'schedule', label: 'Doctor schedules', match: (person) => person.kind === 'schedule' },
]
const STATUS_LABEL = { active: 'Active', draft: 'Draft', inactive: 'Inactive', on_leave: 'On leave' }

// Staff records (doctors and staff) and doctors' schedule profiles that name this department.
function peopleOf(department) {
  return [
    ...department.staff.map((person) => ({ key: `staff:${person.id}`, kind: 'record', type: person.type, name: person.fullName, reference: person.staffCode, role: person.designation, status: person.status, to: pathFor(ROUTES.staffMember, { staffId: person.id }) })),
    ...department.doctors.map((doctor) => ({ key: `doctor:${doctor.id}`, kind: 'schedule', type: 'schedule', name: doctor.displayName, reference: 'Schedule profile', role: doctor.specialty, status: doctor.status, to: null })),
  ]
}

export default function DepartmentStaffPage() {
  const { departmentId } = useParams()
  const { can } = useAuth()
  const resource = useApiResource(() => configApi.department(departmentId), `department:${departmentId}`)
  const [filterId, setFilterId] = useState('all')
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [updated, setUpdated] = useState(null)
  const department = updated?.id === departmentId ? updated : resource.data

  if (!department) {
    return (
      <ConfigPage>
        <PageIntro title={resource.error?.status === 404 ? 'Department not found' : 'Department Staff'} />
        {resource.error?.status !== 404 && <LoadingState label="Loading department staff…" error={resource.error} onRetry={resource.reload} />}
      </ConfigPage>
    )
  }

  const people = peopleOf(department)
  const activeFilter = FILTERS.find((filter) => filter.id === filterId)
  const needle = query.trim().toLowerCase()
  const rows = people.filter((person) => activeFilter.match(person) && (!needle || `${person.name} ${person.reference}`.toLowerCase().includes(needle)))
  const tabs = FILTERS.map((filter) => ({ id: filter.id, label: filter.label, count: people.filter(filter.match).length }))
  const facts = [
    ['Department', `${department.name} (${department.code})`],
    ['Operates at', department.branches.map((branch) => branch.name).join(', ') || 'No branch'],
    ['Staff records', `${department.staff.filter((person) => person.type === 'doctor').length} doctors · ${department.staff.filter((person) => person.type === 'staff').length} staff`],
    ['Doctor schedules', `${department.doctors.length} schedule profile${department.doctors.length === 1 ? '' : 's'}`],
  ]

  return (
    <ConfigPage>
      <PageIntro
        title="Department Staff"
        description={
          <>
            Manage the doctors and staff associated with this department. Personnel master profiles, credentials, and employment contracts are governed in{' '}
            <Link to={ROUTES.staffDirectory} className="font-medium text-brand hover:underline">Staff & People</Link>.
          </>
        }
        actions={
          <>
            <ActionButton icon={ExternalLink} to={ROUTES.staffDirectory}>Manage staff & doctors</ActionButton>
            {can('settings.organisation') && department.status === 'active' && <ActionButton variant="primary" icon={UserPlus} onClick={() => setDrawerOpen(true)}>Add people</ActionButton>}
          </>
        }
      />

      {notice && <Banner tone="brand" title={notice} className="mb-5" />}

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
          <SearchBox value={query} onChange={setQuery} label="Search people" placeholder="Search people by name or staff code" className="w-72 max-w-full" />
        </div>

        <Table headings={['Person', 'Type', 'Designation / specialty', 'Status', 'Action']} minWidth={760} empty={rows.length ? null : people.length ? 'No personnel match your search.' : 'No one is in this department yet.'}>
          {rows.map((person) => (
            <Row key={person.key} muted={person.status === 'inactive'}>
              <Cell>
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(person.name)} tone={person.type === 'staff' ? 'slate' : 'teal'} />
                  <div>
                    <p className="font-semibold">{person.name}</p>
                    <p className="text-[11px] text-outline">{person.reference}</p>
                  </div>
                </div>
              </Cell>
              <Cell>
                <StatusPill tone={person.type === 'staff' ? 'neutral' : 'info'} className="rounded">{person.type === 'staff' ? 'Staff' : 'Doctor'}</StatusPill>
              </Cell>
              <Cell><p className="font-medium">{person.role || '—'}</p></Cell>
              <Cell>
                <StatusPill tone={person.status === 'active' ? 'success' : 'neutral'} dot>{STATUS_LABEL[person.status] ?? person.status}</StatusPill>
              </Cell>
              <Cell>
                {person.to ? <Link to={person.to} className="text-xs font-semibold text-brand hover:underline">Open profile</Link> : <Link to={ROUTES.appointments} className="text-xs font-semibold text-brand hover:underline">Availability</Link>}
              </Cell>
            </Row>
          ))}
        </Table>

        <TableFooter summary={`Showing ${rows.length} of ${people.length} associated personnel`} />
      </div>

      <InfoNote tone="brand" className="mt-5">
        <strong className="text-brand">One department each:</strong> every staff record and doctor schedule belongs to one department. To move someone out of {department.name}, add them to another department or change it on their profile.
      </InfoNote>

      <DepartmentPeopleDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        department={department}
        onAdded={(next, count) => {
          setUpdated(next)
          setNotice(`${count} ${count === 1 ? 'person' : 'people'} added to ${next.name}.`)
        }}
      />
    </ConfigPage>
  )
}
