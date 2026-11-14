import { PERMISSION_GROUPS } from './data/roles'

// Whether a role may hold a permission. System roles hold everything; custom roles never get
// locked or governance rights, and branch-scoped roles never get financial rights.
export function canGrant({ system, scope }, group, permission) {
  if (system) return true
  if (permission.locked || group.guard === 'restricted') return false
  return !(group.guard === 'finance' && scope === 'branch')
}

export function grantablePermissionIds(role) {
  return PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.filter((permission) => canGrant(role, group, permission)).map((permission) => permission.id),
  )
}

// Drops rights the role can no longer hold, e.g. finance rights after narrowing it to branches.
export function keepGrantable(role, permissionIds) {
  const allowed = new Set(grantablePermissionIds(role))
  return permissionIds.filter((id) => allowed.has(id))
}

export function scopeLabel(role) {
  if (role.scope === 'org') return 'Org-wide'
  const count = role.branchIds.length
  return `Branch-level (${count} ${count === 1 ? 'branch' : 'branches'})`
}
