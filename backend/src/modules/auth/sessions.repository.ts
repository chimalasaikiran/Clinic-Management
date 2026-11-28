import { Injectable } from '@nestjs/common'
import { Db, PrismaService } from '../../database/prisma.service'

export interface NewSession {
  userId: string
  tokenHash: string
  expiresAt: Date
  ip: string | null
  userAgent: string | null
  kind?: 'browser' | 'app'
  deviceName?: string | null
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewSession, db: Db = this.prisma) {
    return db.session.create({ data, select: { id: true } })
  }

  findByTokenHash(tokenHash: string) {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, status: true, emailVerifiedAt: true } } },
    })
  }

  touch(id: string) {
    return this.prisma.session.update({ where: { id }, data: { lastSeenAt: new Date() }, select: { id: true } })
  }

  listActive(userId: string, now: Date) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true, kind: true, deviceName: true },
    })
  }

  revoke(id: string, db: Db = this.prisma) {
    return db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } })
  }

  revokeForUser(userId: string, id: string, db: Db = this.prisma) {
    return db.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } })
  }

  revokeAll(userId: string, options: { except?: string } = {}, db: Db = this.prisma) {
    return db.session.updateMany({
      where: { userId, revokedAt: null, ...(options.except ? { id: { not: options.except } } : {}) },
      data: { revokedAt: new Date() },
    })
  }

  // Keeps the newest `keep` live sessions and revokes the rest.
  async revokeOldest(userId: string, keep: number, db: Db = this.prisma) {
    const surplus = await db.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: keep,
      select: { id: true },
    })
    if (surplus.length) await db.session.updateMany({ where: { id: { in: surplus.map((row) => row.id) } }, data: { revokedAt: new Date() } })
  }

  // Housekeeping: rows that can no longer authenticate anyone.
  deleteFinished(before: Date) {
    return this.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }] } })
  }
}
