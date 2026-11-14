import { isBlank } from '../../lib/validators'

export function validateRole({ name, category, scope, branchCount, permissionCount, takenNames = [] }, { draft = false } = {}) {
  const errors = {}
  if (isBlank(name)) errors.name = 'Enter the role name.'
  else if (takenNames.some((taken) => taken.toLowerCase() === name.trim().toLowerCase())) errors.name = 'A role with this name already exists.'
  // Drafts only need a unique name; the rest is checked when the role is created.
  if (draft) return errors
  if (isBlank(category)) errors.category = 'Choose a staff category.'
  if (scope === 'branch' && branchCount === 0) errors.branches = 'Select at least one branch.'
  if (permissionCount === 0) errors.permissions = 'Select at least one permission.'
  return errors
}
