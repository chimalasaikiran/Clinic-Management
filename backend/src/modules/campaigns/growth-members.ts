import type { PrismaService } from '../../database/prisma.service'

// Active members who may own a campaign or workflow: they hold "Run campaigns & patient messaging".
export async function growthMembers(prisma: PrismaService, orgId: string) {
  const rows = await prisma.membership.findMany({
    where: { orgId, status: 'active', user: { status: 'active' }, roles: { some: { role: { status: 'active', permissions: { some: { permission: 'growth.manage' } } } } } },
    orderBy: { user: { fullName: 'asc' } },
    select: { id: true, user: { select: { fullName: true } } },
  })
  return rows.map((row) => ({ membershipId: row.id, name: row.user.fullName }))
}
