import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { OrderStatus, Prisma } from '../../generated/prisma/client'

const person = { select: { fullName: true } } as const

export const orderSelect = {
  id: true,
  reference: true,
  patientId: true,
  encounterId: true,
  orderingName: true,
  kind: true,
  category: true,
  title: true,
  indication: true,
  performing: true,
  urgent: true,
  status: true,
  accession: true,
  specimenNote: true,
  resultSummary: true,
  resultFlag: true,
  reviewOutcome: true,
  reviewNote: true,
  createdAt: true,
  version: true,
  encounter: { select: { reference: true } },
  branch: { select: { id: true, name: true } },
  items: { orderBy: { position: 'asc' }, omit: { orderId: true } },
  events: { orderBy: { createdAt: 'desc' }, select: { id: true, action: true, note: true, createdAt: true, actor: person } },
} satisfies Prisma.DiagnosticOrderSelect

export type OrderRow = Prisma.DiagnosticOrderGetPayload<{ select: typeof orderSelect }>

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  forPatient(orgId: string, patientId: string) {
    return this.prisma.diagnosticOrder.findMany({ where: { orgId, patientId }, orderBy: { createdAt: 'desc' }, select: orderSelect })
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.diagnosticOrder.findFirst({ where: { orgId, id }, select: orderSelect })
  }

  create(tx: Tx, data: Prisma.DiagnosticOrderUncheckedCreateInput) {
    return tx.diagnosticOrder.create({ data, select: { id: true } })
  }

  // Moves the order on only from the expected states, so two people acting at once cannot both succeed.
  async advance(tx: Tx, id: string, from: OrderStatus[], data: Prisma.DiagnosticOrderUncheckedUpdateManyInput) {
    const { count } = await tx.diagnosticOrder.updateMany({ where: { id, status: { in: from } }, data: { ...data, version: { increment: 1 } } })
    return count
  }

  addEvent(tx: Tx, orderId: string, action: string, actorId: string, note = '') {
    return tx.orderEvent.create({ data: { orderId, action, actorId, note } })
  }

  async resolveAlerts(tx: Tx, orderId: string) {
    const { count } = await tx.clinicalAlert.updateMany({ where: { orderId, status: 'active' }, data: { status: 'resolved' } })
    return count
  }
}
