import { useState } from 'react'
import { Circle, CircleCheck, Eye, Info, ListChecks, Lock, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Breadcrumb from '../../../components/workspace/Breadcrumb'
import { CheckRow, InfoNote, RadioCard, Toggle } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import { cn } from '../../../lib/cn'
import { GROUP_ICONS } from '../components/roleIcons'
import { useAuth } from '../../auth/context/useAuth'
import { useRoles } from '../context/useRoles'
import { PERMISSION_GROUPS, STAFF_CATEGORIES } from '../data/roles'
import { canGrant, grantablePermissionIds, keepGrantable } from '../rolePermissions'
import { validateRole } from '../validation'

const FINANCE_IDS = PERMISSION_GROUPS.find((group) => group.guard === 'finance').permissions.map((permission) => permission.id)

function ChecklistItem({ done, children }) {
  const Icon = done ? CircleCheck : Circle
  return (
    <li className={cn('flex items-center gap-2 text-xs font-medium', done ? 'text-on-surface' : 'text-outline')}>
      <Icon className={cn('size-3.5 shrink-0', done && 'text-brand')} aria-hidden="true" />
      {children}
      <span className="sr-only">{done ? '(done)' : '(pending)'}</span>
    </li>
  )
}

export default function CreateRolePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { roles, branches, getRole, addRole } = useRoles()
  // Duplicating starts from a copy of the source role, minus rights a custom role cannot hold.
  const source = getRole(location.state?.duplicateOf)
  const initialScope = source && !source.system ? source.scope : source ? 'org' : 'branch'

  const [values, handleChange] = useFormFields({
    name: source ? `${source.name} (Copy)` : '',
    description: source?.description ?? '',
    category: source?.category ?? '',
  })
  const [active, setActive] = useState(true)
  const [scope, setScope] = useState(initialScope)
  const [branchIds, setBranchIds] = useState(source?.branchIds ?? [])
  const [permissions, setPermissions] = useState(source ? keepGrantable({ scope: initialScope }, source.permissions) : [])
  const [submitted, setSubmitted] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const { user, organisation } = useAuth()

  const draftRole = { scope, branchIds }
  const fields = {
    ...values,
    scope,
    branchCount: branchIds.length,
    permissionCount: permissions.length,
    takenNames: roles.map((role) => role.name),
  }
  const errors = submitted ? validateRole(fields, { draft: submitted === 'draft' }) : {}
  const liveErrors = validateRole(fields)
  const ready = Object.keys(liveErrors).length === 0
  const grantableCount = grantablePermissionIds(draftRole).length
  const financeCount = permissions.filter((id) => FINANCE_IDS.includes(id)).length
  const selectedBranches = branches.filter((branch) => branchIds.includes(branch.id))

  const toggle = (setter, id) => setter((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const changeScope = (event) => {
    const next = event.target.value
    setScope(next)
    setPermissions((current) => keepGrantable({ scope: next }, current))
  }

  const setGroup = (ids, on) => setPermissions((current) => (on ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))))

  const save = async (draft) => {
    setSubmitted(draft ? 'draft' : 'create')
    setFailure('')
    if (Object.keys(validateRole(fields, { draft })).length > 0) return
    setSaving(true)
    try {
      const role = await addRole({ ...values, scope, branchIds, permissions, status: draft ? 'Draft' : active ? 'Active' : 'Inactive' })
      navigate(ROUTES.roles, { state: { roleId: role.id } })
    } catch (error) {
      setFailure(error.message)
      setSaving(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    save(false)
  }

  return (
    <WorkspacePage>
      <form onSubmit={handleSubmit} noValidate>
        <Breadcrumb items={[{ label: 'Role management', to: ROUTES.roles }, { label: 'Create role' }]} />
        <PageIntro
          eyebrow={<StatusPill tone="info">Custom role provisioning</StatusPill>}
          title="Create role"
          description="Define the operational role, specify branch-isolated access scopes, and calibrate granular clinical permissions."
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="1 · Basic role information" subtitle="Primary clinical taxonomy and active system state." action={<StatusPill>Required</StatusPill>} bodyClassName="flex flex-col gap-5">
              <TextInput
                label="Role name"
                name="name"
                required
                hint="Shown in staff directories and assignment matrices."
                value={values.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="e.g. Clinical Lead & Area Supervisor"
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-slate-800">
                  Role description <span className="font-normal text-outline">(optional)</span>
                </span>
                <textarea
                  name="description"
                  rows={3}
                  value={values.description}
                  onChange={handleChange}
                  className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectInput
                  label="Staff category"
                  name="category"
                  required
                  placeholder="Choose a category"
                  options={STAFF_CATEGORIES}
                  value={values.category}
                  onChange={handleChange}
                  error={errors.category}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-800">Role state</span>
                  <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest px-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
                      <span className={cn('size-2 rounded-full', active ? 'bg-brand' : 'bg-slate-400')} />
                      {active ? 'Active deployment' : 'Inactive'}
                    </span>
                    <Toggle checked={active} onChange={setActive} label="Role state" />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title="2 · Access scope & branch scoping"
              subtitle="Configure administrative boundary enforcement and geographical segmentation."
              action={<StatusPill>DPDP sandboxed</StatusPill>}
              bodyClassName="flex flex-col gap-4"
            >
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">Access scope</legend>
                <RadioCard
                  name="scope"
                  value="org"
                  checked={scope === 'org'}
                  onChange={changeScope}
                  title="Organization-wide"
                  detail="Unrestricted visibility across all branches and centralized records."
                />
                <RadioCard
                  name="scope"
                  value="branch"
                  checked={scope === 'branch'}
                  onChange={changeScope}
                  title="Specific branches"
                  badge={<StatusPill tone="brand">Recommended</StatusPill>}
                  detail="Strict zero-trust confinement to assigned clinic branches."
                />
              </fieldset>
              {scope === 'branch' && (
                <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                  <p className="mb-3 text-xs font-semibold text-on-surface">Authorized branches (select 1 or more)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {branches.map((branch) => (
                      <CheckRow key={branch.id} checked={branchIds.includes(branch.id)} onChange={() => toggle(setBranchIds, branch.id)} label={branch.name}>
                        <p className="text-[13px] font-semibold text-on-surface">{branch.name}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {branch.code} · {branch.city}
                        </p>
                      </CheckRow>
                    ))}
                  </div>
                  {errors.branches && (
                    <p role="alert" className="mt-2 text-xs text-rose-600">
                      {errors.branches}
                    </p>
                  )}
                  <InfoNote icon={ShieldCheck} className="mt-3 bg-white">
                    Branch-scoped roles are isolated under DPDP Act 2023 guidelines and cannot inspect records outside their assigned branches.
                  </InfoNote>
                </div>
              )}
            </Panel>

            <Panel
              title="3 · Granular permission configuration"
              subtitle="Select specific read, create, and operational rights for this role."
              action={
                <div className="flex items-center gap-2">
                  <StatusPill tone="brand">
                    {permissions.length} of {grantableCount} permissions selected
                  </StatusPill>
                  <ActionButton size="sm" variant="soft" onClick={() => setPermissions([])} disabled={permissions.length === 0}>
                    Clear all
                  </ActionButton>
                </div>
              }
              bodyClassName="flex flex-col gap-3"
            >
              {PERMISSION_GROUPS.map((group) => {
                const GroupIcon = GROUP_ICONS[group.id]
                const grantableIds = group.permissions.filter((permission) => canGrant(draftRole, group, permission)).map((permission) => permission.id)
                const selectedCount = group.permissions.filter((permission) => permissions.includes(permission.id)).length
                const allSelected = grantableIds.length > 0 && grantableIds.every((id) => permissions.includes(id))
                const isFinance = group.guard === 'finance'
                return (
                  <fieldset key={group.id} className={cn('rounded-md border border-slate-200 p-4', (isFinance || !grantableIds.length) && 'bg-surface-lowest')}>
                    <legend className="sr-only">{group.label}</legend>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-on-surface uppercase">
                        <GroupIcon className="size-3.5 text-brand" aria-hidden="true" />
                        {group.label}
                        <StatusPill tone={selectedCount ? 'info' : 'neutral'}>
                          {selectedCount}/{group.permissions.length}
                        </StatusPill>
                      </p>
                      {grantableIds.length ? (
                        <button
                          type="button"
                          onClick={() => setGroup(grantableIds, !allSelected)}
                          aria-label={`${allSelected ? 'Clear' : 'Select all'} ${group.label}`}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          {allSelected ? 'Clear' : 'Select all'}
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-on-surface-variant">{isFinance ? 'Security guard active' : 'Restricted scope'}</span>
                      )}
                    </div>
                    {isFinance && (
                      <InfoNote tone={grantableIds.length ? 'warning' : 'neutral'} icon={ShieldAlert} className="mt-3">
                        {grantableIds.length
                          ? 'Financial rights expose revenue and payment data across all branches. Grant only what this role needs.'
                          : 'Financial rights cannot be granted to branch-scoped roles under the principle of least privilege.'}
                      </InfoNote>
                    )}
                    <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const allowed = grantableIds.includes(permission.id)
                        return (
                          <label
                            key={permission.id}
                            className={cn('flex items-start gap-2 text-[13px]', allowed ? 'cursor-pointer text-on-surface' : 'cursor-not-allowed text-outline')}
                          >
                            <input
                              type="checkbox"
                              checked={permissions.includes(permission.id)}
                              disabled={!allowed}
                              onChange={() => toggle(setPermissions, permission.id)}
                              className="mt-0.5 accent-[#006a61]"
                            />
                            <span>
                              {permission.label}
                              {permission.locked && (
                                <>
                                  <Lock className="ml-1 inline size-3" aria-hidden="true" />
                                  <span className="sr-only"> (system roles only)</span>
                                </>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
              {errors.permissions && (
                <p role="alert" className="text-xs text-rose-600">
                  {errors.permissions}
                </p>
              )}
            </Panel>
          </div>

          <div className="flex flex-col gap-5 lg:sticky lg:top-4">
            <Panel title="Role preview" icon={Eye} action={<StatusPill tone="brand">Live draft</StatusPill>} bodyClassName="flex flex-col gap-4">
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Role title</p>
                <p className="mt-1 text-lg leading-6 font-bold text-on-surface">{values.name.trim() || 'Untitled role'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {values.category && <StatusPill>{values.category}</StatusPill>}
                  <StatusPill tone={active ? 'success' : 'neutral'} dot>
                    {active ? 'Active' : 'Inactive'}
                  </StatusPill>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Operational confinement</p>
                <div className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-xs">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
                  {scope === 'org' ? (
                    <p className="font-semibold text-on-surface">Org-wide access (all {branches.length} branches)</p>
                  ) : (
                    <div>
                      <p className="font-semibold text-on-surface">Branch-level access ({selectedBranches.length})</p>
                      <p className="text-on-surface-variant">{selectedBranches.map((branch) => branch.name).join(', ') || 'No branches selected'}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50/60 px-4 py-3">
                <p className="text-xs font-semibold text-brand">Granted permissions</p>
                <p className="text-2xl font-bold text-brand">{permissions.length}</p>
              </div>
              <InfoNote tone={financeCount ? 'warning' : 'neutral'} icon={ShieldCheck}>
                {financeCount
                  ? `${financeCount} financial ${financeCount === 1 ? 'permission' : 'permissions'} granted. Review before activation.`
                  : 'DPDP Act 2023: zero financial & payroll exposure for this role.'}
              </InfoNote>
            </Panel>

            <Panel title="Compliance validation" icon={ListChecks} bodyClassName="flex flex-col gap-4">
              <ul className="space-y-2">
                <ChecklistItem done={!liveErrors.name}>Role name provided</ChecklistItem>
                <ChecklistItem done={!liveErrors.category}>Staff category assigned</ChecklistItem>
                <ChecklistItem done={!liveErrors.branches}>
                  {scope === 'org' ? 'Access scope defined (org-wide)' : `Access scope defined (${branchIds.length} ${branchIds.length === 1 ? 'branch' : 'branches'})`}
                </ChecklistItem>
                <ChecklistItem done={!liveErrors.permissions}>At least one permission selected</ChecklistItem>
              </ul>
              <InfoNote tone={ready ? 'brand' : 'neutral'} icon={ready ? CircleCheck : Info}>
                {ready ? 'Ready to create role. All mandatory fields are valid.' : 'Complete the items above to create this role.'}
              </InfoNote>
            </Panel>

            <div className="flex flex-col gap-2">
              {failure && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-danger">
                  {failure}
                </p>
              )}
              <ActionButton variant="primary" type="submit" icon={CircleCheck} className="w-full py-2.5" disabled={saving}>
                {saving ? 'Saving…' : 'Create role'}
              </ActionButton>
              <ActionButton onClick={() => save(true)} className="w-full" disabled={saving}>
                Save as draft
              </ActionButton>
              <ActionButton variant="soft" to={ROUTES.roles} className="w-full bg-transparent text-on-surface-variant">
                Cancel &amp; return
              </ActionButton>
            </div>
            <p className="text-center text-[11px] leading-4 text-outline">
              Created by: {user.fullName} ({organisation?.roles.map((role) => role.name).join(', ')})
            </p>
          </div>
        </div>
      </form>
    </WorkspacePage>
  )
}
