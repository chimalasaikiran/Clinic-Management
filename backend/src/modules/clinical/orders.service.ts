import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { LiveService } from '../../common/realtime/live.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { OrderStatus } from '../../generated/prisma/client'
import { NotificationsService } from '../notifications/notifications.service'
import { ClinicalRepository } from './clinical.repository'
import { ClinicalService } from './clinical.service'
import { ClinicianRepository } from './clinician.repository'
import { OrderRow, OrdersRepository } from './orders.repository'
import { ROUTINE_PRIORITY, type CreateOrderInput, type ResultInput, type ReviewInput } from './orders.schemas'

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersRepository,
    private readonly clinical: ClinicalService,
    private readonly clinicalRecords: ClinicalRepository,
    private readonly clinician: ClinicianRepository,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly live: LiveService,
  ) {}

  view = (row: OrderRow) => {
    const reviewed = row.events.find((event) => event.action === 'reviewed')
    return {
      ...row,
      encounter: undefined,
      encounterReference: row.encounter?.reference ?? null,
      result: row.resultSummary ? { summary: row.resultSummary, flag: row.resultFlag } : null,
      review: reviewed ? { outcome: row.reviewOutcome, note: row.reviewNote, by: reviewed.actor.fullName, at: this.clinical.stamp(reviewed.createdAt) } : null,
      resultSummary: undefined,
      resultFlag: undefined,
      reviewOutcome: undefined,
      reviewNote: undefined,
      created: this.clinical.stamp(row.createdAt),
      createdAt: undefined,
      events: row.events.map((event) => ({ id: event.id, action: event.action, note: event.note, actor: event.actor.fullName, at: this.clinical.stamp(event.createdAt) })),
    }
  }

  async forPatient(orgId: string, patientId: string) {
    return (await this.orders.forPatient(orgId, patientId)).map(this.view)
  }

  async create(access: AccessContext, patientId: string, actorUserId: string, input: CreateOrderInput, client: ClientInfo) {
    const scope = await this.clinical.visiblePatient(access, patientId)
    const encounter = input.encounterId ? await this.clinical.openEncounterOf(access.orgId, scope, input.encounterId, patientId) : null
    const branchId = encounter?.branch.id ?? input.branchId!
    if (!encounter && !(await this.prisma.branch.findFirst({ where: { id: branchId, orgId: access.orgId, status: 'active' }, select: { id: true } }))) {
      throw unprocessable('BRANCH_INVALID', 'Choose an active branch of this organisation.')
    }
    const ordering = await this.clinician.of(access.membershipId, actorUserId)
    // Imaging and special diagnostics have no specimen; any laboratory test makes it a lab order.
    const kind = input.items.every((item) => item.category !== 'Laboratory') ? 'imaging' : 'lab'

    const { id, events } = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('ORD-', await this.counters.next(tx, access.orgId, 'order_reference'))
      const created = await this.orders.create(tx, {
        orgId: access.orgId,
        reference,
        patientId,
        encounterId: encounter?.id ?? null,
        branchId,
        orderingName: ordering.department ? `${ordering.name} (${ordering.department})` : ordering.name,
        kind,
        category: [...new Set(input.items.map((item) => item.category))].join(' · '),
        title: input.items.map((item) => item.name).join(' + '),
        indication: input.indication,
        performing: input.items[0]!.destination,
        urgent: input.items.some((item) => item.priority !== ROUTINE_PRIORITY),
        createdById: actorUserId,
        items: { create: input.items.map((item, position) => ({ ...item, position })) },
      })
      await this.orders.addEvent(tx, created.id, 'ordered', actorUserId, encounter ? `Linked to ${encounter.reference}.` : '')
      await this.audit.record({ action: 'order.placed', entityType: 'order', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference, items: input.items.length } }, client, tx)
      return { id: created.id, events: await this.notifications.recordChanged(tx, { orgId: access.orgId, patientId, branchId, entityType: 'order', entityId: created.id }) }
    })
    await this.live.publish(events)
    return this.view((await this.orders.find(access.orgId, id))!)
  }

  // A laboratory specimen was taken; the order is now with the lab.
  async collect(access: AccessContext, id: string, actorUserId: string, note: string, client: ClientInfo) {
    const order = await this.find(access, id)
    if (order.kind !== 'lab') throw unprocessable('NO_SPECIMEN', 'Imaging orders have no specimen to collect.')
    await this.step(access, order, ['ordered'], { status: 'processing', accession: `${order.reference}-S1`, specimenNote: note || null }, 'collected', actorUserId, note, client, 'This order is not waiting for a specimen.')
    return this.view((await this.orders.find(access.orgId, id))!)
  }

  // The result is in. Abnormal and critical results also raise an alert on the chart until a clinician reviews them.
  async recordResult(access: AccessContext, id: string, actorUserId: string, input: ResultInput, client: ClientInfo) {
    const order = await this.find(access, id)
    const from: OrderStatus[] = order.kind === 'lab' ? ['processing'] : ['ordered', 'processing']
    const events = await this.prisma.transaction(async (tx) => {
      if ((await this.orders.advance(tx, id, from, { status: 'awaiting_review', resultSummary: input.summary, resultFlag: input.flag })) === 0) {
        throw conflict('ORDER_STATE', order.kind === 'lab' && order.status === 'ordered' ? 'Collect the specimen before recording a result.' : 'This order already has a result or was cancelled.')
      }
      await this.orders.addEvent(tx, id, 'resulted', actorUserId, `${input.flag}: ${input.summary}`)
      if (input.flag !== 'normal') {
        const critical = input.flag === 'critical'
        await this.clinicalRecords.createAlert(tx, {
          orgId: access.orgId, patientId: order.patientId, orderId: id, kind: critical ? 'RESULT: CRITICAL' : 'RESULT: ABNORMAL',
          title: `${critical ? 'Critical' : 'Abnormal'} result — ${order.title}`, severity: critical ? 'critical' : 'high', detail: input.summary,
          statement: `Order ${order.reference} needs clinician review. Reviewing the result clears this alert.`, createdById: actorUserId,
        })
      }
      await this.audit.record({ action: 'order.resulted', entityType: 'order', entityId: id, orgId: access.orgId, actorUserId, details: { flag: input.flag } }, client, tx)
      // The patient sees that a result exists, not what it says, until a clinician has reviewed it.
      return this.notifications.recordChanged(tx, { orgId: access.orgId, patientId: order.patientId, branchId: order.branch.id, entityType: 'order', entityId: id })
    })
    await this.live.publish(events)
    return this.view((await this.orders.find(access.orgId, id))!)
  }

  // One order, for the result review screen. Hidden (404) unless the patient is in the member's care scope.
  async get(access: AccessContext, id: string) {
    return this.view(await this.find(access, id))
  }

  // Clinician sign-off; resolves the result's alerts in the same transaction.
  async review(access: AccessContext, id: string, actorUserId: string, input: ReviewInput, client: ClientInfo) {
    const order = await this.find(access, id)
    const events = await this.prisma.transaction(async (tx) => {
      if ((await this.orders.advance(tx, id, ['awaiting_review'], { status: 'reviewed', reviewOutcome: input.outcome, reviewNote: input.note })) === 0) {
        throw conflict('ORDER_STATE', 'This order is not awaiting review.')
      }
      await this.orders.addEvent(tx, id, 'reviewed', actorUserId, input.note)
      const cleared = await this.orders.resolveAlerts(tx, id)
      await this.audit.record({ action: 'order.reviewed', entityType: 'order', entityId: id, orgId: access.orgId, actorUserId, details: { reference: order.reference, outcome: input.outcome, alertsResolved: cleared } }, client, tx)
      return this.notifications.recordChanged(tx, { orgId: access.orgId, patientId: order.patientId, branchId: order.branch.id, entityType: 'order', entityId: id, notice: 'result_ready' })
    })
    await this.live.publish(events)
    return this.view((await this.orders.find(access.orgId, id))!)
  }

  async cancel(access: AccessContext, id: string, actorUserId: string, reason: string, client: ClientInfo) {
    const order = await this.find(access, id)
    await this.step(access, order, ['ordered', 'processing'], { status: 'cancelled' }, 'cancelled', actorUserId, reason, client, 'Only orders without a result can be cancelled.')
    return this.view((await this.orders.find(access.orgId, id))!)
  }

  private async step(access: AccessContext, order: OrderRow, from: OrderStatus[], data: Parameters<OrdersRepository['advance']>[3], action: string, actorUserId: string, note: string, client: ClientInfo, refusal: string) {
    const events = await this.prisma.transaction(async (tx) => {
      if ((await this.orders.advance(tx, order.id, from, data)) === 0) throw conflict('ORDER_STATE', refusal)
      await this.orders.addEvent(tx, order.id, action, actorUserId, note)
      await this.audit.record({ action: `order.${action}`, entityType: 'order', entityId: order.id, orgId: access.orgId, actorUserId, details: { reference: order.reference } }, client, tx)
      return this.notifications.recordChanged(tx, { orgId: access.orgId, patientId: order.patientId, branchId: order.branch.id, entityType: 'order', entityId: order.id })
    })
    await this.live.publish(events)
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.orders.find(access.orgId, id)
    if (!row) throw notFound('Order not found.')
    await this.clinical.visiblePatient(access, row.patientId).catch(() => {
      throw notFound('Order not found.')
    })
    return row
  }
}
