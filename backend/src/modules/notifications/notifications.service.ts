import { Inject, Injectable } from '@nestjs/common'
import type { LiveEvent } from '../../common/realtime/live.service'
import { ENV, Env } from '../../config/env'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { REQUEST_QUEUES } from './live.logic'
import { AppointmentNotice, ChangedBy, Message, noticeTime, patientMessage, RecordNotice, recordMessage, staffMessage } from './notification.logic'
import type { ListNotificationsQuery, MarkReadInput } from './notifications.schemas'

export interface AppointmentChange {
  appointmentId: string
  // Absent for changes that move the queue but are not worth a notification (called in, completed, no-show).
  notice?: AppointmentNotice
  by: ChangedBy
  previousPractitionerId?: string
}

const view = { id: true, kind: true, title: true, body: true, entityType: true, entityId: true, orgId: true, patientId: true, readAt: true, createdAt: true } as const satisfies Prisma.NotificationSelect

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Writes the notifications for an appointment change in the same transaction as the change, and returns the
  // live events to publish once it has committed.
  async appointmentChanged(tx: Tx, change: AppointmentChange): Promise<LiveEvent[]> {
    const row = await tx.appointment.findUniqueOrThrow({
      where: { id: change.appointmentId },
      select: {
        orgId: true,
        branchId: true,
        patientId: true,
        practitionerId: true,
        startsAt: true,
        queueToken: true,
        patient: { select: { fullName: true } },
        practitioner: { select: { displayName: true, membershipId: true } },
        branch: { select: { name: true } },
      },
    })
    const { orgId, branchId, patientId, practitionerId } = row
    const events: LiveEvent[] = [
      { topic: 'appointments', orgId, entityId: change.appointmentId, branchId, patientId, practitionerId, ...(change.previousPractitionerId && { previousPractitionerId: change.previousPractitionerId }) },
    ]
    if (!change.notice) return events

    const facts = { patientName: row.patient.fullName, doctorName: row.practitioner.displayName, branchName: row.branch.name, when: noticeTime(row.startsAt, this.env.CLINIC_TIMEZONE), token: row.queueToken }
    const entry = (message: Message) => ({ orgId, patientId, kind: `appointment_${change.notice}`, entityType: 'appointment', entityId: change.appointmentId, ...message })
    const rows: Prisma.NotificationCreateManyInput[] = []

    const links = await tx.patientLink.findMany({ where: { patientId, revokedAt: null }, select: { accountId: true } })
    if (links.length) {
      const forPatient = entry(patientMessage(change.notice, facts))
      rows.push(...links.map((link) => ({ ...forPatient, accountId: link.accountId })))
    }

    const forStaff = change.by === 'patient' ? staffMessage(change.notice, facts) : null
    if (forStaff) {
      const members = await this.staffWith(tx, orgId, branchId, ['bookings.create'], row.practitioner.membershipId)
      rows.push(...members.map((membershipId) => ({ ...entry(forStaff), membershipId })))
    }

    if (rows.length) {
      const created = await tx.notification.createManyAndReturn({ data: rows, select: { id: true, membershipId: true, accountId: true } })
      events.push(...created.map((item): LiveEvent => ({ topic: 'notifications', orgId, entityId: item.id, ...(item.membershipId ? { membershipId: item.membershipId } : { accountId: item.accountId! }) })))
    }
    return events
  }

  // Active members holding any of `permissions` through a role that covers this branch, plus anyone named.
  private async staffWith(tx: Tx, orgId: string, branchId: string, permissions: readonly string[], alsoMembershipId?: string) {
    const members = await tx.membership.findMany({
      where: {
        orgId,
        status: 'active',
        OR: [
          ...(alsoMembershipId ? [{ id: alsoMembershipId }] : []),
          { roles: { some: { role: { status: 'active', permissions: { some: { permission: { in: [...permissions] } } }, OR: [{ scope: 'org' }, { branches: { some: { branchId } } }] } } } },
        ],
      },
      select: { id: true },
    })
    return members.map((member) => member.id)
  }

  // A refill or help request changed. The message goes to the patient's linked accounts or to the staff who work
  // that queue at the branch; open queues and screens hear about it either way.
  async requestChanged(
    tx: Tx,
    change: {
      orgId: string
      branchId: string
      patientId: string
      kind: 'refill' | 'support'
      entityId: string
      notify?: { to: 'patient' | 'staff'; notice: string; message: Message; opens?: { entityType: string; entityId: string } }
    },
  ): Promise<LiveEvent[]> {
    const { orgId, branchId, patientId, entityId } = change
    const events: LiveEvent[] = [{ topic: 'requests', orgId, entityId, branchId, patientId, kind: change.kind }]
    if (!change.notify) return events
    const entityType = change.kind === 'refill' ? 'refill_request' : 'support_ticket'
    // `opens` points a notice at another record, for example the prescription a refill was for.
    const base = { orgId, patientId, kind: change.notify.notice, entityType, entityId, ...change.notify.opens, ...change.notify.message }
    const rows: Prisma.NotificationCreateManyInput[] =
      change.notify.to === 'patient'
        ? (await tx.patientLink.findMany({ where: { patientId, revokedAt: null }, select: { accountId: true } })).map((link) => ({ ...base, accountId: link.accountId }))
        : (await this.staffWith(tx, orgId, branchId, REQUEST_QUEUES[change.kind])).map((membershipId) => ({ ...base, membershipId }))
    if (rows.length) {
      const created = await tx.notification.createManyAndReturn({ data: rows, select: { id: true, membershipId: true, accountId: true } })
      events.push(...created.map((item): LiveEvent => ({ topic: 'notifications', orgId, entityId: item.id, ...(item.membershipId ? { membershipId: item.membershipId } : { accountId: item.accountId! }) })))
    }
    return events
  }

  // A clinical record changed. With a notice, every account linked to the patient is told; either way open screens
  // hear about it. Call inside the transaction that made the change and publish the result after it commits.
  async recordChanged(tx: Tx, change: { orgId: string; patientId: string; branchId: string; entityType: 'encounter' | 'prescription' | 'order' | 'care_plan'; entityId: string; notice?: RecordNotice }): Promise<LiveEvent[]> {
    const { orgId, patientId, entityId, branchId } = change
    const events: LiveEvent[] = [{ topic: 'records', orgId, entityId, patientId, branchId }]
    if (!change.notice) return events
    const links = await tx.patientLink.findMany({ where: { patientId, revokedAt: null }, select: { accountId: true } })
    if (!links.length) return events
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: change.branchId }, select: { name: true, organisation: { select: { displayName: true } } } })
    const message = recordMessage(change.notice, `${branch.organisation.displayName}, ${branch.name}`)
    const created = await tx.notification.createManyAndReturn({
      data: links.map((link) => ({ orgId, patientId, accountId: link.accountId, kind: change.notice!, entityType: change.entityType, entityId, ...message })),
      select: { id: true, accountId: true },
    })
    events.push(...created.map((item): LiveEvent => ({ topic: 'notifications', orgId, entityId: item.id, accountId: item.accountId! })))
    return events
  }

  // `where` is the recipient's own filter, built by the caller from the signed-in identity.
  async list(where: Prisma.NotificationWhereInput, query: ListNotificationsQuery) {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        // Ids are UUIDv7, so id order is creation order.
        where: { AND: [where, query.cursor ? { id: { lt: query.cursor } } : {}] },
        orderBy: { id: 'desc' },
        take: query.pageSize + 1,
        select: view,
      }),
      this.prisma.notification.count({ where: { AND: [where, { readAt: null }] } }),
    ])
    const items = rows.slice(0, query.pageSize)
    return { items, unread, nextCursor: rows.length > query.pageSize ? items.at(-1)!.id : null }
  }

  async markRead(where: Prisma.NotificationWhereInput, input: MarkReadInput) {
    const { count } = await this.prisma.notification.updateMany({ where: { AND: [where, { readAt: null }, 'ids' in input ? { id: { in: input.ids } } : {}] }, data: { readAt: new Date() } })
    return { marked: count }
  }
}
