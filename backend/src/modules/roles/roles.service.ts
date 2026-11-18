import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { Db, PrismaService } from '../../database/prisma.service'
import { canGrant, isKnownPermission } from '../permissions/permission-catalogue'
import type { CreateRoleInput, UpdateRoleInput } from './roles.schemas'
import { RoleRecord, RolesRepository } from './roles.repository'

const nameTaken = () => conflict('ROLE_NAME_TAKEN', 'A role with this name already exists.')

// The shape the web app's role screens use.
const toView = (role: RoleRecord) => ({
  id: role.id,
  name: role.name,
  category: role.category,
  scope: role.scope,
  isSystem: role.isSystem,
  status: role.status,
  description: role.description,
  version: role.version,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
  createdBy: role.createdBy?.fullName ?? null,
  updatedBy: role.updatedBy?.fullName ?? null,
  permissions: role.permissions.map((entry) => entry.permission).sort(),
  branchIds: role.branches.map((entry) => entry.branchId),
  users: role._count.memberships,
})

export type RoleView = ReturnType<typeof toView>

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RolesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, db?: Db) {
    return (await this.roles.list(orgId, db)).map(toView)
  }

  async get(orgId: string, roleId: string, db?: Db) {
    const role = await this.roles.find(orgId, roleId, db)
    if (!role) throw notFound('Role not found.')
    return toView(role)
  }

  async create(orgId: string, actorUserId: string, input: CreateRoleInput, client: ClientInfo) {
    const values = await this.normalise(orgId, input)
    let roleId: string
    try {
      roleId = await this.prisma.transaction(async (tx) => {
        const { id } = await this.roles.create(tx, orgId, actorUserId, values)
        await this.roles.replaceGrants(tx, id, values.permissions, values.branchIds)
        await this.audit.record(
          { action: 'role.created', entityType: 'role', entityId: id, orgId, actorUserId, details: { name: values.name, permissions: values.permissions, scope: values.scope } },
          client,
          tx,
        )
        return id
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken()
      throw error
    }
    return this.get(orgId, roleId)
  }

  async update(orgId: string, actorUserId: string, roleId: string, input: UpdateRoleInput, client: ClientInfo) {
    const current = await this.get(orgId, roleId)
    if (current.isSystem) throw forbidden('SYSTEM_ROLE_LOCKED', 'System roles cannot be changed.')

    const values = await this.normalise(orgId, {
      name: input.name ?? current.name,
      category: input.category ?? current.category,
      scope: input.scope ?? current.scope,
      branchIds: input.branchIds ?? current.branchIds,
      status: input.status ?? current.status,
      description: input.description ?? current.description,
      permissions: input.permissions ?? current.permissions,
    })

    try {
      await this.prisma.transaction(async (tx) => {
        const changed = await this.roles.updateIfVersion(tx, orgId, roleId, input.version, actorUserId, values)
        if (changed === 0) throw conflict('VERSION_CONFLICT', 'Someone else changed this role. Reload and try again.')
        await this.roles.replaceGrants(tx, roleId, values.permissions, values.branchIds)
        await this.audit.record(
          {
            action: 'role.updated',
            entityType: 'role',
            entityId: roleId,
            orgId,
            actorUserId,
            details: {
              before: { name: current.name, status: current.status, scope: current.scope, permissions: current.permissions, branchIds: current.branchIds },
              after: { name: values.name, status: values.status, scope: values.scope, permissions: values.permissions, branchIds: values.branchIds },
            },
          },
          client,
          tx,
        )
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken()
      throw error
    }
    return this.get(orgId, roleId)
  }

  // Applies the same rules as the role editor in the web app, so a hand-crafted request cannot
  // grant reserved or finance permissions, or point at another organisation's branches.
  private async normalise(orgId: string, input: CreateRoleInput) {
    const permissions = [...new Set(input.permissions)]
    const unknown = permissions.filter((permission) => !isKnownPermission(permission))
    if (unknown.length) throw unprocessable('PERMISSION_UNKNOWN', `Unknown permission: ${unknown.join(', ')}.`)
    const blocked = permissions.filter((permission) => !canGrant({ system: false, scope: input.scope }, permission))
    if (blocked.length) throw unprocessable('PERMISSION_NOT_GRANTABLE', `This role cannot hold: ${blocked.join(', ')}.`)
    if (input.status !== 'draft' && permissions.length === 0) throw unprocessable('PERMISSIONS_REQUIRED', 'Select at least one permission.')

    const branchIds = input.scope === 'branch' ? [...new Set(input.branchIds)] : []
    if (input.scope === 'branch') {
      if (branchIds.length === 0 && input.status !== 'draft') throw unprocessable('BRANCHES_REQUIRED', 'Select at least one branch.')
      if (branchIds.length && (await this.roles.countBranches(orgId, branchIds)) !== branchIds.length) {
        throw unprocessable('BRANCH_UNKNOWN', 'One or more branches do not belong to this organisation.')
      }
    }
    return {
      name: input.name,
      category: input.category,
      scope: input.scope,
      status: input.status,
      description: input.description,
      permissions,
      branchIds,
    }
  }
}
