import { vi } from 'vitest'
import { ALL_PERMISSION_IDS } from '../features/role-management/data/roles'

// Auth context values for rendering pages in tests. The real AuthProvider talks to the backend;
// page tests only need to say who is signed in and what they may do.
export function authState({ status = 'ready', permissions = ALL_PERMISSION_IDS, roles = [{ id: 'role-owner', name: 'Super Admin' }], ...overrides } = {}) {
  const held = new Set(permissions)
  const can = (permission) => held.has(permission)
  const signedIn = status !== 'signedOut' && status !== 'loading'
  const membership = status === 'ready' ? { membershipId: 'member-1', organisation: { id: 'org-1', name: 'Aura Health', status: 'active' }, roles, permissions, branchScope: 'all' } : null

  return {
    status,
    user: signedIn ? { id: 'user-1', email: 'owner@aura.test', fullName: 'Siddharth Verma', emailVerified: status !== 'unverified' } : null,
    memberships: membership ? [membership] : [],
    orgId: membership?.organisation.id ?? null,
    organisation: membership,
    permissions: held,
    can,
    canAny: (list) => list.some(can),
    endedReason: null,
    error: null,
    signIn: vi.fn(async () => ({ status, can })),
    signOut: vi.fn(async () => {}),
    refresh: vi.fn(async () => ({ status, can })),
    selectOrganisation: vi.fn(),
    ...overrides,
  }
}
