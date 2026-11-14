import { describe, expect, it } from 'vitest'
import { ALL_PERMISSION_IDS } from './data/roles'
import { grantablePermissionIds, keepGrantable, scopeLabel } from './rolePermissions'

describe('role permissions', () => {
  it('lets system roles hold every permission', () => {
    expect(grantablePermissionIds({ system: true, scope: 'org' })).toEqual(ALL_PERMISSION_IDS)
  })

  it('never grants locked or governance rights to custom roles', () => {
    const grantable = grantablePermissionIds({ scope: 'org' })
    expect(grantable).not.toContain('staff.payroll')
    expect(grantable).not.toContain('settings.roles')
    expect(grantable).toContain('accounting.invoices')
  })

  it('drops financial rights when a role is narrowed to branches', () => {
    expect(keepGrantable({ scope: 'branch' }, ['bookings.view', 'accounting.revenue'])).toEqual(['bookings.view'])
  })

  it('describes the scope with the branch count', () => {
    expect(scopeLabel({ scope: 'org', branchIds: [] })).toBe('Org-wide')
    expect(scopeLabel({ scope: 'branch', branchIds: ['main'] })).toBe('Branch-level (1 branch)')
    expect(scopeLabel({ scope: 'branch', branchIds: ['main', 'kondapur'] })).toBe('Branch-level (2 branches)')
  })
})
