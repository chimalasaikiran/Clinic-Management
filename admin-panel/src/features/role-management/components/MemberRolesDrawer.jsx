import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import { accessApi } from '../../auth/api'

const coverage = (role, branches) => {
  if (role.scope === 'org') return 'Every branch'
  const names = branches.filter((branch) => role.branchIds.includes(branch.id)).map((branch) => branch.name)
  return names.length ? names.join(', ') : 'No branches'
}

// Replaces a person's roles with exactly the ticked ones. The API accepts only active roles, so an inactive
// role they still hold cannot be kept.
export default function MemberRolesDrawer({ member, roles, branches, onClose, onSaved }) {
  const name = member.user.fullName
  const assignable = roles.filter((role) => role.status === 'Active')
  const held = member.roles.map((entry) => entry.id)
  const dropped = member.roles.filter((entry) => !assignable.some((role) => role.id === entry.id))
  const [selected, setSelected] = useState(() => held.filter((id) => assignable.some((role) => role.id === id)))
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')

  const chosen = assignable.filter((role) => selected.includes(role.id))
  const added = chosen.filter((role) => !held.includes(role.id))
  const removed = member.roles.filter((entry) => !selected.includes(entry.id))
  const changed = added.length > 0 || removed.length > 0
  const grantsSystemRole = added.some((role) => role.system)

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setPending(true)
    setFailure('')
    try {
      await accessApi.setMemberRoles(
        member.id,
        chosen.map((role) => role.id),
      )
      onSaved(chosen.length ? `${name} now has: ${chosen.map((role) => role.name).join(', ')}.` : `${name} now has no role.`)
    } catch (error) {
      setFailure(error.message)
      setPending(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Member access"
      title={`Change roles for ${name}`}
      description={`${member.user.email}. They will have exactly the roles ticked here.`}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="brand" type="submit" form="member-roles-form" disabled={!changed || pending}>
            {pending ? 'Saving…' : 'Save roles'}
          </ActionButton>
        </div>
      }
    >
      <form id="member-roles-form" onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {failure && (
          <Banner tone="danger" title="Not saved">
            {failure}
          </Banner>
        )}
        {dropped.length > 0 && (
          <Banner tone="warning" title="Inactive role">
            {dropped.map((entry) => entry.name).join(', ')} is not active, so saving removes it.
          </Banner>
        )}

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-slate-800">Active roles</legend>
          <ul className="flex flex-col gap-2">
            {assignable.map((role) => (
              <li key={role.id}>
                <CheckRow checked={selected.includes(role.id)} onChange={() => toggle(role.id)} label={role.name}>
                  <p className="text-[13px] font-semibold text-on-surface">{role.name}</p>
                  <p className="text-xs text-on-surface-variant">{coverage(role, branches)}</p>
                  {role.description && <p className="mt-0.5 text-[11px] leading-4 text-outline">{role.description}</p>}
                </CheckRow>
              </li>
            ))}
          </ul>
        </fieldset>

        {grantsSystemRole && (
          <Banner tone="warning" title="Full access">
            {added.find((role) => role.system).name} gives unrestricted access to every branch, clinical record and financial ledger.
          </Banner>
        )}
        {chosen.length === 0 && (
          <Banner tone="warning" title="No role">
            With no role, {name} can still sign in but cannot open anything. To block sign-in to this organisation, suspend them instead.
          </Banner>
        )}
        {changed && (
          <div className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs leading-5 text-on-surface-variant" aria-live="polite">
            {added.length > 0 && <p>Adding: {added.map((role) => role.name).join(', ')}</p>}
            {removed.length > 0 && <p>Removing: {removed.map((entry) => entry.name).join(', ')}</p>}
            <p>The change applies from their next request. In the staff app, they may need to sign out and in again.</p>
          </div>
        )}
      </form>
    </Drawer>
  )
}
