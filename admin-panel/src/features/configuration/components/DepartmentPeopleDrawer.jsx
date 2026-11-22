import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { CheckRow, FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { useApiResource } from '../../../hooks/useApiResource'
import { practitionersApi } from '../../patients/api'
import { staffApi } from '../../staff/api'
import { configApi } from '../api'
import { initialsOf } from '../configView'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'doctor', label: 'Doctors' },
  { id: 'staff', label: 'Staff' },
]

// Staff records and doctors' schedule profiles from other departments. Everyone has one department, so adding
// a person here moves them from the department they are in now.
function useCandidates(department, open) {
  const staff = useApiResource(() => (open ? staffApi.list({ pageSize: 100 }) : Promise.resolve(null)), `department-candidates-staff:${department.id}:${open}`)
  const doctors = useApiResource(() => (open ? practitionersApi.list({ status: 'active' }) : Promise.resolve(null)), `department-candidates-doctors:${department.id}:${open}`)
  const same = (name) => name?.toLowerCase() === department.name.toLowerCase()
  const people = [
    ...(staff.data?.data ?? []).filter((person) => person.status !== 'inactive').map((person) => ({ key: `staff:${person.id}`, id: person.id, kind: 'staff', type: person.type, name: person.fullName, detail: person.designation, reference: person.staffCode, from: person.department, locations: person.branches.map((branch) => branch.name), here: same(person.department) })),
    ...(doctors.data ?? []).map((doctor) => ({ key: `doctor:${doctor.id}`, id: doctor.id, kind: 'practitioner', type: 'doctor', name: doctor.displayName, detail: `${doctor.specialty} · schedule profile`, reference: doctor.credentials, from: doctor.department, locations: [], here: same(doctor.department) })),
  ]
  // Schedule profiles need a booking permission; without one the drawer still offers staff records.
  return { people, loading: open && !staff.error && (!staff.data || (!doctors.data && !doctors.error)), error: staff.error }
}

export default function DepartmentPeopleDrawer({ open, onClose, department, onAdded }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [selected, setSelected] = useState([])
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const { people, loading, error } = useCandidates(department, open)

  const needle = query.trim().toLowerCase()
  const candidates = people.filter((person) => !person.here)
  const alreadyAdded = people.filter((person) => person.here)
  const visible = candidates.filter((person) => (tab === 'all' || person.type === tab) && (!needle || `${person.name} ${person.detail} ${person.reference}`.toLowerCase().includes(needle)))
  const count = selected.length

  const toggle = (key) => setSelected((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]))
  const finish = () => {
    setQuery('')
    setTab('all')
    setSelected([])
    setFailure('')
    onClose()
  }
  const add = async () => {
    setPending(true)
    setFailure('')
    const chosen = candidates.filter((person) => selected.includes(person.key))
    try {
      const updated = await configApi.addDepartmentMembers(department.id, {
        staffIds: chosen.filter((person) => person.kind === 'staff').map((person) => person.id),
        practitionerIds: chosen.filter((person) => person.kind === 'practitioner').map((person) => person.id),
      })
      onAdded(updated, count)
      finish()
    } catch (problem) {
      setFailure(problem.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow={`${department.name} · ${department.code}`}
      title={`Add people to ${department.name}`}
      description="Select existing doctors and staff from the organization directory. Master profiles and credentials remain governed in Staff & People."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">
            <strong className="text-on-surface">{count} {count === 1 ? 'person' : 'people'} selected</strong>
            <span className="block text-[11px] text-outline">Moved from their current department</span>
          </p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={UserPlus} disabled={count === 0 || pending} onClick={add}>
              {pending ? 'Adding…' : `Add ${count} ${count === 1 ? 'person' : 'people'} to department`}
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {failure && <Banner tone="danger" title="Not added">{failure}</Banner>}
        <InfoNote tone="brand">
          <strong className="text-brand">One department each:</strong> a person belongs to one department, so adding them here takes them out of the one they are in now. Employment details, pay and credentials do not change.
        </InfoNote>
        <SearchBox value={query} onChange={setQuery} label="Search directory" placeholder="Search people by name or staff code…" />
        <FilterTabs options={TABS} value={tab} onChange={setTab} label="Person type" />
        {loading || error ? (
          <p role={error ? 'alert' : 'status'} className="py-6 text-center text-sm text-on-surface-variant">{error ? error.message : 'Loading the directory…'}</p>
        ) : (
          <>
            <p className="text-[11px] font-semibold tracking-wide text-outline uppercase">Available candidates ({visible.length})</p>
            <ul className="flex flex-col gap-2">
              {visible.map((person) => (
                <li key={person.key}>
                  <CheckRow checked={selected.includes(person.key)} onChange={() => toggle(person.key)} label={person.name}>
                    <div className="flex items-start gap-3">
                      <Avatar initials={initialsOf(person.name)} tone={selected.includes(person.key) ? 'teal' : 'slate'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                          {person.name}
                          <StatusPill tone={person.type === 'doctor' ? 'success' : 'neutral'} className="rounded">{person.type === 'doctor' ? 'Doctor' : 'Staff'}</StatusPill>
                        </p>
                        <p className="text-xs text-on-surface-variant">{person.detail}</p>
                        <p className="text-[11px] text-outline">{[person.reference, person.from ? `now in ${person.from}` : 'no department'].filter(Boolean).join(' · ')}</p>
                        {person.locations.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {person.locations.map((location) => (
                              <span key={location} className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">{location}</span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  </CheckRow>
                </li>
              ))}
              {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No candidates match your search.</li>}
            </ul>

            <p className="mt-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Already in {department.name} ({alreadyAdded.length})</p>
            <ul className="flex flex-col gap-2">
              {alreadyAdded.map((person) => (
                <li key={person.key} className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest px-3 py-2 text-xs opacity-70">
                  {person.name}
                  <StatusPill tone="success">Already Added</StatusPill>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Drawer>
  )
}
