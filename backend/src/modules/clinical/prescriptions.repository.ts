import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'

const person = { select: { fullName: true } } as const

export const prescriptionSelect = {
  id: true,
  reference: true,
  patientId: true,
  encounterId: true,
  prescriberName: true,
  registration: true,
  department: true,
  indication: true,
  precautionAcknowledged: true,
  status: true,
  contentHash: true,
  createdAt: true,
  version: true,
  encounter: { select: { reference: true } },
  branch: { select: { id: true, name: true } },
  items: { orderBy: { position: 'asc' }, omit: { prescriptionId: true } },
  events: { orderBy: { createdAt: 'desc' }, select: { id: true, action: true, note: true, createdAt: true, actor: person } },
  dispenses: { select: { lines: { select: { prescriptionItemId: true, qty: true } } } },
} satisfies Prisma.PrescriptionSelect

export type PrescriptionRow = Prisma.PrescriptionGetPayload<{ select: typeof prescriptionSelect }>

@Injectable()
export class PrescriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  forPatient(orgId: string, patientId: string) {
    return this.prisma.prescription.findMany({ where: { orgId, patientId }, orderBy: { createdAt: 'desc' }, select: prescriptionSelect })
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.prescription.findFirst({ where: { orgId, id }, select: prescriptionSelect })
  }

  // Drug classes the patient is documented as allergic to.
  drugAllergies(orgId: string, patientId: string, db: Db = this.prisma) {
    return db.allergy.findMany({ where: { orgId, patientId, active: true, drugClass: { not: null } }, select: { drugClass: true, substance: true, reaction: true } })
  }

  latestVitals(orgId: string, patientId: string, db: Db = this.prisma) {
    return db.vitalSign.findFirst({ where: { orgId, patientId }, orderBy: { recordedAt: 'desc' }, select: { systolic: true, diastolic: true } })
  }

  create(tx: Tx, data: Prisma.PrescriptionUncheckedCreateInput) {
    return tx.prescription.create({ data, select: { id: true } })
  }

  async setStatus(tx: Tx, id: string, from: 'active', to: 'discontinued' | 'completed') {
    const { count } = await tx.prescription.updateMany({ where: { id, status: from }, data: { status: to, version: { increment: 1 } } })
    return count
  }

  addEvent(tx: Tx, prescriptionId: string, action: string, actorId: string, note = '') {
    return tx.prescriptionEvent.create({ data: { prescriptionId, action, actorId, note } })
  }
}
