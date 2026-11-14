import { useState } from 'react'
import { Building2, Check, UserPlus } from 'lucide-react'
import { SearchBox } from '../../../components/workspace/controls'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { DIRECTORY } from '../data/staff'

function DirectoryRow({ person, selected, onToggle }) {
  const disabled = Boolean(person.assigned)

  return (
    <li>
      <label
        className={cn(
          'flex items-start gap-3 border-b border-slate-100 px-5 py-3',
          disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-lowest',
          selected && 'border-teal-200 bg-teal-50',
        )}
      >
        <input
          type="checkbox"
          checked={disabled || selected}
          disabled={disabled}
          onChange={() => onToggle(person.id)}
          aria-label={person.name}
          className="mt-2.5 accent-[#006a61]"
        />
        <Avatar initials={person.initials} tone={selected || disabled ? 'teal' : 'slate'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-on-surface">
              {person.name}{' '}
              <StatusPill tone={person.type === 'Doctor' ? 'success' : 'neutral'} className="ml-1 rounded">
                {person.type}
              </StatusPill>
            </p>
            <span className="shrink-0 font-mono text-[11px] text-outline">{person.regNo}</span>
          </div>
          <p className="text-xs leading-4 text-on-surface-variant">{person.headline}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-on-surface-variant">
            {disabled ? <Check className="size-3" aria-hidden="true" /> : <Building2 className="size-3" aria-hidden="true" />}
            {person.assignment}
          </p>
          {person.note && <p className="mt-1 text-[11px] text-brand">{person.note}</p>}
        </div>
      </label>
    </li>
  )
}

// Slide-over for assigning directory people to the branch. Selection is local until an API exists.
export default function AddPeopleDrawer({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const needle = query.trim().toLowerCase()
  const people = DIRECTORY.filter((person) => !needle || `${person.name} ${person.headline} ${person.regNo}`.toLowerCase().includes(needle))
  const selected = DIRECTORY.filter((person) => selectedIds.includes(person.id))
  const noun = selected.length === 1 ? 'person' : 'people'

  const toggle = (id) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const finish = () => {
    setSelectedIds([])
    setQuery('')
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Branch assignment · Main Clinic (HYD-HQ-01)"
      title="Add people to Main Clinic"
      description="Select existing staff and doctors from the St. Jude Surgical Health System directory to assign to this branch. Cross-branch assignment preserves existing affiliations."
      footer={
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="flex -space-x-2">
                {selected.slice(0, 3).map((person) => (
                  <Avatar key={person.id} initials={person.initials} tone="teal" size="sm" className="ring-2 ring-white" />
                ))}
              </span>
              {selected.length} {noun} selected
            </p>
            <div className="flex gap-2">
              <ActionButton onClick={finish}>Cancel</ActionButton>
              <ActionButton variant="primary" icon={UserPlus} disabled={selected.length === 0} onClick={finish}>
                Add {selected.length} {noun}
              </ActionButton>
            </div>
          </div>
          <p className="mt-2 text-right text-[11px] text-outline">Assigned staff can immediately be scheduled in Main Clinic OPD calendars.</p>
        </>
      }
    >
      <div className="border-b border-slate-200 px-5 py-3">
        <p className="rounded-md border border-slate-200 bg-surface-lowest p-2.5 text-xs leading-4 text-on-surface-variant">
          <strong className="text-on-surface">Preserved affiliations:</strong> Assigning a person to Main Clinic does not remove them from
          existing branch rosters or revoke central privileges.
        </p>
        <SearchBox value={query} onChange={setQuery} label="Search directory" placeholder="Search by name, role, or designation…" className="mt-3" />
        <p className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
          Showing {people.length} people from organization directory
          <StatusPill tone="success">{selected.length} selected</StatusPill>
        </p>
      </div>

      <ul>
        {people.map((person) => (
          <DirectoryRow key={person.id} person={person} selected={selectedIds.includes(person.id)} onToggle={toggle} />
        ))}
        {people.length === 0 && <li className="px-5 py-10 text-center text-sm text-on-surface-variant">No one in the directory matches your search.</li>}
      </ul>
    </Drawer>
  )
}
