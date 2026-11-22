import { describe, expect, it } from 'vitest'
import { accessLevel, accessRoster, coversBranch } from './access'

const role = (id, overrides) => ({ id, name: id, scope: 'branch', status: 'active', branchIds: [], permissions: ['patients.view'], ...overrides })
const member = (id, roleIds) => ({ id, status: 'active', user: { fullName: id, email: `${id}@clinic.test` }, roles: roleIds.map((roleId) => ({ id: roleId, name: roleId })) })

describe('branch access', () => {
  it('counts organisation-wide roles everywhere and branch roles only where listed', () => {
    expect(coversBranch(role('owner', { scope: 'org' }), 'b1')).toBe(true)
    expect(coversBranch(role('front', { branchIds: ['b1'] }), 'b1')).toBe(true)
    expect(coversBranch(role('front', { branchIds: ['b2'] }), 'b1')).toBe(false)
    expect(coversBranch(role('old', { scope: 'org', status: 'inactive' }), 'b1')).toBe(false)
  })

  it('grades access by the strongest permission held', () => {
    expect(accessLevel(['patients.view', 'settings.roles'])).toBe('Full')
    expect(accessLevel(['patients.view', 'bookings.create'])).toBe('Work')
    expect(accessLevel(['patients.view'])).toBe('View only')
  })

  it('lists each member once with the roles that reach the branch', () => {
    const roles = [role('viewer', { branchIds: ['b1'] }), role('nurse', { branchIds: ['b1'], permissions: ['clinical.write'] }), role('elsewhere', { branchIds: ['b2'], permissions: ['settings.roles'] })]
    const rows = accessRoster([member('asha', ['viewer', 'nurse', 'elsewhere']), member('ravi', ['elsewhere'])], roles, ['b1'])
    expect(rows).toHaveLength(1)
    expect(rows[0].roles.map((entry) => entry.id)).toEqual(['viewer', 'nurse'])
    expect(rows[0].level).toBe('Work')
    expect(rows[0].source).toBe('Branch role')
  })
})
