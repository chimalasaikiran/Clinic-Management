import { describe, expect, it } from 'vitest'
import { validateRole } from './validation'

describe('validateRole', () => {
  const validRole = { name: 'Clinical Lead', category: 'Physiotherapy', scope: 'branch', branchCount: 2, permissionCount: 5, takenNames: ['Super Admin'] }

  it('accepts a complete role', () => {
    expect(validateRole(validRole)).toEqual({})
  })

  it('requires a category, a branch and a permission', () => {
    expect(validateRole({ ...validRole, category: '', branchCount: 0, permissionCount: 0 })).toEqual({
      category: 'Choose a staff category.',
      branches: 'Select at least one branch.',
      permissions: 'Select at least one permission.',
    })
  })

  it('does not need branches for an org-wide role', () => {
    expect(validateRole({ ...validRole, scope: 'org', branchCount: 0 })).toEqual({})
  })

  it('rejects a blank or duplicate name, ignoring case', () => {
    expect(validateRole({ ...validRole, name: '  ' }).name).toBe('Enter the role name.')
    expect(validateRole({ ...validRole, name: 'super admin ' }).name).toBe('A role with this name already exists.')
  })

  it('only checks the name for a draft', () => {
    expect(validateRole({ name: 'Draft role', category: '', scope: 'branch', branchCount: 0, permissionCount: 0 }, { draft: true })).toEqual({})
  })
})
