import { z } from 'zod'
import { uuid } from '../../common/validation/validation'
import { STAFF_CATEGORIES } from '../permissions/permission-catalogue'

const roleFields = {
  name: z.string({ error: 'Enter the role name.' }).trim().min(1, 'Enter the role name.').max(80),
  category: z.enum(STAFF_CATEGORIES as [string, ...string[]], { error: 'Choose a staff category.' }),
  scope: z.enum(['org', 'branch']),
  branchIds: z.array(uuid).max(200),
  status: z.enum(['draft', 'active', 'inactive']),
  description: z.string().trim().max(1000),
  permissions: z.array(z.string().max(64)).max(200),
}

export const createRoleSchema = z.object({
  ...roleFields,
  branchIds: roleFields.branchIds.default([]),
  description: roleFields.description.default(''),
  permissions: roleFields.permissions.default([]),
})
// No defaults here: a field left out of an update keeps its current value.
export const updateRoleSchema = z.object(roleFields).partial().extend({ version: z.number().int().positive() })

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
