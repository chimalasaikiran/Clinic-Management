import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import { MembershipStatus } from '../../generated/prisma/client'

@Injectable()
export class MembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.membership.findMany({
      where: { orgId },
      orderBy: { user: { fullName: 'asc' } },
      select: {
        id: true,
        status: true,
        joinedAt: true,
        version: true,
        user: { select: { id: true, fullName: true, email: true } },
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
    })
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.membership.findFirst({ where: { id, orgId } })
  }

  findByUser(orgId: string, userId: string, db: Db = this.prisma) {
    return db.membership.findUnique({ where: { orgId_userId: { orgId, userId } } })
  }

  findByEmail(orgId: string, email: string) {
    return this.prisma.membership.findFirst({ where: { orgId, user: { email } }, select: { status: true } })
  }

  rolesForAssignment(orgId: string, roleIds: string[], db: Db = this.prisma) {
    return db.role.findMany({
      where: { orgId, id: { in: roleIds } },
      select: { id: true, isSystem: true, status: true, scope: true, permissions: { select: { permission: true } }, branches: { select: { branchId: true } } },
    })
  }

  // Serialises membership changes within one organisation, so two admins cannot remove the last two
  // Super Admins at the same moment.
  async lockOrganisation(tx: Tx, orgId: string) {
    await tx.$queryRaw`select id from organisations where id = ${orgId}::uuid for update`
  }

  async replaceRoles(tx: Tx, membershipId: string, roleIds: string[]) {
    const before = await tx.membershipRole.findMany({ where: { membershipId }, select: { roleId: true } })
    await tx.membershipRole.deleteMany({ where: { membershipId } })
    if (roleIds.length) await tx.membershipRole.createMany({ data: roleIds.map((roleId) => ({ membershipId, roleId })) })
    await tx.membership.update({ where: { id: membershipId }, data: { version: { increment: 1 } } })
    return before.map((row) => row.roleId)
  }

  setStatus(tx: Tx, membershipId: string, status: MembershipStatus) {
    return tx.membership.update({ where: { id: membershipId }, data: { status, version: { increment: 1 } } })
  }

  countActiveOwners(tx: Tx, orgId: string) {
    return tx.membership.count({
      where: { orgId, status: 'active', roles: { some: { role: { isSystem: true, status: 'active' } } } },
    })
  }

  create(tx: Tx, data: { orgId: string; userId: string; invitedById: string; roleIds: string[] }) {
    return tx.membership.create({
      data: {
        orgId: data.orgId,
        userId: data.userId,
        status: 'active',
        invitedById: data.invitedById,
        roles: { createMany: { data: data.roleIds.map((roleId) => ({ roleId })) } },
      },
      select: { id: true },
    })
  }

  // A person who was removed earlier and is invited again gets the same membership row back.
  async rejoin(tx: Tx, membershipId: string, invitedById: string, roleIds: string[]) {
    await tx.membership.update({
      where: { id: membershipId },
      data: { status: 'active', invitedById, joinedAt: new Date(), version: { increment: 1 } },
    })
    await tx.membershipRole.deleteMany({ where: { membershipId } })
    if (roleIds.length) await tx.membershipRole.createMany({ data: roleIds.map((roleId) => ({ membershipId, roleId })) })
  }
}
