import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote, RadioCard, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { ACCESS_CANDIDATES, ACCESS_ROLES, ACCESS_TIER_OPTIONS } from '../data/access'
import { validateGrant } from '../validation'

const DEPARTMENT_SCOPES = ['All Main Clinic Departments (Standard Scope)', 'General Medicine', 'Cardiology', 'Pharmacy', 'Administration']

const EMPTY_FORM = { tier: 'work', department: DEPARTMENT_SCOPES[0], justification: '' }

export default function GrantAccessDrawer({ open, onClose }) {
  const [target, setTarget] = useState('users')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitted, setSubmitted] = useState(false)

  const needle = query.trim().toLowerCase()
  const pool = target === 'users' ? ACCESS_CANDIDATES : ACCESS_ROLES
  const candidates = pool.filter((person) => !needle || `${person.name} ${person.detail}`.toLowerCase().includes(needle))
  const errors = submitted ? validateGrant({ selectedCount: selectedIds.length, justification: form.justification }) : {}

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const finish = () => {
    setTarget('users')
    setQuery('')
    setSelectedIds([])
    setForm(EMPTY_FORM)
    setSubmitted(false)
    onClose()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateGrant({ selectedCount: selectedIds.length, justification: form.justification })).length === 0) finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Facility provisioning"
      title="Add access to Main Clinic"
      description="Grant branch access to existing organization users or roles. Does not create new accounts or alter central RBAC."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">{selectedIds.length} entities selected</p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={ShieldCheck} type="submit" form="grant-access-form">
              Grant branch access
            </ActionButton>
          </div>
        </div>
      }
    >
      <form id="grant-access-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Select target type</p>
          <div role="tablist" aria-label="Target type" className="grid grid-cols-2 rounded-md border border-slate-200 bg-surface-low p-0.5">
            {[
              ['users', 'Users (Selected)'],
              ['roles', 'Roles Matrix'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={target === id}
                onClick={() => {
                  setTarget(id)
                  setSelectedIds([])
                  setQuery('')
                }}
                className={cn('rounded py-1.5 text-xs font-medium', target === id ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">{target === 'users' ? 'Organization directory' : 'Role catalogue'}</p>
          <SearchBox
            value={query}
            onChange={setQuery}
            label={target === 'users' ? 'Search organization directory' : 'Search roles'}
            placeholder={target === 'users' ? 'Search by name or staff ID…' : 'Search roles…'}
          />
          <p className="mt-1 mb-3 text-[11px] text-outline">
            {target === 'users'
              ? 'Querying central enterprise staff database (212 total registered personnel).'
              : 'Granting a role gives every current and future holder access to this branch.'}
          </p>
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-outline uppercase">
            {target === 'users' ? 'Directory results (matching query)' : 'Roles available to this branch'}
          </p>
          <ul className="flex flex-col gap-2">
            {candidates.map((person) => (
              <li key={person.id}>
                <CheckRow checked={selectedIds.includes(person.id)} disabled={!person.eligible} lockedChecked={false} onChange={() => toggle(person.id)} label={person.name}>
                  <div className="flex items-start gap-3">
                    <Avatar initials={person.initials ?? 'R'} tone={person.eligible ? 'teal' : 'slate'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                        {person.name}
                        {person.eligible && <StatusPill tone="success">ELIGIBLE</StatusPill>}
                      </p>
                      <p className="text-xs text-on-surface-variant">{person.detail}</p>
                      <p className="text-[11px] text-outline">{person.note}</p>
                    </div>
                  </div>
                </CheckRow>
              </li>
            ))}
            {candidates.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No matches.</li>}
          </ul>
          {errors.selection && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.selection}</p>}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Assign branch access tier</legend>
          <div className="flex flex-col gap-2">
            {ACCESS_TIER_OPTIONS.map((option) => (
              <RadioCard
                key={option.value}
                name="tier"
                value={option.value}
                checked={form.tier === option.value}
                onChange={update}
                title={option.title}
                detail={option.detail}
                badge={option.standard && <StatusPill tone="brand">Standard</StatusPill>}
              />
            ))}
          </div>
        </fieldset>

        <SelectInput label="Department / operational unit" name="department" options={DEPARTMENT_SCOPES} value={form.department} onChange={update} />
        <TextInput
          label="Administrative justification / clinical order"
          name="justification"
          placeholder="Authorized by Medical Superintendent for Q4 clinical rotation…"
          value={form.justification}
          onChange={update}
          error={errors.justification}
        />
        <InfoNote tone="brand" icon={ShieldCheck}>
          Granting branch access does not grant organization-level admin permissions. Access will be effective immediately and log entry
          will sync with central compliance ledger.
        </InfoNote>
      </form>
    </Drawer>
  )
}
