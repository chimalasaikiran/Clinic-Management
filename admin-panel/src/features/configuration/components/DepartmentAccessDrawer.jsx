import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { CheckRow, InfoNote, RadioCard, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { DEPARTMENT_ACCESS } from '../data/departments'

const LEVELS = [
  { value: 'full', title: 'Full access', badge: 'Admin / Lead Authority', detail: 'Can view, schedule, execute clinical encounters, manage department services and configure department-specific settings.' },
  { value: 'work', title: 'Work access', badge: 'Operational Roster', detail: 'Can perform assigned clinical OPD and triage workflows, view roster schedules without configuration rights.' },
  { value: 'view', title: 'View only', badge: 'Read Only', detail: 'Can view department rosters, services catalog, and read-only schedules without chart alteration or triage rights.' },
]

export default function DepartmentAccessDrawer({ open, onClose }) {
  const { candidates } = DEPARTMENT_ACCESS
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [level, setLevel] = useState('work')
  const [submitted, setSubmitted] = useState(false)

  const needle = query.trim().toLowerCase()
  const visible = candidates.filter((entry) => !needle || `${entry.name} ${entry.detail}`.toLowerCase().includes(needle))
  const count = selectedIds.length
  const showError = submitted && count === 0

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const finish = () => {
    setQuery('')
    setSelectedIds([])
    setLevel('work')
    setSubmitted(false)
    onClose()
  }
  const submit = () => {
    setSubmitted(true)
    if (count > 0) finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Cardiology · #DEP-CARD"
      title="Add access to Cardiology"
      description="Select users or roles and define their access to this department."
      width="max-w-xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">{count} principals selected</p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={ShieldCheck} onClick={submit}>
              Add {count} access
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <InfoNote tone="brand" icon={ShieldCheck}>
          <strong className="text-brand">Enterprise RBAC Protocol v4.2:</strong> Department-level assignment only. Does not alter global security role definitions or administrative tenancy credentials.
        </InfoNote>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Grant access to</p>
          <SearchBox value={query} onChange={setQuery} label="Search principals" placeholder="Search users or roles…" />
        </div>
        <ul className="flex flex-col gap-2">
          {visible.map((entry) => (
            <li key={entry.id}>
              <CheckRow checked={selectedIds.includes(entry.id)} disabled={entry.locked} onChange={() => toggle(entry.id)} label={entry.name}>
                <div className="flex items-start gap-3">
                  <Avatar initials={entry.initials || 'R'} tone={entry.role ? 'slate' : 'teal'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                      {entry.name}
                      {entry.tag && <StatusPill tone={entry.locked ? 'neutral' : 'success'}>{entry.tag}</StatusPill>}
                    </p>
                    <p className="text-xs text-on-surface-variant">{entry.detail}</p>
                  </div>
                </div>
              </CheckRow>
            </li>
          ))}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No users or roles match your search.</li>}
        </ul>
        {showError && <p role="alert" className="text-xs text-rose-600">Select at least one user or role.</p>}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Access level</legend>
          <div className="flex flex-col gap-2">
            {LEVELS.map((option) => (
              <RadioCard
                key={option.value}
                name="access-level"
                value={option.value}
                checked={level === option.value}
                onChange={() => setLevel(option.value)}
                title={option.title}
                detail={option.detail}
                badge={<StatusPill>{option.badge}</StatusPill>}
              />
            ))}
          </div>
        </fieldset>
        <InfoNote>Zero-trust audited: modifications will be logged under the signed-in administrator in the immutable RBAC ledger.</InfoNote>
      </div>
    </Drawer>
  )
}
