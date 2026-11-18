import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'

export const carePlanSelect = {
  id: true,
  reference: true,
  patientId: true,
  title: true,
  category: true,
  rationale: true,
  startDate: true,
  nextReview: true,
  targetDate: true,
  diagnoses: true,
  education: true,
  whatsapp: true,
  status: true,
  compliance: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  createdBy: { select: { fullName: true } },
  leadPractitioner: { select: { id: true, displayName: true, room: true } },
  goals: { orderBy: { position: 'asc' }, omit: { carePlanId: true } },
  interventions: { orderBy: { position: 'asc' }, omit: { carePlanId: true } },
  reviews: { orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, observation: true, summary: true, barriers: true, createdAt: true, author: { select: { fullName: true } } } },
} satisfies Prisma.CarePlanSelect

export type CarePlanRow = Prisma.CarePlanGetPayload<{ select: typeof carePlanSelect }>

@Injectable()
export class CarePlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  forPatient(orgId: string, patientId: string) {
    return this.prisma.carePlan.findMany({ where: { orgId, patientId }, orderBy: { createdAt: 'desc' }, select: carePlanSelect })
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.carePlan.findFirst({ where: { orgId, id }, select: carePlanSelect })
  }

  activePractitioner(orgId: string, id: string) {
    return this.prisma.practitioner.findFirst({ where: { orgId, id, status: 'active' }, select: { id: true } })
  }

  create(tx: Tx, data: Prisma.CarePlanUncheckedCreateInput) {
    return tx.carePlan.create({ data, select: { id: true } })
  }

  // Optimistic locking: the review applies only to the version the reviewer saw.
  async updateIfVersion(tx: Tx, id: string, version: number, data: Prisma.CarePlanUncheckedUpdateManyInput) {
    const { count } = await tx.carePlan.updateMany({ where: { id, version, status: { not: 'closed' } }, data: { ...data, version: { increment: 1 } } })
    return count
  }

  updateGoal(tx: Tx, id: string, data: { status: string; observation: string | null }) {
    return tx.carePlanGoal.update({ where: { id }, data })
  }

  updateIntervention(tx: Tx, id: string, state: string) {
    return tx.carePlanIntervention.update({ where: { id }, data: { state } })
  }

  addReview(tx: Tx, data: Prisma.CarePlanReviewUncheckedCreateInput) {
    return tx.carePlanReview.create({ data })
  }
}
