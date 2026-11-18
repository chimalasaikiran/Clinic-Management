import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma, ReferralStatus } from '../../generated/prisma/client'

export const referralSelect = {
  id: true,
  reference: true,
  patientId: true,
  encounterId: true,
  direction: true,
  status: true,
  priority: true,
  windowHours: true,
  model: true,
  specialty: true,
  indication: true,
  narrative: true,
  questions: true,
  attachedRecords: true,
  facility: true,
  facilityNote: true,
  clinician: true,
  clinicianNote: true,
  outcome: true,
  createdAt: true,
  version: true,
  createdBy: { select: { fullName: true } },
  encounter: { select: { reference: true } },
  targetPractitioner: { select: { id: true, displayName: true, specialty: true } },
  events: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, text: true, createdAt: true, actor: { select: { fullName: true } } } },
} satisfies Prisma.ReferralSelect

export type ReferralRow = Prisma.ReferralGetPayload<{ select: typeof referralSelect }>

@Injectable()
export class ReferralsRepository {
  constructor(private readonly prisma: PrismaService) {}

  forPatient(orgId: string, patientId: string) {
    return this.prisma.referral.findMany({ where: { orgId, patientId }, orderBy: { createdAt: 'desc' }, select: referralSelect })
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.referral.findFirst({ where: { orgId, id }, select: referralSelect })
  }

  activePractitioner(orgId: string, id: string) {
    return this.prisma.practitioner.findFirst({ where: { orgId, id, status: 'active' }, select: { id: true, displayName: true, specialty: true, department: true, room: true } })
  }

  create(tx: Tx, data: Prisma.ReferralUncheckedCreateInput) {
    return tx.referral.create({ data, select: { id: true } })
  }

  async move(tx: Tx, id: string, from: ReferralStatus[], data: Prisma.ReferralUncheckedUpdateManyInput) {
    const { count } = await tx.referral.updateMany({ where: { id, status: { in: from } }, data: { ...data, version: { increment: 1 } } })
    return count
  }

  addEvent(tx: Tx, referralId: string, title: string, actorId: string, text = '') {
    return tx.referralEvent.create({ data: { referralId, title, text, actorId } })
  }
}
