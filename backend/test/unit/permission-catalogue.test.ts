import { describe, expect, it } from 'vitest'
import { generateCode, generateToken, hashesMatch, keyedHash } from '../../src/common/utils/crypto'
import { ALL_PERMISSION_IDS, canGrant, PERMISSION_GROUPS, STAFF_CATEGORIES } from '../../src/modules/permissions/permission-catalogue'
import { ROLE_TEMPLATES } from '../../src/modules/roles/role-templates'

// The web app's copy of the catalogue; the two must not drift.
const WEB_CATALOGUE = new URL('../../../admin-panel/src/features/role-management/data/roles.js', import.meta.url).href

describe('permission catalogue', () => {
  it('matches the web app catalogue exactly', async () => {
    const web = (await import(WEB_CATALOGUE)) as { PERMISSION_GROUPS: unknown; STAFF_CATEGORIES: string[] }
    const shape = (groups: typeof PERMISSION_GROUPS) =>
      groups.map((group) => ({ id: group.id, guard: group.guard, permissions: group.permissions.map((p) => ({ id: p.id, locked: Boolean(p.locked) })) }))
    expect(shape(web.PERMISSION_GROUPS as typeof PERMISSION_GROUPS)).toEqual(shape(PERMISSION_GROUPS))
    expect(web.STAFF_CATEGORIES).toEqual(STAFF_CATEGORIES)
  })

  it('has unique ids', () => {
    expect(new Set(ALL_PERMISSION_IDS).size).toBe(ALL_PERMISSION_IDS.length)
  })

  it('reserves locked and governance permissions for system roles and keeps finance off branch roles', () => {
    expect(canGrant({ system: true, scope: 'org' }, 'staff.payroll')).toBe(true)
    expect(canGrant({ system: false, scope: 'org' }, 'staff.payroll')).toBe(false)
    expect(canGrant({ system: false, scope: 'org' }, 'settings.roles')).toBe(false)
    expect(canGrant({ system: false, scope: 'branch' }, 'accounting.invoices')).toBe(false)
    expect(canGrant({ system: false, scope: 'org' }, 'accounting.invoices')).toBe(true)
    expect(canGrant({ system: false, scope: 'org' }, 'made.up')).toBe(false)
  })

  it('only seeds default roles that pass the grant rules', () => {
    for (const template of ROLE_TEMPLATES) {
      for (const permission of template.permissions) expect(canGrant(template, permission), `${template.name}: ${permission}`).toBe(true)
      expect(STAFF_CATEGORIES).toContain(template.category)
    }
  })
})

describe('codes and tokens', () => {
  it('generates 6-digit codes and 256-bit URL-safe tokens', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/)
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateToken()).not.toBe(generateToken())
  })

  it('compares keyed hashes in constant time', () => {
    const hash = keyedHash('pepper', 'value')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashesMatch(hash, keyedHash('pepper', 'value'))).toBe(true)
    expect(hashesMatch(hash, keyedHash('other', 'value'))).toBe(false)
    expect(hashesMatch(hash, 'abcd')).toBe(false)
  })
})
