import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound } from '../../common/errors/app-error'
import { LiveService } from '../../common/realtime/live.service'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { NotificationsService } from '../notifications/notifications.service'
import { PatientLinksService } from '../patient-auth/patient-links.service'
import { statusAfterMessage, supportMessages } from './requests.logic'
import type { OpenTicketInput, PatientListQuery, StaffReplyInput, TicketQueueQuery } from './requests.schemas'

const ticketSelect = {
  id: true,
  orgId: true,
  branchId: true,
  patientId: true,
  reference: true,
  category: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  version: true,
  organisation: { select: { displayName: true } },
  branch: { select: { id: true, name: true } },
  patient: { select: { id: true, fullName: true, mrn: true, mobile: true } },
  _count: { select: { messages: true } },
} as const satisfies Prisma.SupportTicketSelect

const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  authorAccountId: true,
  authorUser: { select: { fullName: true } },
} as const satisfies Prisma.SupportMessageSelect

type TicketRow = Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }>
type MessageRow = Prisma.SupportMessageGetPayload<{ select: typeof messageSelect }>

const closedTicket = () => conflict('TICKET_RESOLVED', 'This request is resolved. Send a new request if you still need help.')

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: PatientLinksService,
    private readonly counters: CountersRepository,
    private readonly notifications: NotificationsService,
    private readonly live: LiveService,
    private readonly audit: AuditService,
  ) {}

  private place(row: TicketRow) {
    return `${row.organisation.displayName}, ${row.branch.name}`
  }

  // ── Patient ──

  // Only requests about records the account can still open.
  private async mine(accountId: string): Promise<Prisma.SupportTicketWhereInput> {
    const patientIds = (await this.links.active(accountId)).map((link) => link.patientId)
    return { accountId, patientId: { in: patientIds } }
  }

  private patientView(row: TicketRow, messages?: MessageRow[]) {
    return {
      id: row.id,
      reference: row.reference,
      category: row.category,
      subject: row.subject,
      status: row.status,
      clinicName: row.organisation.displayName,
      branchName: row.branch.name,
      patientName: row.patient.fullName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
      // Patients see that the clinic replied, not which member of staff.
      ...(messages && { messages: messages.map((message) => ({ id: message.id, body: message.body, by: message.authorAccountId ? ('you' as const) : ('clinic' as const), at: message.createdAt.toISOString() })) }),
    }
  }

  async open(accountId: string, input: OpenTicketInput, client: ClientInfo) {
    const link = await this.prisma.patientLink.findFirst({
      where: { id: input.linkId, accountId, revokedAt: null, organisation: { status: { not: 'suspended' } } },
      select: { orgId: true, patientId: true, patient: { select: { fullName: true, homeBranchId: true } } },
    })
    if (!link) throw notFound('Connected clinic not found.')
    const { orgId, patientId } = link
    const branchId = link.patient.homeBranchId
    const { id, events } = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('HLP-', await this.counters.next(tx, orgId, 'support_reference'))
      const ticket = await tx.supportTicket.create({
        data: { orgId, branchId, patientId, accountId, reference, category: input.category, subject: input.subject, messages: { create: { authorAccountId: accountId, body: input.body } } },
        select: { id: true },
      })
      await this.audit.record({ action: 'support.opened', entityType: 'support_ticket', entityId: ticket.id, orgId, details: { accountId, reference } }, client, tx)
      const events = await this.notifications.requestChanged(tx, {
        orgId, branchId, patientId, kind: 'support', entityId: ticket.id,
        notify: { to: 'staff', notice: 'support_opened', message: supportMessages.opened(link.patient.fullName, reference, input.subject) },
      })
      return { id: ticket.id, events }
    })
    await this.live.publish(events)
    return this.patientTicket(accountId, id)
  }

  async patientTickets(accountId: string, query: PatientListQuery) {
    const where = await this.mine(accountId)
    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: ticketSelect }),
    ])
    return { items: rows.map((row) => this.patientView(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async patientTicket(accountId: string, id: string) {
    const row = await this.prisma.supportTicket.findFirst({ where: { AND: [await this.mine(accountId), { id }] }, select: ticketSelect })
    if (!row) throw notFound('Help request not found.')
    const messages = await this.prisma.supportMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: 'asc' }, select: messageSelect })
    return this.patientView(row, messages)
  }

  async patientMessage(accountId: string, id: string, body: string, client: ClientInfo) {
    const row = await this.prisma.supportTicket.findFirst({ where: { AND: [await this.mine(accountId), { id }] }, select: ticketSelect })
    if (!row) throw notFound('Help request not found.')
    const events = await this.prisma.transaction(async (tx) => {
      const { count } = await tx.supportTicket.updateMany({ where: { id, status: { not: 'resolved' } }, data: { status: statusAfterMessage('patient'), version: { increment: 1 } } })
      if (!count) throw closedTicket()
      await tx.supportMessage.create({ data: { ticketId: id, authorAccountId: accountId, body } })
      await this.audit.record({ action: 'support.patient_replied', entityType: 'support_ticket', entityId: id, orgId: row.orgId, details: { accountId } }, client, tx)
      return this.notifications.requestChanged(tx, {
        orgId: row.orgId, branchId: row.branchId, patientId: row.patientId, kind: 'support', entityId: id,
        notify: { to: 'staff', notice: 'support_patient_replied', message: supportMessages.patientReplied(row.patient.fullName, row.reference) },
      })
    })
    await this.live.publish(events)
    return this.patientTicket(accountId, id)
  }

  // ── Clinic inbox ──

  private scoped(access: AccessContext): Prisma.SupportTicketWhereInput {
    return { orgId: access.orgId, ...(access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  private staffView(row: TicketRow, messages?: MessageRow[]) {
    return {
      id: row.id,
      reference: row.reference,
      category: row.category,
      subject: row.subject,
      status: row.status,
      branch: row.branch,
      patient: row.patient,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      messageCount: row._count.messages,
      version: row.version,
      ...(messages && {
        messages: messages.map((message) => ({
          id: message.id,
          body: message.body,
          by: message.authorAccountId ? ('patient' as const) : ('staff' as const),
          author: message.authorUser?.fullName ?? row.patient.fullName,
          at: message.createdAt.toISOString(),
        })),
      }),
    }
  }

  async queue(access: AccessContext, query: TicketQueueQuery) {
    const status: Prisma.SupportTicketWhereInput =
      query.status === 'all' ? {} : query.status === 'active' ? { status: { in: ['open', 'answered'] } } : { status: query.status }
    const text = query.query
    const where: Prisma.SupportTicketWhereInput = {
      AND: [
        this.scoped(access),
        status,
        query.branchId ? { branchId: query.branchId } : {},
        text
          ? { OR: [{ reference: { contains: text, mode: 'insensitive' } }, { subject: { contains: text, mode: 'insensitive' } }, { patient: { fullName: { contains: text, mode: 'insensitive' } } }, { patient: { mrn: { contains: text, mode: 'insensitive' } } }] }
          : {},
      ],
    }
    const [total, rows, counts] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      // Requests waiting on the clinic first, longest-waiting first.
      this.prisma.supportTicket.findMany({ where, orderBy: [{ status: 'asc' }, { updatedAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: ticketSelect }),
      this.prisma.supportTicket.groupBy({ by: ['status'], where: this.scoped(access), _count: { _all: true } }),
    ])
    const count = (value: string) => counts.find((entry) => entry.status === value)?._count._all ?? 0
    return { items: rows.map((row) => this.staffView(row)), page: query.page, pageSize: query.pageSize, total, counts: { open: count('open'), answered: count('answered'), resolved: count('resolved') } }
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prisma.supportTicket.findFirst({ where: { AND: [this.scoped(access), { id }] }, select: ticketSelect })
    if (!row) throw notFound('Help request not found.')
    return row
  }

  async ticket(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const messages = await this.prisma.supportMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: 'asc' }, select: messageSelect })
    return this.staffView(row, messages)
  }

  async reply(access: AccessContext, id: string, actorUserId: string, input: StaffReplyInput, client: ClientInfo) {
    const row = await this.find(access, id)
    const status = statusAfterMessage('staff', input.resolve)
    const events = await this.prisma.transaction(async (tx) => {
      const { count } = await tx.supportTicket.updateMany({
        where: { id, status: { not: 'resolved' } },
        data: { status, resolvedAt: status === 'resolved' ? new Date() : null, version: { increment: 1 } },
      })
      if (!count) throw conflict('TICKET_RESOLVED', 'This request is resolved. Reopen it to reply.')
      await tx.supportMessage.create({ data: { ticketId: id, authorUserId: actorUserId, body: input.body } })
      await this.audit.record({ action: 'support.replied', entityType: 'support_ticket', entityId: id, orgId: access.orgId, actorUserId, details: { resolved: input.resolve } }, client, tx)
      return this.notifications.requestChanged(tx, {
        orgId: access.orgId, branchId: row.branchId, patientId: row.patientId, kind: 'support', entityId: id,
        notify: { to: 'patient', notice: 'support_answered', message: supportMessages.answered(this.place(row), row.reference) },
      })
    })
    await this.live.publish(events)
    return this.ticket(access, id)
  }

  async setStatus(access: AccessContext, id: string, actorUserId: string, next: 'open' | 'resolved', client: ClientInfo) {
    const row = await this.find(access, id)
    const events = await this.prisma.transaction(async (tx) => {
      const from = next === 'resolved' ? { not: 'resolved' as const } : ('resolved' as const)
      const { count } = await tx.supportTicket.updateMany({ where: { id, status: from }, data: { status: next, resolvedAt: next === 'resolved' ? new Date() : null, version: { increment: 1 } } })
      if (!count) throw conflict('TICKET_STATE', next === 'resolved' ? 'This request is already resolved.' : 'This request is not resolved.')
      await this.audit.record({ action: next === 'resolved' ? 'support.resolved' : 'support.reopened', entityType: 'support_ticket', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
      return this.notifications.requestChanged(tx, {
        orgId: access.orgId, branchId: row.branchId, patientId: row.patientId, kind: 'support', entityId: id,
        ...(next === 'resolved' && { notify: { to: 'patient' as const, notice: 'support_resolved', message: supportMessages.resolved(this.place(row), row.reference) } }),
      })
    })
    await this.live.publish(events)
    return this.ticket(access, id)
  }
}
