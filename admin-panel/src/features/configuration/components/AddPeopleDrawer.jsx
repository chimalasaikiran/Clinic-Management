import { useState } from 'react'
import { Building2, Check, UserPlus } from 'lucide-react'
import { SearchBox } from '../../../components/workspace/controls'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { staffApi } from '../../staff/api'
import { initialsOf } from '../configView'

function DirectoryRow({ person, selected, onToggle }) {
  const disabled = person.assigned

  return (
    <li>
      <label
        className={cn(
          'flex items-start gap-3 border-b border-slate-100 px-5 py-3',
          disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-lowest',
          selected && 'border-teal-200 bg-teal-50',
        )}
      >
        <input type="checkbox" checked={disabled || selected} disabled={disabled} onChange={() => onToggle(person.id)} aria-label={person.fullName} className="mt-2.5 accent-brand" />
        <Avatar initials={initialsOf(person.fullName)} tone={selected || disabled ? 'teal' : 'slate'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-on-surface">
              {person.fullName}{' '}
              <StatusPill tone={person.type === 'doctor' ? 'success' : 'neutral'} className="ml-1 rounded">{person.type === 'doctor' ? 'Doctor' : 'Staff'}</StatusPill>
            </p>
            <span className="shrink-0 font-mono text-[11px] text-outline">{person.staffCode}</span>
          </div>
          <p className="text-xs leading-4 text-on-surface-variant">{[person.designation, person.department].filter(Boolean).join(' · ')}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-on-surface-variant">
            {disabled ? <Check className="size-3" aria-hidden="true" /> : <Building2 className="size-3" aria-hidden="true" />}
            {disabled ? 'Already at this branch' : person.branches.length ? person.branches.map((branch) => branch.name).join(', ') : 'Not deployed to a branch'}
          </p>
        </div>
      </label>
    </li>
  )
}

// Deploys directory people to the branch; their other branches stay as they are.
export default function AddPeopleDrawer({ open, onClose, branch, onAdded }) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const directory = useApiResource(() => (open ? staffApi.list({ pageSize: 100 }) : Promise.resolve(null)), `branch-directory:${branch.id}:${open}`)

  const all = (directory.data?.data ?? []).filter((person) => person.status !== 'inactive').map((person) => ({ ...person, assigned: person.branches.some((entry) => entry.id === branch.id) }))
  const needle = query.trim().toLowerCase()
  const people = all.filter((person) => !needle || `${person.fullName} ${person.designation} ${person.staffCode}`.toLowerCase().includes(needle))
  const selected = all.filter((person) => selectedIds.includes(person.id))
  const noun = selected.length === 1 ? 'person' : 'people'

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const finish = () => {
    setSelectedIds([])
    setQuery('')
    setFailure('')
    onClose()
  }
  const add = async () => {
    setPending(true)
    setFailure('')
    try {
      for (const person of selected) {
        const primary = person.branches.find((entry) => entry.isPrimary)?.id ?? branch.id
        await staffApi.setBranches(person.id, [...person.branches.map((entry) => entry.id), branch.id], primary)
      }
      onAdded(`${selected.length} ${noun} added to ${branch.name}.`)
      finish()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow={`Branch assignment · ${branch.name} (${branch.code})`}
      title={`Add people to ${branch.name}`}
      description="Select existing staff and doctors from the organization directory to assign to this branch. Cross-branch assignment preserves existing affiliations."
      footer={
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="flex -space-x-2">
                {selected.slice(0, 3).map((person) => (
                  <Avatar key={person.id} initials={initialsOf(person.fullName)} tone="teal" size="sm" className="ring-2 ring-white" />
                ))}
              </span>
              {selected.length} {noun} selected
            </p>
            <div className="flex gap-2">
              <ActionButton onClick={finish}>Cancel</ActionButton>
              <ActionButton variant="primary" icon={UserPlus} disabled={selected.length === 0 || pending} onClick={add}>
                {pending ? 'Adding…' : `Add ${selected.length} ${noun}`}
              </ActionButton>
            </div>
          </div>
          <p className="mt-2 text-right text-[11px] text-outline">Doctors still need availability at this branch before patients can book them here.</p>
        </>
      }
    >
      <div className="border-b border-slate-200 px-5 py-3">
        {failure && <Banner tone="danger" title="Not added" className="mb-3">{failure}</Banner>}
        <p className="rounded-md border border-slate-200 bg-surface-lowest p-2.5 text-xs leading-4 text-on-surface-variant">
          <strong className="text-on-surface">Preserved affiliations:</strong> Assigning a person to {branch.name} does not remove them from other branches or change their primary branch.
        </p>
        <SearchBox value={query} onChange={setQuery} label="Search directory" placeholder="Search by name, staff code, or designation…" className="mt-3" />
        <p className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
          {directory.data ? `Showing ${people.length} people from organization directory` : directory.error ? directory.error.message : 'Loading the directory…'}
          <StatusPill tone="success">{selected.length} selected</StatusPill>
        </p>
      </div>

      <ul>
        {people.map((person) => (
          <DirectoryRow key={person.id} person={person} selected={selectedIds.includes(person.id)} onToggle={toggle} />
        ))}
        {directory.data && people.length === 0 && <li className="px-5 py-10 text-center text-sm text-on-surface-variant">No one in the directory matches your search.</li>}
      </ul>
    </Drawer>
  )
}
