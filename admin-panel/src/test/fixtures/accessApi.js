import { vi } from 'vitest'
import { ApiError } from '../../lib/api'
import { ROLES } from './roles'

export const TEST_BRANCHES = [
  { id: 'main', code: 'MAIN', name: 'Main Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
  { id: 'kondapur', code: 'KDP', name: 'Kondapur Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
  { id: 'banjara', code: 'BJH', name: 'Banjara Hills Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
]

const STATUS = { Active: 'active', Inactive: 'inactive', Draft: 'draft' }

const asApiRole = (role) => ({
  id: role.id,
  name: role.name,
  category: role.category,
  scope: role.scope,
  isSystem: Boolean(role.system),
  status: STATUS[role.status],
  description: role.description,
  version: 1,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-24T09:00:00.000Z',
  createdBy: role.createdBy,
  updatedBy: role.modifiedBy,
  permissions: role.permissions,
  branchIds: role.branchIds,
  users: role.users,
})

// An in-memory stand-in for the access endpoints, so role and staff screens can be tested without a server.
// It keeps the server's optimistic-locking and duplicate-name behaviour.
export function createAccessApi() {
  let roles = ROLES.map(asApiRole)
  let sequence = 0

  return {
    roles: vi.fn(async () => roles),
    branches: vi.fn(async () => TEST_BRANCHES),
    createRole: vi.fn(async (values) => {
      if (roles.some((role) => role.name.toLowerCase() === values.name.toLowerCase())) throw new ApiError(409, 'ROLE_NAME_TAKEN', 'A role with this name already exists.')
      sequence += 1
      const role = { ...asApiRole({ ...values, id: `role-${sequence}`, users: 0, createdBy: 'Siddharth Verma', modifiedBy: 'Siddharth Verma', status: 'Active' }), status: values.status }
      roles = [...roles, role]
      return role
    }),
    updateRole: vi.fn(async (id, { version, ...changes }) => {
      const current = roles.find((role) => role.id === id)
      if (current.version !== version) throw new ApiError(409, 'VERSION_CONFLICT', 'Someone else changed this role. Reload and try again.')
      const role = { ...current, ...changes, version: current.version + 1 }
      roles = roles.map((entry) => (entry.id === id ? role : entry))
      return role
    }),
    invite: vi.fn(async (email, roleIds) => ({ id: `invitation-${email}`, email, roleIds, status: 'pending' })),
  }
}
