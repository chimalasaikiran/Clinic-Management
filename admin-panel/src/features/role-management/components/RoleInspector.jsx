import { useState } from 'react'
import { Ban, Copy, Info, ListChecks, Lock, Network, Pencil, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote, Toggle } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { BRANCHES } from '../../configuration/data/organisation'
import { PERMISSION_GROUPS } from '../data/roles'
import { canGrant, grantablePermissionIds, scopeLabel } from '../rolePermissions'
import { validateRole } from '../validation'
import { CATEGORY_ICONS, GROUP_ICONS, STATUS_TONES } from './roleIcons'

// Read-only stand-in for <Toggle> while the inspector is not in edit mode.
function SwitchState({ on }) {
  return (
    <span className={cn('relative h-5 w-9 shrink-0 rounded-full', on ? 'bg-brand' : 'bg-slate-300')}>
      <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow', on && 'translate-x-4')} />
      <span className="sr-only">{on ? 'Enabled' : 'Disabled'}</span>
    </span>
  )
}

function groupPill(available, enabled, total) {
  if (available === 0) return { tone: 'danger', text: `0/${total} restricted` }
  if (enabled === available) return { tone: 'success', text: `${enabled}/${available} enabled` }
  return { tone: enabled ? 'info' : 'neutral', text: `${enabled}/${available} enabled` }
}

// Side panel showing one role's scope and permissions. Parents remount it (via `key`) to reset the draft.
export default function RoleInspector({ role, editing, onEdit, onCancel, onSave, onDuplicate }) {
  const [permissions, setPermissions] = useState(role.permissions)
  const [branchIds, setBranchIds] = useState(role.branchIds)
  const [error, setError] = useState('')

  const granted = new Set(editing ? permissions : role.permissions)
  const shownBranchIds = editing ? branchIds : role.branchIds
  const grantable = grantablePermissionIds(role)
  const enabledCount = grantable.filter((id) => granted.has(id)).length
  const Icon = CATEGORY_ICONS[role.category] ?? ShieldCheck

  const toggle = (setter, id) => setter((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const save = () => {
    const errors = validateRole({ ...role, branchCount: branchIds.length, permissionCount: permissions.length })
    const message = errors.branches ?? errors.permissions
    if (message) {
      setError(message)
      return
    }
    onSave({ permissions, branchIds })
  }

  return (
    <section aria-label={`${role.name} inspector`} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-surface-lowest px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-brand">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{role.name}</h2>
              {role.system ? <StatusPill tone="info">Protected</StatusPill> : <StatusPill tone={STATUS_TONES[role.status]}>{role.status}</StatusPill>}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Role inspector &amp; permissions matrix</p>
          </div>
        </div>
        {!role.system && !editing && (
          <ActionButton size="sm" icon={Pencil} onClick={onEdit}>
            Edit
          </ActionButton>
        )}
      </header>

      <div className="flex flex-col gap-5 p-5">
        <p className="rounded-md border border-slate-200 bg-surface-low p-3 text-xs leading-5 text-on-surface-variant">{role.description || 'No description added yet.'}</p>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
              <Network className="size-4 text-brand" aria-hidden="true" />
              Access level &amp; branch scope
            </h3>
            <StatusPill tone="info">{scopeLabel({ ...role, branchIds: shownBranchIds })}</StatusPill>
          </div>
          {role.scope === 'org' ? (
            <InfoNote icon={Info} className="mt-3">
              Org-wide roles see records across all {BRANCHES.length} branches. Use a branch-level role to confine access to specific clinics.
            </InfoNote>
          ) : (
            <div className="mt-3 rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">Authorized branches ({shownBranchIds.length} selected)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {BRANCHES.map((branch) =>
                  editing ? (
                    <CheckRow key={branch.id} checked={branchIds.includes(branch.id)} onChange={() => toggle(setBranchIds, branch.id)} label={branch.name}>
                      <p className="text-xs font-semibold text-on-surface">{branch.name}</p>
                      <p className="text-[11px] text-outline">{branch.abdmNode}</p>
                    </CheckRow>
                  ) : (
                    <div
                      key={branch.id}
                      className={cn(
                        'rounded-md border px-3 py-2',
                        shownBranchIds.includes(branch.id) ? 'border-teal-200 bg-teal-50/60' : 'border-slate-200 text-outline opacity-60',
                      )}
                    >
                      <p className="text-xs font-semibold">{branch.name}</p>
                      <p className="text-[11px] text-outline">{branch.abdmNode}</p>
                    </div>
                  ),
                )}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-on-surface-variant">
                <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
                Branch-level roles cannot view clinical notes or personnel records outside their authorized branches.
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
              <ListChecks className="size-4 text-brand" aria-hidden="true" />
              Granular permission policies
            </h3>
            <p className="text-[11px] font-medium text-on-surface-variant">
              {enabledCount}/{grantable.length} permissions enabled
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {PERMISSION_GROUPS.map((group) => {
              const GroupIcon = GROUP_ICONS[group.id]
              const available = group.permissions.filter((permission) => canGrant(role, group, permission))
              const pill = groupPill(available.length, available.filter((permission) => granted.has(permission.id)).length, group.permissions.length)
              return (
                <div key={group.id} className="overflow-hidden rounded-md border border-slate-200">
                  <div className="flex items-center justify-between gap-2 bg-surface-lowest px-3 py-2">
                    <p className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                      <GroupIcon className="size-3.5 text-on-surface-variant" aria-hidden="true" />
                      {group.label}
                    </p>
                    <StatusPill tone={pill.tone}>{pill.text}</StatusPill>
                  </div>
                  <ul className="divide-y divide-slate-100 px-3">
                    {group.permissions.map((permission) => {
                      const allowed = canGrant(role, group, permission)
                      return (
                        <li key={permission.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                          <span className={cn('flex items-center gap-1', allowed ? 'text-on-surface' : 'text-outline')}>
                            {permission.label}
                            {permission.locked && !role.system && <Lock className="size-3 text-danger" aria-hidden="true" />}
                          </span>
                          {!allowed ? (
                            <span className="text-outline">
                              <Ban className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">Not available for this role</span>
                            </span>
                          ) : editing ? (
                            <Toggle checked={granted.has(permission.id)} onChange={() => toggle(setPermissions, permission.id)} label={permission.label} />
                          ) : (
                            <SwitchState on={granted.has(permission.id)} />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-[11px] leading-5 text-on-surface-variant">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-on-surface">
            <ShieldCheck className="size-3.5 text-brand" aria-hidden="true" />
            Audit trail
          </p>
          <p>
            Created by: <span className="text-on-surface">{role.createdBy}</span>
          </p>
          <p>
            Last modified: <span className="text-on-surface">{role.modifiedOn}</span> by {role.modifiedBy}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
        <ActionButton icon={Copy} onClick={onDuplicate}>
          Duplicate role
        </ActionButton>
        {editing && (
          <div className="flex items-center gap-2">
            <ActionButton variant="soft" onClick={onCancel}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" onClick={save}>
              Save role changes
            </ActionButton>
          </div>
        )}
      </footer>
    </section>
  )
}
