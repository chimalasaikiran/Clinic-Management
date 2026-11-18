import { Injectable } from '@nestjs/common'
import { Db, PrismaService } from '../../database/prisma.service'

@Injectable()
export class AccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Active memberships in organisations that are not suspended, with each membership's active roles,
  // their permissions and the branches they cover.
  activeMemberships(userId: string, orgId: string | undefined, db: Db = this.prisma) {
    return db.membership.findMany({
      where: { userId, status: 'active', organisation: { status: { not: 'suspended' } }, ...(orgId ? { orgId } : {}) },
      orderBy: { organisation: { displayName: 'asc' } },
      select: {
        id: true,
        organisation: { select: { id: true, displayName: true, status: true } },
        roles: {
          where: { role: { status: 'active' } },
          select: {
            role: {
              select: {
                id: true,
                name: true,
                scope: true,
                isSystem: true,
                permissions: { select: { permission: true } },
                branches: { select: { branchId: true } },
              },
            },
          },
        },
      },
    })
  }
}
