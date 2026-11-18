import { Injectable } from '@nestjs/common'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { RoleTemplate } from '../roles/role-templates'
import { nameKey } from '../roles/roles.repository'

export interface NewOrganisation {
  displayName: string
  facilityType: string
  location: string
  city: string
  state: string
}

@Injectable()
export class OrganisationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // The organisation and its first branch ("MAIN", at the primary location).
  createWithMainBranch(tx: Tx, input: NewOrganisation, createdById: string) {
    return tx.organisation.create({
      data: {
        ...input,
        status: 'active',
        createdById,
        branches: { create: { code: 'MAIN', name: input.location, city: input.city, state: input.state } },
      },
      select: { id: true, branches: { select: { id: true } } },
    })
  }

  // Creates every template role in three statements (roles, their permissions, their branches), so setting up
  // a clinic stays fast even when the database is far away.
  async createRolesFromTemplates(tx: Tx, orgId: string, branchId: string, templates: RoleTemplate[], actorUserId: string) {
    const roles = await tx.role.createManyAndReturn({
      data: templates.map((template) => ({
        orgId,
        name: template.name,
        nameKey: nameKey(template.name),
        category: template.category,
        scope: template.scope,
        isSystem: template.system,
        status: 'active' as const,
        description: template.description,
        createdById: actorUserId,
        updatedById: actorUserId,
      })),
      select: { id: true, name: true },
    })
    const idOf = new Map(roles.map((role) => [role.name, role.id]))
    await tx.rolePermission.createMany({
      data: templates.flatMap((template) => template.permissions.map((permission) => ({ roleId: idOf.get(template.name)!, permission }))),
    })
    const branchRoles = templates.filter((template) => template.scope === 'branch')
    if (branchRoles.length) {
      await tx.roleBranch.createMany({ data: branchRoles.map((template) => ({ roleId: idOf.get(template.name)!, branchId })) })
    }
    return idOf
  }

  addOwner(tx: Tx, orgId: string, userId: string, roleId: string) {
    return tx.membership.create({ data: { orgId, userId, status: 'active', roles: { create: { roleId } } }, select: { id: true } })
  }

  branches(orgId: string) {
    return this.prisma.branch.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, name: true, city: true, state: true, status: true },
    })
  }

  displayName(orgId: string) {
    return this.prisma.organisation.findUnique({ where: { id: orgId }, select: { displayName: true } })
  }
}
