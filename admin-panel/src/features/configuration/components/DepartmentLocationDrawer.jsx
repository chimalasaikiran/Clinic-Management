import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { configApi } from '../api'
import { BRANCH_STATUS, branchAddress, departmentPayload } from '../configView'

export default function DepartmentLocationDrawer({ open, onClose, department, branches, onSaved }) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)

  const linked = new Set(department.branches.map((branch) => branch.id))
  const candidates = branches.filter((branch) => !linked.has(branch.id) && branch.status !== 'inactive')
  const needle = query.trim().toLowerCase()
  const visible = candidates.filter((location) => !needle || `${location.name} ${location.city} ${location.code}`.toLowerCase().includes(needle))
  const count = selectedIds.length

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const selectAll = () => setSelectedIds(visible.map((location) => location.id))
  const finish = () => {
    setQuery('')
    setSelectedIds([])
    setFailure('')
    onClose()
  }
  const save = async () => {
    setPending(true)
    setFailure('')
    try {
      const updated = await configApi.updateDepartment(department.id, departmentPayload(department, { branchIds: [...linked, ...selectedIds] }))
      onSaved(updated, `${count} ${count === 1 ? 'location' : 'locations'} added to ${department.name}.`)
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
      eyebrow={`${department.name} · ${department.code}`}
      title={`Add location to ${department.name}`}
      description="Select an existing clinic location where this department should be available."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">{count} {count === 1 ? 'location' : 'locations'} selected</p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={ShieldCheck} disabled={count === 0 || pending} onClick={save}>
              {pending ? 'Saving…' : `Add ${count} ${count === 1 ? 'location' : 'locations'} to department`}
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {failure && <Banner tone="danger" title="Not saved">{failure}</Banner>}
        <InfoNote tone="brand" icon={ShieldCheck}>
          <strong className="text-brand">Association only:</strong> Adding a location makes {department.name} available at that branch. The branch record itself does not change.
        </InfoNote>
        <SearchBox value={query} onChange={setQuery} label="Search locations" placeholder="Search locations by branch name, city, or branch code…" />
        <p className="flex items-center justify-between text-xs text-on-surface-variant">
          Showing {visible.length} eligible clinic branches
          {visible.length > 0 && <button type="button" onClick={selectAll} className="font-semibold text-brand hover:underline">Select all ({visible.length})</button>}
        </p>
        <ul className="flex flex-col gap-2">
          {visible.map((location) => (
            <li key={location.id}>
              <CheckRow checked={selectedIds.includes(location.id)} onChange={() => toggle(location.id)} label={location.name}>
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
                  {location.name}
                  <StatusPill tone={BRANCH_STATUS[location.status][1]}>{BRANCH_STATUS[location.status][0]}</StatusPill>
                  <span className="ml-auto font-mono text-[11px] font-normal text-outline">{location.code}</span>
                </p>
                <p className="text-xs text-on-surface-variant">{branchAddress(location)}</p>
              </CheckRow>
            </li>
          ))}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">{candidates.length ? 'No locations match your search.' : `${department.name} is already at every open branch.`}</li>}
        </ul>
        <p className="mt-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Already associated with {department.name} ({department.branches.length})</p>
        <ul className="flex flex-col gap-2">
          {department.branches.map((branch) => (
            <li key={branch.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest px-3 py-2 text-xs opacity-70">
              {branch.name}
              <StatusPill tone="success">Already added</StatusPill>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  )
}
