import { Injectable } from '@nestjs/common'
import { PrismaService, Tx } from '../../database/prisma.service'

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // A new invitation replaces any pending one for the same email.
  revokePending(tx: Tx, orgId: string, email: string) {
    return tx.invitation.updateMany({ where: { orgId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })
  }

  create(tx: Tx, data: { orgId: string; email: string; roleIds: string[]; tokenHash: string; invitedById: string; expiresAt: Date }) {
    return tx.invitation.create({ data, select: { id: true } })
  }

  list(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { invitedBy: { select: { fullName: true } } },
    })
  }

  async revoke(orgId: string, id: string) {
    const { count } = await this.prisma.invitation.updateMany({ where: { id, orgId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })
    return count
  }

  findByTokenHash(tokenHash: string) {
    return this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: { organisation: { select: { displayName: true } }, invitedBy: { select: { fullName: true } } },
    })
  }

  // Locks a still-usable invitation so two parallel accepts cannot both succeed.
  async lockUsable(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id from invitations
      where id = ${id}::uuid and accepted_at is null and revoked_at is null and expires_at > now()
      for update`
    return rows.length > 0
  }

  findById(tx: Tx, id: string) {
    return tx.invitation.findUnique({ where: { id } })
  }

  markAccepted(tx: Tx, id: string, userId: string) {
    return tx.invitation.update({ where: { id }, data: { acceptedAt: new Date(), acceptedById: userId } })
  }

  roleNames(roleIds: string[]) {
    return this.prisma.role.findMany({ where: { id: { in: roleIds } }, select: { name: true }, orderBy: { name: 'asc' } })
  }

  // Roles may have been deactivated since the invitation was sent; only active ones are granted.
  async activeRoleIds(tx: Tx, orgId: string, roleIds: string[]) {
    const rows = await tx.role.findMany({ where: { orgId, id: { in: roleIds }, status: 'active' }, select: { id: true } })
    return rows.map((row) => row.id)
  }
}
