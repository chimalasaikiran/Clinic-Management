import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import { Prisma, RoleScope, RoleStatus } from '../../generated/prisma/client'

const roleView = {
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
  permissions: { select: { permission: true } },
  branches: { select: { branchId: true } },
  _count: { select: { memberships: { where: { membership: { status: 'active' } } } } },
} satisfies Prisma.RoleInclude

export type RoleRecord = Prisma.RoleGetPayload<{ include: typeof roleView }>

export interface RoleValues {
  name: string
  category: string
  scope: RoleScope
  status: RoleStatus
  description: string
}

export const nameKey = (name: string) => name.trim().toLowerCase()

// Only the role's own columns. Callers often hold the full request (with permissions and branches, which live
// in their own tables), so the fields are picked rather than spread.
const columns = ({ name, category, scope, status, description }: RoleValues) => ({ name, category, scope, status, description, nameKey: nameKey(name) })

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string, db: Db = this.prisma): Promise<RoleRecord[]> {
    return db.role.findMany({
      where: { orgId },
      include: roleView,
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { name: 'asc' }],
    })
  }

  find(orgId: string, id: string, db: Db = this.prisma): Promise<RoleRecord | null> {
    return db.role.findFirst({ where: { id, orgId }, include: roleView })
  }

  countBranches(orgId: string, branchIds: string[]) {
    return this.prisma.branch.count({ where: { orgId, id: { in: branchIds } } })
  }

  create(tx: Tx, orgId: string, actorUserId: string, values: RoleValues & { isSystem?: boolean }) {
    return tx.role.create({
      data: { ...columns(values), isSystem: values.isSystem, orgId, createdById: actorUserId, updatedById: actorUserId },
      select: { id: true },
    })
  }

  // Optimistic locking: only updates when the caller saw the latest version. Returns the number of rows changed.
  async updateIfVersion(tx: Tx, orgId: string, id: string, version: number, actorUserId: string, values: RoleValues) {
    const { count } = await tx.role.updateMany({
      where: { id, orgId, version },
      data: { ...columns(values), updatedById: actorUserId, version: { increment: 1 } },
    })
    return count
  }

  async replaceGrants(tx: Tx, roleId: string, permissions: string[], branchIds: string[]) {
    await tx.rolePermission.deleteMany({ where: { roleId } })
    await tx.roleBranch.deleteMany({ where: { roleId } })
    if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId, permission })) })
    if (branchIds.length) await tx.roleBranch.createMany({ data: branchIds.map((branchId) => ({ roleId, branchId })) })
  }
}
