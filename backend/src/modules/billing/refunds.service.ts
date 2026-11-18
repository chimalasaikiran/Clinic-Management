import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { RefundStatus } from '../../generated/prisma/client'
import { BalancesRepository } from './balances.repository'
import type { CreateRefundInput } from './billing.schemas'
import { FinanceSupport } from './finance.support'
import { rupees, toPaise } from './money'

const inr = (paise: number) => `₹${rupees(paise).toLocaleString('en-IN')}`

// Refunds: requested against a payment, approved or rejected, then recorded as processed (money returned) or failed.
// A pending or approved refund holds its amount so the same money cannot be allocated or refunded twice.
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesRepository,
    private readonly support: FinanceSupport,
    private readonly audit: AuditService,
  ) {}

  async request(access: AccessContext, actorUserId: string, input: CreateRefundInput, client: ClientInfo) {
    const amount = toPaise(input.amount)
    return this.prisma.transaction(async (tx) => {
      await this.support.lockPayment(tx, input.paymentId)
      const payment = await this.balances.payment(tx, access.orgId, input.paymentId)
      if (!payment) throw notFound('Payment not found.')
      const limit = input.releasesAllocations ? payment.position.refundable : payment.position.available
      if (amount > limit) {
        throw unprocessable('REFUND_EXCEEDS_ELIGIBLE', `Only ${inr(Math.max(limit, 0))} of ${payment.reference} can be refunded${input.releasesAllocations ? '' : ' without taking back money already applied to invoices'}.`)
      }
      const reference = await this.support.reference(tx, access.orgId, 'refund_reference', 'RFD-')
      const refund = await tx.refund.create({
        data: {
          orgId: access.orgId, reference, paymentId: payment.id, patientId: payment.patientId, amount: input.amount, reason: input.reason, method: input.method,
          internalReference: input.internalReference, notes: input.notes, releasesAllocations: input.releasesAllocations, requestedById: actorUserId,
        },
        select: { id: true },
      })
      await this.support.event(tx, access.orgId, 'refund', refund.id, 'Refund requested', actorUserId, input.notes)
      await this.audit.record({ action: 'billing.refund.requested', entityType: 'refund', entityId: refund.id, orgId: access.orgId, actorUserId, details: { reference, payment: payment.reference, amount: input.amount } }, client, tx)
      return { id: refund.id, reference }
    })
  }

  approve(access: AccessContext, id: string, actorUserId: string, input: { note: string; version: number }, client: ClientInfo) {
    return this.decide(access, id, actorUserId, 'pending', 'approved', input, client, { decidedAt: new Date() }, 'Refund approved')
  }

  reject(access: AccessContext, id: string, actorUserId: string, input: { note: string; version: number }, client: ClientInfo) {
    return this.decide(access, id, actorUserId, 'pending', 'rejected', input, client, { decidedAt: new Date(), outcomeNote: input.note }, 'Refund rejected')
  }

  fail(access: AccessContext, id: string, actorUserId: string, input: { note: string; version: number }, client: ClientInfo) {
    return this.decide(access, id, actorUserId, 'approved', 'failed', input, client, { completedAt: new Date(), outcomeNote: input.note }, 'Refund failed · no money returned')
  }

  // Records that the money went back. A refund allowed to take back applied money releases allocations
  // (newest invoice first) for whatever the payment's free credit cannot cover, reopening those balances.
  async process(access: AccessContext, id: string, actorUserId: string, input: { outcomeReference: string; note: string; version: number }, client: ClientInfo) {
    const refund = await this.find(access.orgId, id)
    await this.prisma.transaction(async (tx) => {
      await this.support.lockPayment(tx, refund.paymentId)
      const payment = (await this.balances.payment(tx, access.orgId, refund.paymentId, refund.id))!
      const amount = toPaise(refund.amount)
      const free = Math.max(payment.position.available, 0)
      const shortfall = amount - free
      if (shortfall > 0 && !refund.releasesAllocations) throw conflict('REFUND_EXCEEDS_ELIGIBLE', `Only ${inr(free)} of ${payment.reference} is unallocated now. Reject this request and raise a new one.`)
      if (shortfall > 0) await this.release(tx, access.orgId, actorUserId, refund, payment.allocations, shortfall)
      const updated = await tx.refund.updateMany({
        where: { id, orgId: access.orgId, status: 'approved', version: input.version },
        data: { status: 'processed', completedAt: new Date(), outcomeReference: input.outcomeReference, outcomeNote: input.note || null, version: { increment: 1 } },
      })
      if (updated.count === 0) throw conflict('REFUND_STATE_CHANGED', 'This refund was changed by someone else or is not approved. Reload it and try again.')
      await this.support.event(tx, access.orgId, 'refund', id, 'Refund processed · money returned', actorUserId, [input.outcomeReference, input.note].filter(Boolean).join(' · '))
      await this.audit.record({ action: 'billing.refund.processed', entityType: 'refund', entityId: id, orgId: access.orgId, actorUserId, details: { reference: refund.reference, outcomeReference: input.outcomeReference } }, client, tx)
    })
    return id
  }

  private async release(tx: Tx, orgId: string, actorUserId: string, refund: { id: string; paymentId: string }, allocations: Array<{ invoiceId: string; amount: { toString(): string }; createdAt: Date }>, shortfall: number) {
    // Net amount still applied per invoice, newest application first.
    const net = new Map<string, { amount: number; last: Date }>()
    for (const row of allocations) {
      const entry = net.get(row.invoiceId) ?? { amount: 0, last: row.createdAt }
      net.set(row.invoiceId, { amount: entry.amount + toPaise(row.amount), last: row.createdAt > entry.last ? row.createdAt : entry.last })
    }
    let needed = shortfall
    const order = [...net].filter(([, entry]) => entry.amount > 0).sort((a, b) => b[1].last.getTime() - a[1].last.getTime())
    await this.support.lockInvoices(tx, order.map(([invoiceId]) => invoiceId))
    for (const [invoiceId, entry] of order) {
      if (needed <= 0) break
      const take = Math.min(entry.amount, needed)
      needed -= take
      const reference = await this.support.reference(tx, orgId, 'allocation_reference', 'ALC-')
      await tx.paymentAllocation.create({ data: { orgId, reference, paymentId: refund.paymentId, invoiceId, amount: -rupees(take), refundId: refund.id, createdById: actorUserId } })
    }
    if (needed > 0) throw conflict('REFUND_EXCEEDS_ELIGIBLE', 'The payment no longer holds enough to cover this refund.')
  }

  private async decide(
    access: AccessContext, id: string, actorUserId: string, from: RefundStatus, to: RefundStatus, input: { note: string; version: number }, client: ClientInfo,
    data: { decidedAt?: Date; completedAt?: Date; outcomeNote?: string }, action: string,
  ) {
    const refund = await this.find(access.orgId, id)
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.refund.updateMany({ where: { id, orgId: access.orgId, status: from, version: input.version }, data: { ...data, status: to, version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('REFUND_STATE_CHANGED', `This refund is no longer ${from}. Reload it and try again.`)
      await this.support.event(tx, access.orgId, 'refund', id, action, actorUserId, input.note)
      await this.audit.record({ action: `billing.refund.${to}`, entityType: 'refund', entityId: id, orgId: access.orgId, actorUserId, details: { reference: refund.reference } }, client, tx)
    })
    return id
  }

  private async find(orgId: string, id: string) {
    const refund = await this.prisma.refund.findFirst({ where: { id, orgId }, select: { id: true, reference: true, paymentId: true, amount: true, releasesAllocations: true } })
    if (!refund) throw notFound('Refund not found.')
    return refund
  }
}
