import { useState } from 'react'
import { BadgeCheck, UserPlus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { CheckRow, FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { DEPARTMENT_STAFF } from '../data/departments'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Doctor', label: 'Doctors' },
  { id: 'Staff', label: 'Staff' },
]

export default function DepartmentPeopleDrawer({ open, onClose }) {
  const { candidates, alreadyAdded } = DEPARTMENT_STAFF
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])

  const needle = query.trim().toLowerCase()
  const visible = candidates.filter((person) => (tab === 'all' || person.type === tab) && (!needle || `${person.name} ${person.detail}`.toLowerCase().includes(needle)))
  const count = selectedIds.length

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const finish = () => {
    setQuery('')
    setTab('all')
    setSelectedIds([])
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Cardiology · #DEP-CARD"
      title="Add people to Cardiology"
      description="Select existing doctors and staff from the organization directory to associate with this department. Master profiles and credentials remain governed in Staff & People."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">
            <strong className="text-on-surface">{count} {count === 1 ? 'person' : 'people'} selected</strong>
            <span className="block text-[11px] text-outline">Will be linked to Cardiology scheduling</span>
          </p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={UserPlus} disabled={count === 0} onClick={finish}>
              Add {count} {count === 1 ? 'person' : 'people'} to department
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <InfoNote tone="brand">
          <strong className="text-brand">Association only:</strong> Adding personnel links them to Cardiology appointment scheduling and clinical rosters without altering employment contracts, compensation, or master credentials.
        </InfoNote>
        <SearchBox value={query} onChange={setQuery} label="Search directory" placeholder="Search people by name or registration ID…" />
        <FilterTabs options={TABS} value={tab} onChange={setTab} label="Person type" />
        <p className="text-[11px] font-semibold tracking-wide text-outline uppercase">Available candidates ({visible.length})</p>
        <ul className="flex flex-col gap-2">
          {visible.map((person) => (
            <li key={person.id}>
              <CheckRow checked={selectedIds.includes(person.id)} onChange={() => toggle(person.id)} label={person.name}>
                <div className="flex items-start gap-3">
                  <Avatar initials={person.initials} tone={selectedIds.includes(person.id) ? 'teal' : 'slate'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                      <span className="flex items-center gap-1">
                        {person.name}
                        {person.verified && <BadgeCheck className="size-3.5 text-brand" aria-label="Verified" />}
                      </span>
                      <StatusPill tone={person.type === 'Doctor' ? 'success' : 'neutral'} className="rounded">{person.type}</StatusPill>
                    </p>
                    <p className="text-xs text-on-surface-variant">{person.detail}</p>
                    <p className="text-[11px] text-outline">{person.registry}</p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {person.locations.map((location) => (
                        <span key={location} className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">{location}</span>
                      ))}
                    </p>
                  </div>
                </div>
              </CheckRow>
            </li>
          ))}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No candidates match your search.</li>}
        </ul>

        <p className="mt-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Already associated with Cardiology ({alreadyAdded.length})</p>
        <ul className="flex flex-col gap-2">
          {alreadyAdded.map((name) => (
            <li key={name} className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest px-3 py-2 text-xs opacity-70">
              {name}
              <StatusPill tone="success">Already Added</StatusPill>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  )
}
