import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { CheckRow, InfoNote, RadioCard, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { accessApi } from '../../auth/api'
import { accessLevel, coversBranch } from '../access'
import { initialsOf } from '../configView'

// Two ways in: give people a role that already covers this branch, or extend a branch-limited role to it.
export default function GrantAccessDrawer({ open, onClose, branch, roles, members, onGranted }) {
  const [target, setTarget] = useState('users')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [roleId, setRoleId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)

  const covering = roles.filter((role) => coversBranch(role, branch.id) && !role.isSystem)
  const extendable = roles.filter((role) => role.status === 'active' && role.scope === 'branch' && !role.isSystem && !role.branchIds.includes(branch.id))
  const needle = query.trim().toLowerCase()
  const people = members
    .filter((member) => member.status === 'active')
    .map((member) => ({ id: member.id, name: member.user.fullName, detail: member.user.email, note: member.roles.map((entry) => entry.name).join(', ') || 'No roles', eligible: !roleId || !member.roles.some((entry) => entry.id === roleId) }))
  const roleRows = extendable.map((role) => ({ id: role.id, name: role.name, detail: `${accessLevel(role.permissions)} · ${role.permissions.length} permissions`, note: `${role.branchIds.length} branch${role.branchIds.length === 1 ? '' : 'es'} today`, eligible: true }))
  const pool = target === 'users' ? people : roleRows
  const candidates = pool.filter((entry) => !needle || `${entry.name} ${entry.detail}`.toLowerCase().includes(needle))
  const errors = submitted ? { ...(selectedIds.length ? {} : { selection: target === 'users' ? 'Select at least one person.' : 'Select at least one role.' }), ...(target === 'users' && !roleId ? { role: 'Choose the role to give them.' } : {}) } : {}

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const finish = () => {
    setTarget('users')
    setQuery('')
    setSelectedIds([])
    setRoleId('')
    setSubmitted(false)
    setFailure('')
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (!selectedIds.length || (target === 'users' && !roleId)) return
    setPending(true)
    try {
      if (target === 'users') {
        for (const member of members.filter((entry) => selectedIds.includes(entry.id))) {
          await accessApi.setMemberRoles(member.id, [...new Set([...member.roles.map((entry) => entry.id), roleId])])
        }
      } else {
        for (const role of extendable.filter((entry) => selectedIds.includes(entry.id))) {
          await accessApi.updateRole(role.id, { branchIds: [...role.branchIds, branch.id], version: role.version })
        }
      }
      const count = selectedIds.length
      onGranted(target === 'users' ? `${count} ${count === 1 ? 'person' : 'people'} given ${covering.find((role) => role.id === roleId)?.name}.` : `${count} role${count === 1 ? '' : 's'} now cover ${branch.name}.`)
      finish()
    } catch (error) {
      setFailure(error.message)
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Facility provisioning"
      title={`Add access to ${branch.name}`}
      description="Grant branch access to existing organization users or roles. Does not create new accounts."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">{selectedIds.length} selected</p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={ShieldCheck} type="submit" form="grant-access-form" disabled={pending}>
              {pending ? 'Granting…' : 'Grant branch access'}
            </ActionButton>
          </div>
        </div>
      }
    >
      <form id="grant-access-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        {failure && <Banner tone="danger" title="Not granted">{failure}</Banner>}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Select target type</p>
          <div role="tablist" aria-label="Target type" className="grid grid-cols-2 rounded-md border border-slate-200 bg-surface-low p-0.5">
            {[
              ['users', 'People'],
              ['roles', 'Branch roles'],
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
                  setSubmitted(false)
                }}
                className={cn('rounded py-1.5 text-xs font-medium', target === id ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {target === 'users' && (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Role to give them</legend>
            <div className="flex flex-col gap-2">
              {covering.map((role) => (
                <RadioCard key={role.id} name="role" value={role.id} checked={roleId === role.id} onChange={() => setRoleId(role.id)} title={role.name} detail={`${accessLevel(role.permissions)} · ${role.scope === 'org' ? 'every branch' : `${role.branchIds.length} branch${role.branchIds.length === 1 ? '' : 'es'}`}`} />
              ))}
              {covering.length === 0 && <p className="text-xs text-on-surface-variant">No assignable role covers this branch yet. Extend a branch role first.</p>}
            </div>
            {errors.role && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.role}</p>}
          </fieldset>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">{target === 'users' ? 'Organization members' : 'Branch-limited roles not covering this branch'}</p>
          <SearchBox value={query} onChange={setQuery} label={target === 'users' ? 'Search organization members' : 'Search roles'} placeholder={target === 'users' ? 'Search by name or email…' : 'Search roles…'} />
          <p className="mt-1 mb-3 text-[11px] text-outline">
            {target === 'users' ? 'The role is added to the roles each person already has.' : 'Extending a role gives every current and future holder access to this branch.'}
          </p>
          <ul className="flex flex-col gap-2">
            {candidates.map((entry) => (
              <li key={entry.id}>
                <CheckRow checked={selectedIds.includes(entry.id)} disabled={!entry.eligible} onChange={() => toggle(entry.id)} label={entry.name}>
                  <div className="flex items-start gap-3">
                    <Avatar initials={initialsOf(entry.name) || 'R'} tone={entry.eligible ? 'teal' : 'slate'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                        {entry.name}
                        {!entry.eligible && <StatusPill>Has this role</StatusPill>}
                      </p>
                      <p className="text-xs text-on-surface-variant">{entry.detail}</p>
                      <p className="text-[11px] text-outline">{entry.note}</p>
                    </div>
                  </div>
                </CheckRow>
              </li>
            ))}
            {candidates.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No matches.</li>}
          </ul>
          {errors.selection && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.selection}</p>}
        </div>

        <InfoNote tone="brand" icon={ShieldCheck}>
          Access takes effect at the person’s next request and is recorded in the audit log. System roles (such as Owner) are not changed here.
        </InfoNote>
      </form>
    </Drawer>
  )
}
