import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import type { CareScope } from '../scheduling/care-scope.service'

const person = { select: { fullName: true } } as const

export const encounterSelect = {
  id: true,
  reference: true,
  patientId: true,
  appointmentId: true,
  type: true,
  reason: true,
  chiefComplaint: true,
  subjective: true,
  objective: true,
  assessment: true,
  plan: true,
  status: true,
  startedAt: true,
  signedAt: true,
  version: true,
  signedBy: person,
  createdBy: person,
  branch: { select: { id: true, name: true, city: true } },
  practitioner: { select: { id: true, displayName: true, credentials: true, department: true, room: true } },
} satisfies Prisma.EncounterSelect

export const vitalsSelect = {
  id: true, encounterId: true, systolic: true, diastolic: true, pulse: true, respiration: true, temperatureF: true, spo2: true, weightKg: true, heightCm: true,
  bloodSugar: true, painScore: true, site: true, posture: true, device: true, recordedAt: true, recordedBy: person,
} satisfies Prisma.VitalSignSelect

export const diagnosisSelect = {
  id: true, encounterId: true, icd: true, snomed: true, name: true, designation: true, verification: true, severity: true, description: true, status: true, recordedAt: true, resolvedAt: true, recordedBy: person,
} satisfies Prisma.DiagnosisSelect

export const allergySelect = {
  id: true, substance: true, drugClass: true, classLabel: true, severity: true, reaction: true, verification: true, active: true, recordedAt: true, recordedBy: person,
} satisfies Prisma.AllergySelect

export const alertSelect = {
  id: true, patientId: true, kind: true, title: true, severity: true, status: true, detail: true, statement: true, allergyId: true, orderId: true, disposition: true, justification: true,
  acknowledgedAt: true, createdAt: true, acknowledgedBy: person, createdBy: person,
} satisfies Prisma.ClinicalAlertSelect

export const noteSelect = {
  id: true, encounterId: true, title: true, department: true, sections: true, signedAt: true, author: person,
  addenda: { orderBy: { createdAt: 'asc' }, select: { id: true, text: true, createdAt: true, author: person } },
} satisfies Prisma.ClinicalNoteSelect

export type EncounterRow = Prisma.EncounterGetPayload<{ select: typeof encounterSelect }>
export type VitalsRow = Prisma.VitalSignGetPayload<{ select: typeof vitalsSelect }>
export type DiagnosisRow = Prisma.DiagnosisGetPayload<{ select: typeof diagnosisSelect }>
export type AllergyRow = Prisma.AllergyGetPayload<{ select: typeof allergySelect }>
export type AlertRow = Prisma.ClinicalAlertGetPayload<{ select: typeof alertSelect }>
export type NoteRow = Prisma.ClinicalNoteGetPayload<{ select: typeof noteSelect }>

@Injectable()
export class ClinicalRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Patients the member may see, in the same scope as the patient directory.
  patientScope(orgId: string, scope: CareScope): Prisma.PatientWhereInput {
    return { orgId, ...(scope.patients === 'all' ? {} : { appointments: { some: { practitionerId: scope.patients.practitionerId } } }) }
  }

  visiblePatient(orgId: string, scope: CareScope, patientId: string, db: Db = this.prisma) {
    return db.patient.findFirst({ where: { AND: [this.patientScope(orgId, scope), { id: patientId }] }, select: { id: true, status: true } })
  }

  async chart(orgId: string, patientId: string) {
    const where = { orgId, patientId }
    const [encounters, vitals, diagnoses, allergies, alerts, notes] = await Promise.all([
      this.prisma.encounter.findMany({ where, orderBy: { startedAt: 'desc' }, select: encounterSelect }),
      this.prisma.vitalSign.findMany({ where, orderBy: { recordedAt: 'desc' }, take: 100, select: vitalsSelect }),
      this.prisma.diagnosis.findMany({ where, orderBy: { recordedAt: 'desc' }, select: diagnosisSelect }),
      this.prisma.allergy.findMany({ where, orderBy: { recordedAt: 'desc' }, select: allergySelect }),
      this.prisma.clinicalAlert.findMany({ where, orderBy: { createdAt: 'desc' }, select: alertSelect }),
      this.prisma.clinicalNote.findMany({ where, orderBy: { signedAt: 'desc' }, select: noteSelect }),
    ])
    return { encounters, vitals, diagnoses, allergies, alerts, notes }
  }

  // Encounter in the member's patient scope.
  encounter(orgId: string, scope: CareScope, id: string, db: Db = this.prisma) {
    return db.encounter.findFirst({ where: { id, orgId, patient: this.patientScope(orgId, scope) }, select: encounterSelect })
  }

  async lockEncounter(tx: Tx, orgId: string, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`select id from encounters where id = ${id}::uuid and org_id = ${orgId}::uuid for update`
    return rows.length > 0
  }

  createEncounter(tx: Tx, data: Prisma.EncounterUncheckedCreateInput) {
    return tx.encounter.create({ data, select: { id: true } })
  }

  async updateEncounter(tx: Tx, id: string, version: number, data: Prisma.EncounterUncheckedUpdateInput) {
    const { count } = await tx.encounter.updateMany({ where: { id, version, status: 'in_progress' }, data: { ...data, version: { increment: 1 } } })
    return count
  }

  activeEncounterDiagnoses(tx: Tx, encounterId: string) {
    return tx.diagnosis.count({ where: { encounterId, status: 'active' } })
  }

  createNote(tx: Tx, data: Prisma.ClinicalNoteUncheckedCreateInput) {
    return tx.clinicalNote.create({ data, select: { id: true } })
  }

  appointmentForEncounter(tx: Tx, orgId: string, id: string) {
    return tx.appointment.findFirst({ where: { id, orgId }, select: { id: true, status: true, patientId: true, practitionerId: true, branchId: true, type: true, reason: true, practitioner: { select: { department: true } } } })
  }

  createVitals(data: Prisma.VitalSignUncheckedCreateInput) {
    return this.prisma.vitalSign.create({ data, select: vitalsSelect })
  }

  createDiagnosis(data: Prisma.DiagnosisUncheckedCreateInput) {
    return this.prisma.diagnosis.create({ data, select: diagnosisSelect })
  }

  async resolveDiagnosis(orgId: string, scope: CareScope, id: string) {
    const { count } = await this.prisma.diagnosis.updateMany({ where: { id, orgId, status: 'active', patient: this.patientScope(orgId, scope) }, data: { status: 'resolved', resolvedAt: new Date() } })
    return count
  }

  createAllergy(tx: Tx, data: Prisma.AllergyUncheckedCreateInput) {
    return tx.allergy.create({ data, select: { id: true } })
  }

  createAlert(db: Db, data: Prisma.ClinicalAlertUncheckedCreateInput) {
    return db.clinicalAlert.create({ data, select: alertSelect })
  }

  alert(orgId: string, scope: CareScope, id: string) {
    return this.prisma.clinicalAlert.findFirst({ where: { id, orgId, patient: this.patientScope(orgId, scope) }, select: alertSelect })
  }

  async closeAlert(id: string, from: 'active', data: Prisma.ClinicalAlertUncheckedUpdateInput) {
    const { count } = await this.prisma.clinicalAlert.updateMany({ where: { id, status: from }, data })
    return count
  }

  note(orgId: string, scope: CareScope, id: string) {
    return this.prisma.clinicalNote.findFirst({ where: { id, orgId, patient: this.patientScope(orgId, scope) }, select: noteSelect })
  }

  addAddendum(noteId: string, text: string, authorId: string) {
    return this.prisma.noteAddendum.create({ data: { noteId, text, authorId }, select: { id: true } })
  }

  // Today's clinical worklist: open encounters and serious active alerts for patients in scope.
  openEncounters(orgId: string, scope: CareScope) {
    return this.prisma.encounter.findMany({ where: { orgId, status: 'in_progress', patient: this.patientScope(orgId, scope) }, orderBy: { startedAt: 'asc' }, select: { ...encounterSelect, patient: { select: { id: true, fullName: true, mrn: true } } } })
  }

  seriousAlerts(orgId: string, scope: CareScope) {
    return this.prisma.clinicalAlert.findMany({
      where: { orgId, status: 'active', severity: { in: ['critical', 'high'] }, patient: this.patientScope(orgId, scope) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { ...alertSelect, patient: { select: { id: true, fullName: true, mrn: true } } },
    })
  }
}
