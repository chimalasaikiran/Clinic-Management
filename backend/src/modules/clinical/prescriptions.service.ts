import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import { ClinicalService } from './clinical.service'
import { ClinicianRepository } from './clinician.repository'
import { PrescriptionRow, PrescriptionsRepository } from './prescriptions.repository'
import type { CreatePrescriptionInput } from './prescriptions.schemas'

// Blood pressure at or above stage 1 hypertension (130/80) makes an NSAID a precaution to acknowledge.
export const hypertensive = (vitals: { systolic: number; diastolic: number } | null) => Boolean(vitals && (vitals.systolic >= 130 || vitals.diastolic >= 80))

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prescriptions: PrescriptionsRepository,
    private readonly clinical: ClinicalService,
    private readonly clinician: ClinicianRepository,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
  ) {}

  view = (row: PrescriptionRow) => ({
    ...row,
    encounter: undefined,
    encounterReference: row.encounter?.reference ?? null,
    created: this.clinical.stamp(row.createdAt),
    createdAt: undefined,
    events: row.events.map((event) => ({ id: event.id, action: event.action, note: event.note, actor: event.actor.fullName, at: this.clinical.stamp(event.createdAt) })),
  })

  async forPatient(orgId: string, patientId: string) {
    return (await this.prescriptions.forPatient(orgId, patientId)).map(this.view)
  }

  // Signs a prescription. Refused when a medication matches a documented drug allergy, and when an NSAID is
  // prescribed to a hypertensive patient without acknowledging the precaution.
  async create(access: AccessContext, patientId: string, actorUserId: string, input: CreatePrescriptionInput, client: ClientInfo) {
    const scope = await this.clinical.visiblePatient(access, patientId)
    const encounter = input.encounterId ? await this.clinical.openEncounterOf(access.orgId, scope, input.encounterId, patientId) : null
    const branchId = encounter?.branch.id ?? input.branchId!
    if (!encounter && !(await this.prisma.branch.findFirst({ where: { id: branchId, orgId: access.orgId, status: 'active' }, select: { id: true } }))) {
      throw unprocessable('BRANCH_INVALID', 'Choose an active branch of this organisation.')
    }

    const [allergies, vitals, prescriber] = await Promise.all([
      this.prescriptions.drugAllergies(access.orgId, patientId),
      this.prescriptions.latestVitals(access.orgId, patientId),
      this.clinician.of(access.membershipId, actorUserId),
    ])
    for (const item of input.items) {
      const allergy = allergies.find((entry) => item.drugClass && entry.drugClass === item.drugClass)
      if (allergy) throw unprocessable('ALLERGY_CONFLICT', `${item.name} conflicts with the documented ${allergy.substance} allergy (${allergy.reaction}).`)
    }
    if (input.items.some((item) => item.drugClass === 'nsaid') && hypertensive(vitals) && !input.precautionAcknowledged) {
      throw unprocessable('PRECAUTION_REQUIRED', 'Acknowledge the NSAID precaution for this patient’s raised blood pressure before signing.')
    }

    const id = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('RX-', await this.counters.next(tx, access.orgId, 'prescription_reference'))
      const createdAt = new Date()
      const items = input.items.map((item, position) => ({
        position,
        medicineCode: item.medicineCode,
        name: item.name,
        strength: item.strength,
        form: item.form,
        route: item.route,
        drugClass: item.drugClass,
        dose: `${item.dose} ${item.form}`,
        frequency: item.frequency,
        frequencyPerDay: item.frequencyPerDay,
        food: item.food,
        durationDays: item.durationDays,
        quantity: item.dose * item.frequencyPerDay * item.durationDays,
        instructions: item.instructions,
        indication: item.indication,
      }))
      const contentHash = createHash('sha256')
        .update(JSON.stringify({ reference, patientId, prescriber: prescriber.name, registration: prescriber.registration, signedAt: createdAt.toISOString(), items }))
        .digest('hex')
      const created = await this.prescriptions.create(tx, {
        orgId: access.orgId, reference, patientId, encounterId: encounter?.id ?? null, branchId, prescriberName: prescriber.name, registration: prescriber.registration,
        department: prescriber.department, indication: input.indication, precautionAcknowledged: input.precautionAcknowledged, contentHash, createdById: actorUserId, createdAt,
        items: { create: items },
      })
      await this.prescriptions.addEvent(tx, created.id, 'signed', actorUserId, encounter ? `Linked to ${encounter.reference}.` : '')
      await this.audit.record({ action: 'prescription.signed', entityType: 'prescription', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference, items: items.length } }, client, tx)
      return created.id
    })
    return this.view((await this.prescriptions.find(access.orgId, id))!)
  }

  async discontinue(access: AccessContext, id: string, actorUserId: string, reason: string, client: ClientInfo) {
    const current = await this.find(access, id)
    await this.prisma.transaction(async (tx) => {
      if ((await this.prescriptions.setStatus(tx, id, 'active', 'discontinued')) === 0) throw conflict('PRESCRIPTION_CLOSED', 'This prescription is no longer active.')
      await this.prescriptions.addEvent(tx, id, 'discontinued', actorUserId, reason)
      await this.audit.record({ action: 'prescription.discontinued', entityType: 'prescription', entityId: id, orgId: access.orgId, actorUserId, details: { reference: current.reference } }, client, tx)
    })
    return this.view((await this.prescriptions.find(access.orgId, id))!)
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prescriptions.find(access.orgId, id)
    // Visibility follows the patient: outside the member's scope it does not exist.
    if (!row) throw notFound('Prescription not found.')
    await this.clinical.visiblePatient(access, row.patientId).catch(() => {
      throw notFound('Prescription not found.')
    })
    return row
  }
}
