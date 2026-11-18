import { Injectable } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import { Db, PrismaService } from '../../database/prisma.service'
import type { ClientInfo } from '../utils/request'

export interface AuditEntry {
  action: string
  entityType: string
  entityId?: string | null
  orgId?: string | null
  actorUserId?: string | null
  details?: Prisma.InputJsonObject
}

// Append-only record of security-relevant events. Pass the transaction so the entry commits with the change.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, client: ClientInfo | null, db: Db = this.prisma) {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        orgId: entry.orgId ?? null,
        actorUserId: entry.actorUserId ?? null,
        details: entry.details ?? {},
        ip: client?.ip ?? null,
        userAgent: client?.userAgent ?? null,
        traceId: client?.traceId ?? null,
      },
    })
  }
}
