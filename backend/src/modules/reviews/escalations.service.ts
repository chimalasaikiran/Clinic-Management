import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { clinicInstant } from '../leads/leads.logic'
import type { EscalationInput, ListEscalationsQuery, UpdateEscalationInput } from './reviews.schemas'
import { ReviewsService } from './reviews.service'

const escalationSelect = {
  id: true, code: true, topic: true, severity: true, dueAt: true, status: true, note: true, resolvedAt: true, version: true, createdAt: true, updatedAt: true,
  review: { select: { id: true, reviewerName: true, rating: true, comment: true, branch: { select: { id: true, name: true } } } },
  owner: { select: { id: true, user: { select: { fullName: true } } } },
  createdBy: { select: { fullName: true } },
} as const satisfies Prisma.EscalationSelect

type EscalationRow = Prisma.EscalationGetPayload<{ select: typeof escalationSelect }>

// Operations follow-up on a review: an owner, a severity and a due time. Resolving one never posts anything public.
@Injectable()
export class EscalationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly reviews: ReviewsService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view(row: EscalationRow, now = new Date()) {
    const { owner, createdBy, ...rest } = row
    return { ...rest, owner: { membershipId: owner.id, name: owner.user.fullName }, createdBy: createdBy.fullName, overdue: row.status !== 'resolved' && row.dueAt < now }
  }

  async list(access: AccessContext, query: ListEscalationsQuery) {
    const text = query.q?.trim()
    const where: Prisma.EscalationWhereInput = {
      orgId: access.orgId,
      review: this.reviews.scopeWhere(access),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerMembershipId: query.ownerId } : {}),
      ...(query.reviewId ? { reviewId: query.reviewId } : {}),
      ...(text ? { OR: [{ code: { contains: text, mode: 'insensitive' } }, { topic: { contains: text, mode: 'insensitive' } }, { note: { contains: text, mode: 'insensitive' } }] } : {}),
    }
    const [total, rows] = await Promise.all([
      this.prisma.escalation.count({ where }),
      this.prisma.escalation.findMany({ where, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: escalationSelect }),
    ])
    const now = new Date()
    return { items: rows.map((row) => this.view(row, now)), page: query.page, pageSize: query.pageSize, total }
  }

  // Members who may own an escalation: anyone who can work leads or run growth.
  async owners(orgId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { orgId, status: 'active', user: { status: 'active' }, roles: { some: { role: { status: 'active', permissions: { some: { permission: { in: ['growth.leads', 'growth.manage'] } } } } } } },
      orderBy: { user: { fullName: 'asc' } },
      select: { id: true, user: { select: { fullName: true } } },
    })
    return rows.map((row) => ({ membershipId: row.id, name: row.user.fullName }))
  }

  async create(access: AccessContext, input: EscalationInput, actorUserId: string, client: ClientInfo) {
    await this.reviews.find(access, input.reviewId)
    await this.assertOwner(access.orgId, input.ownerMembershipId)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('ESC-', await this.counters.next(tx, access.orgId, 'escalation'), 4)
      const created = await tx.escalation.create({
        data: { orgId: access.orgId, code, reviewId: input.reviewId, topic: input.topic, severity: input.severity, ownerMembershipId: input.ownerMembershipId, dueAt: clinicInstant(input.dueDate, input.dueTime, this.env.CLINIC_TIMEZONE), note: input.note, createdById: actorUserId },
        select: { id: true },
      })
      await this.audit.record({ action: 'escalation.created', entityType: 'escalation', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return this.get(access, id)
  }

  async update(access: AccessContext, id: string, input: UpdateEscalationInput, actorUserId: string, client: ClientInfo) {
    const current = await this.get(access, id)
    if (input.ownerMembershipId !== current.owner.membershipId) await this.assertOwner(access.orgId, input.ownerMembershipId)
    const resolving = input.status === 'resolved' && current.status !== 'resolved'
    const { count } = await this.prisma.escalation.updateMany({
      where: { id, orgId: access.orgId, version: input.version },
      data: {
        topic: input.topic, severity: input.severity, ownerMembershipId: input.ownerMembershipId, dueAt: clinicInstant(input.dueDate, input.dueTime, this.env.CLINIC_TIMEZONE), status: input.status, note: input.note,
        resolvedAt: input.status === 'resolved' ? (resolving ? new Date() : current.resolvedAt) : null, updatedAt: new Date(), version: { increment: 1 },
      },
    })
    if (count === 0) throw conflict('ESCALATION_CHANGED', 'Someone else changed this escalation. Reload it and try again.')
    await this.audit.record({ action: 'escalation.updated', entityType: 'escalation', entityId: id, orgId: access.orgId, actorUserId, details: { status: input.status } }, client)
    return this.get(access, id)
  }

  async get(access: AccessContext, id: string) {
    const row = await this.prisma.escalation.findFirst({ where: { id, orgId: access.orgId, review: this.reviews.scopeWhere(access) }, select: escalationSelect })
    if (!row) throw notFound('Escalation not found.')
    return this.view(row)
  }

  private async assertOwner(orgId: string, membershipId: string) {
    if (!(await this.owners(orgId)).some((owner) => owner.membershipId === membershipId)) throw unprocessable('OWNER_NOT_ELIGIBLE', 'Choose an owner who works leads or growth.')
  }
}
