import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { DEPARTMENT_LOCATIONS } from '../data/departments'

export default function DepartmentLocationDrawer({ open, onClose }) {
  const { candidates, alreadyAdded } = DEPARTMENT_LOCATIONS
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const needle = query.trim().toLowerCase()
  const visible = candidates.filter((location) => !needle || `${location.name} ${location.city} ${location.code}`.toLowerCase().includes(needle))
  const count = selectedIds.length

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const selectAll = () => setSelectedIds(visible.map((location) => location.id))
  const finish = () => {
    setQuery('')
    setSelectedIds([])
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Cardiology · #DEP-CARD"
      title="Add location to Cardiology"
      description="Select an existing clinic location where this department should be available."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">{count} {count === 1 ? 'location' : 'locations'} selected</p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={ShieldCheck} disabled={count === 0} onClick={finish}>
              Add {count} {count === 1 ? 'location' : 'locations'} to department
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <InfoNote tone="brand" icon={ShieldCheck}>
          <strong className="text-brand">Safeguard guarantee · Association only:</strong> Adding a location activates Cardiology booking visibility, chamber assignment, and OPD scheduling at the branch without duplicating facility licensing or master infrastructure governed in Organization & Branches.
        </InfoNote>
        <SearchBox value={query} onChange={setQuery} label="Search locations" placeholder="Search locations by branch name, city, or branch code (#HYD-04)…" />
        <FilterTabs options={[{ id: 'all', label: 'All', count: candidates.length }]} value="all" onChange={() => {}} label="Location state" />
        <p className="flex items-center justify-between text-xs text-on-surface-variant">
          Showing {visible.length} eligible clinic branches
          <button type="button" onClick={selectAll} className="font-semibold text-brand hover:underline">Select all ({visible.length})</button>
        </p>
        <ul className="flex flex-col gap-2">
          {visible.map((location) => (
            <li key={location.id}>
              <CheckRow checked={selectedIds.includes(location.id)} onChange={() => toggle(location.id)} label={location.name}>
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
                  {location.name}
                  <StatusPill tone="success">{location.badge}</StatusPill>
                  <span className="ml-auto font-mono text-[11px] font-normal text-outline">{location.code}</span>
                </p>
                <p className="text-xs text-on-surface-variant">{location.city}</p>
                <p className="mt-1 flex justify-between text-[11px] text-outline">
                  <span>{location.hours}</span>
                  <span className="font-medium text-brand">{location.capacity}</span>
                </p>
              </CheckRow>
            </li>
          ))}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No locations match your search.</li>}
        </ul>
        <p className="mt-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Already associated with Cardiology ({alreadyAdded.length})</p>
        <ul className="flex flex-col gap-2">
          {alreadyAdded.map((name) => (
            <li key={name} className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest px-3 py-2 text-xs opacity-70">
              {name}
              <StatusPill tone="success">Already added</StatusPill>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  )
}
