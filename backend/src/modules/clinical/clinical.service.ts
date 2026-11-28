import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import { LiveEvent, LiveService } from '../../common/realtime/live.service'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import { AppointmentsRepository } from '../appointments/appointments.repository'
import { transition } from '../appointments/lifecycle'
import { NotificationsService } from '../notifications/notifications.service'
import { CareScope, CareScopeService } from '../scheduling/care-scope.service'
import { PractitionersRepository } from '../scheduling/practitioners.repository'
import { addDays, localDate, localMinute, minuteToTime, zonedInstant } from '../scheduling/clinic-time'
import { AlertRow, AllergyRow, ClinicalRepository, DiagnosisRow, EncounterRow, NoteRow, VitalsRow } from './clinical.repository'
import type { AlertInput, AllergyInput, DiagnosisInput, StartEncounterInput, UpdateEncounterInput, VitalsInput } from './clinical.schemas'

const SECTIONS = [
  ['chiefComplaint', 'Chief complaint'],
  ['subjective', 'Subjective'],
  ['objective', 'Objective'],
  ['assessment', 'Assessment'],
  ['plan', 'Plan'],
] as const

@Injectable()
export class ClinicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: ClinicalRepository,
    private readonly appointments: AppointmentsRepository,
    private readonly counters: CountersRepository,
    private readonly careScope: CareScopeService,
    private readonly practitioners: PractitionersRepository,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly live: LiveService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // A moment as the clinic sees it: local date and time, plus the exact instant.
  stamp(instant: Date) {
    return { date: localDate(instant, this.env.CLINIC_TIMEZONE), time: minuteToTime(localMinute(instant, this.env.CLINIC_TIMEZONE)), at: instant.toISOString() }
  }

  encounterView(row: EncounterRow) {
    return {
      id: row.id,
      reference: row.reference,
      patientId: row.patientId,
      appointmentId: row.appointmentId,
      type: row.type,
      reason: row.reason,
      chiefComplaint: row.chiefComplaint,
      soap: { subjective: row.subjective, objective: row.objective, assessment: row.assessment, plan: row.plan },
      status: row.status,
      started: this.stamp(row.startedAt),
      signed: row.signedAt ? { ...this.stamp(row.signedAt), by: row.signedBy?.fullName ?? null } : null,
      startedBy: row.createdBy.fullName,
      practitioner: row.practitioner,
      branch: row.branch,
      version: row.version,
    }
  }

  private vitalsView = (row: VitalsRow) => ({ ...row, recordedBy: row.recordedBy.fullName, recorded: this.stamp(row.recordedAt), recordedAt: undefined })
  private diagnosisView = (row: DiagnosisRow) => ({ ...row, recordedBy: row.recordedBy.fullName, recorded: this.stamp(row.recordedAt), recordedAt: undefined, resolvedAt: row.resolvedAt?.toISOString() ?? null })
  private allergyView = (row: AllergyRow) => ({ ...row, recordedBy: row.recordedBy.fullName, recorded: this.stamp(row.recordedAt), recordedAt: undefined })
  private alertView = (row: AlertRow) => ({
    ...row,
    // No creator: raised by an anonymous incident report.
    createdBy: row.createdBy?.fullName ?? 'Anonymous incident report',
    created: this.stamp(row.createdAt),
    createdAt: undefined,
    acknowledgedBy: row.acknowledgedBy?.fullName ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
  })
  private noteView = (row: NoteRow) => ({
    id: row.id,
    encounterId: row.encounterId,
    title: row.title,
    department: row.department,
    sections: row.sections as Array<{ heading: string; body: string }>,
    author: row.author.fullName,
    signed: this.stamp(row.signedAt),
    addenda: row.addenda.map((entry) => ({ id: entry.id, text: entry.text, author: entry.author.fullName, at: this.stamp(entry.createdAt) })),
  })

  // Everything on a patient's chart that the clinical screens show.
  async chart(access: AccessContext, patientId: string) {
    await this.visiblePatient(access, patientId)
    const chart = await this.clinical.chart(access.orgId, patientId)
    return {
      encounters: chart.encounters.map((row) => this.encounterView(row)),
      vitals: chart.vitals.map(this.vitalsView),
      diagnoses: chart.diagnoses.map(this.diagnosisView),
      allergies: chart.allergies.map(this.allergyView),
      alerts: chart.alerts.map(this.alertView),
      notes: chart.notes.map(this.noteView),
    }
  }

  async encounter(access: AccessContext, id: string) {
    return this.encounterView(await this.findEncounter(access.orgId, await this.careScope.resolve(access), id))
  }

  // From an arrived appointment: starts the appointment and opens its encounter in one transaction.
  async startEncounter(access: AccessContext, actorUserId: string, input: StartEncounterInput, client: ClientInfo) {
    const scope = await this.careScope.resolve(access)
    // Filled when the visit's appointment changes status, and published once that is committed.
    const events: LiveEvent[] = []
    const id = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('ENC-', await this.counters.next(tx, access.orgId, 'encounter_reference'))
      if ('appointmentId' in input) {
        if (!(await this.appointments.lock(tx, access.orgId, input.appointmentId))) throw notFound('Appointment not found.')
        const visible = await this.appointments.find({ AND: [this.appointments.scoped(access.orgId, scope), { id: input.appointmentId }] }, tx)
        const appointment = await this.clinical.appointmentForEncounter(tx, access.orgId, input.appointmentId)
        if (!visible || !appointment) throw notFound('Appointment not found.')
        const toStatus = transition('start', appointment.status)
        await this.appointments.update(tx, appointment.id, { status: toStatus })
        await this.appointments.addEvent(tx, { appointmentId: appointment.id, action: 'start', fromStatus: appointment.status, toStatus, actorUserId })
        events.push(...(await this.notifications.appointmentChanged(tx, { appointmentId: appointment.id, by: 'clinic' })))
        const created = await this.clinical.createEncounter(tx, {
          orgId: access.orgId, reference, patientId: appointment.patientId, appointmentId: appointment.id, practitionerId: appointment.practitionerId,
          branchId: appointment.branchId, type: `${appointment.practitioner.department} consultation`, reason: appointment.reason, chiefComplaint: appointment.reason, createdById: actorUserId,
        })
        await this.audit.record({ action: 'encounter.started', entityType: 'encounter', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference, appointmentId: appointment.id } }, client, tx)
        events.push({ topic: 'records', orgId: access.orgId, entityId: created.id, patientId: appointment.patientId, branchId: appointment.branchId })
        return created.id
      }
      if (!(await this.clinical.visiblePatient(access.orgId, scope, input.patientId, tx))) throw notFound('Patient not found.')
      const created = await this.clinical.createEncounter(tx, { orgId: access.orgId, reference, patientId: input.patientId, branchId: input.branchId, type: input.type, reason: input.reason, chiefComplaint: input.reason, createdById: actorUserId })
      await this.audit.record({ action: 'encounter.started', entityType: 'encounter', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference } }, client, tx)
      events.push({ topic: 'records', orgId: access.orgId, entityId: created.id, patientId: input.patientId, branchId: input.branchId })
      return created.id
    })
    await this.live.publish(events)
    return this.encounter(access, id)
  }

  async updateEncounter(access: AccessContext, id: string, actorUserId: string, input: UpdateEncounterInput, client: ClientInfo) {
    const current = await this.findEncounter(access.orgId, await this.careScope.resolve(access), id)
    if (current.status !== 'in_progress') throw conflict('ENCOUNTER_SIGNED', 'This encounter is signed and locked. Add an addendum to its note instead.')
    const { version, ...fields } = input
    await this.prisma.transaction(async (tx) => {
      if ((await this.clinical.updateEncounter(tx, id, version, fields)) === 0) {
        throw conflict('ENCOUNTER_CHANGED', 'Someone else saved this encounter first. Reload to see their changes.')
      }
      await this.audit.record({ action: 'encounter.updated', entityType: 'encounter', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    await this.chartChanged(access.orgId, current.patientId, id, current.branch.id)
    return this.encounter(access, id)
  }

  // Locks the encounter, files its note and completes the visit. Needs a complaint and at least one diagnosis.
  async signEncounter(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    const scope = await this.careScope.resolve(access)
    const events: LiveEvent[] = []
    await this.prisma.transaction(async (tx) => {
      if (!(await this.clinical.lockEncounter(tx, access.orgId, id))) throw notFound('Encounter not found.')
      const encounter = await this.clinical.encounter(access.orgId, scope, id, tx)
      if (!encounter) throw notFound('Encounter not found.')
      if (encounter.status !== 'in_progress') throw conflict('ENCOUNTER_SIGNED', 'This encounter is already signed.')
      if (!encounter.chiefComplaint.trim()) throw unprocessable('COMPLAINT_REQUIRED', 'Document the chief complaint before completing the encounter.')
      if ((await this.clinical.activeEncounterDiagnoses(tx, id)) === 0) throw unprocessable('DIAGNOSIS_REQUIRED', 'Attach at least one diagnosis before completing the encounter.')

      const signedAt = new Date()
      await tx.encounter.update({ where: { id }, data: { status: 'signed', signedAt, signedById: actorUserId, version: { increment: 1 } } })
      const sections = SECTIONS.map(([key, heading]) => ({ heading, body: key === 'chiefComplaint' ? encounter.chiefComplaint : encounter[key] })).filter((section) => section.body.trim())
      await this.clinical.createNote(tx, { orgId: access.orgId, patientId: encounter.patientId, encounterId: id, title: `${encounter.type} — ${encounter.reference}`, department: encounter.practitioner?.department ?? null, sections, authorId: actorUserId, signedAt })

      if (encounter.appointmentId) {
        await this.appointments.lock(tx, access.orgId, encounter.appointmentId)
        const appointment = await this.clinical.appointmentForEncounter(tx, access.orgId, encounter.appointmentId)
        if (appointment && ['arrived', 'in_progress'].includes(appointment.status)) {
          const toStatus = transition('complete', appointment.status)
          await this.appointments.update(tx, appointment.id, { status: toStatus })
          await this.appointments.addEvent(tx, { appointmentId: appointment.id, action: 'complete', fromStatus: appointment.status, toStatus, actorUserId, note: `Encounter ${encounter.reference} signed` })
          events.push(...(await this.notifications.appointmentChanged(tx, { appointmentId: appointment.id, by: 'clinic' })))
        }
      }
      events.push(...(await this.notifications.recordChanged(tx, { orgId: access.orgId, patientId: encounter.patientId, branchId: encounter.branch.id, entityType: 'encounter', entityId: id, notice: 'consultation_signed' })))
      await this.audit.record({ action: 'encounter.signed', entityType: 'encounter', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    await this.live.publish(events)
    return this.encounter(access, id)
  }

  async recordVitals(access: AccessContext, patientId: string, actorUserId: string, input: VitalsInput, client: ClientInfo) {
    const scope = await this.visiblePatient(access, patientId)
    const encounter = input.encounterId ? await this.openEncounterOf(access.orgId, scope, input.encounterId, patientId) : null
    const row = await this.clinical.createVitals({ ...input, orgId: access.orgId, patientId, recordedById: actorUserId })
    await this.audit.record({ action: 'vitals.recorded', entityType: 'patient', entityId: patientId, orgId: access.orgId, actorUserId }, client)
    await this.chartChanged(access.orgId, patientId, row.id, encounter?.branch.id)
    return this.vitalsView(row)
  }

  async addDiagnosis(access: AccessContext, patientId: string, actorUserId: string, input: DiagnosisInput, client: ClientInfo) {
    const scope = await this.visiblePatient(access, patientId)
    const encounter = input.encounterId ? await this.openEncounterOf(access.orgId, scope, input.encounterId, patientId) : null
    const row = await this.clinical.createDiagnosis({ ...input, orgId: access.orgId, patientId, recordedById: actorUserId })
    await this.audit.record({ action: 'diagnosis.recorded', entityType: 'patient', entityId: patientId, orgId: access.orgId, actorUserId, details: { icd: input.icd } }, client)
    await this.chartChanged(access.orgId, patientId, row.id, encounter?.branch.id)
    return this.diagnosisView(row)
  }

  async resolveDiagnosis(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    const scope = await this.careScope.resolve(access)
    if ((await this.clinical.resolveDiagnosis(access.orgId, scope, id)) === 0) throw notFound('Active diagnosis not found.')
    await this.audit.record({ action: 'diagnosis.resolved', entityType: 'diagnosis', entityId: id, orgId: access.orgId, actorUserId }, client)
  }

  // A severe allergy also raises a critical safety alert on the chart.
  async addAllergy(access: AccessContext, patientId: string, actorUserId: string, input: AllergyInput, client: ClientInfo) {
    await this.visiblePatient(access, patientId)
    await this.prisma.transaction(async (tx: Tx) => {
      const allergy = await this.clinical.createAllergy(tx, { ...input, orgId: access.orgId, patientId, recordedById: actorUserId })
      if (input.severity === 'severe') {
        await this.clinical.createAlert(tx, {
          orgId: access.orgId, patientId, allergyId: allergy.id, kind: `ALLERGY: ${input.substance.toUpperCase()}`, title: `${input.substance} allergy — ${input.reaction}`,
          severity: 'critical', detail: `Severe reaction recorded: ${input.reaction}.`, statement: 'A documented severe allergy. Check every prescription and order against it.', createdById: actorUserId,
        })
      }
      await this.audit.record({ action: 'allergy.recorded', entityType: 'patient', entityId: patientId, orgId: access.orgId, actorUserId }, client, tx)
    })
    await this.chartChanged(access.orgId, patientId, patientId)
    return this.chart(access, patientId).then((chart) => chart.allergies[0])
  }

  async raiseAlert(access: AccessContext, patientId: string, actorUserId: string, input: AlertInput, client: ClientInfo) {
    await this.visiblePatient(access, patientId)
    const row = await this.clinical.createAlert(this.prisma, { ...input, orgId: access.orgId, patientId, createdById: actorUserId })
    await this.audit.record({ action: 'alert.raised', entityType: 'patient', entityId: patientId, orgId: access.orgId, actorUserId, details: { severity: input.severity } }, client)
    await this.chartChanged(access.orgId, patientId, row.id)
    return this.alertView(row)
  }

  // One alert, for the alert review screen. Hidden (404) outside the member's care scope.
  async alert(access: AccessContext, id: string) {
    return this.alertView(await this.findAlert(access, id))
  }

  async acknowledgeAlert(access: AccessContext, id: string, actorUserId: string, input: { disposition: string; justification: string }, client: ClientInfo) {
    const alert = await this.findAlert(access, id)
    const changed = await this.clinical.closeAlert(id, 'active', { status: 'acknowledged', disposition: input.disposition, justification: input.justification, acknowledgedById: actorUserId, acknowledgedAt: new Date() })
    if (changed === 0) throw conflict('ALERT_CLOSED', 'This alert is no longer active.')
    await this.audit.record({ action: 'alert.acknowledged', entityType: 'alert', entityId: id, orgId: access.orgId, actorUserId }, client)
    await this.chartChanged(access.orgId, alert.patientId, id)
    return this.alertView((await this.findAlert(access, id))!)
  }

  async resolveAlert(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    const alert = await this.findAlert(access, id)
    if ((await this.clinical.closeAlert(id, 'active', { status: 'resolved' })) === 0) throw conflict('ALERT_CLOSED', 'This alert is no longer active.')
    await this.audit.record({ action: 'alert.resolved', entityType: 'alert', entityId: id, orgId: access.orgId, actorUserId }, client)
    await this.chartChanged(access.orgId, alert.patientId, id)
    return this.alertView((await this.findAlert(access, id))!)
  }

  async addAddendum(access: AccessContext, noteId: string, actorUserId: string, text: string, client: ClientInfo) {
    const scope = await this.careScope.resolve(access)
    if (!(await this.clinical.note(access.orgId, scope, noteId))) throw notFound('Note not found.')
    await this.clinical.addAddendum(noteId, text, actorUserId)
    await this.audit.record({ action: 'note.addendum', entityType: 'note', entityId: noteId, orgId: access.orgId, actorUserId }, client)
    return this.noteView((await this.clinical.note(access.orgId, scope, noteId))!)
  }

  // The clinical hub: today's appointments with their encounter, open encounters and serious alerts, in scope.
  async worklist(access: AccessContext, date: string) {
    const scope = await this.careScope.resolve(access)
    const zone = this.env.CLINIC_TIMEZONE
    const patients = this.clinical.patientScope(access.orgId, scope)
    const [me, appointments, encounters, alerts, ordersAwaitingReview, followUpsDue] = await Promise.all([
      this.practitioners.findByMembership(access.membershipId),
      this.prisma.appointment.findMany({
        where: { AND: [this.appointments.scoped(access.orgId, scope), { startsAt: { gte: zonedInstant(date, 0, zone), lt: zonedInstant(addDays(date, 1), 0, zone) } }] },
        orderBy: { startsAt: 'asc' },
        select: { id: true, reference: true, status: true, startsAt: true, queueToken: true, arrivedAt: true, reason: true, waitingQueue: true, patient: { select: { id: true, fullName: true, mrn: true } }, practitioner: { select: { id: true, displayName: true, department: true, room: true } }, encounter: { select: { id: true, reference: true, status: true } } },
      }),
      this.clinical.openEncounters(access.orgId, scope),
      this.clinical.seriousAlerts(access.orgId, scope),
      this.prisma.diagnosticOrder.count({ where: { orgId: access.orgId, status: 'awaiting_review', patient: patients } }),
      // Active care plans whose next review is on or before the worklist date.
      this.prisma.carePlan.count({ where: { orgId: access.orgId, status: { not: 'closed' }, nextReview: { lte: new Date(`${date}T00:00:00Z`) }, patient: patients } }),
    ])
    return {
      date,
      // The signed-in member's own therapist profile, for the hub's "my patients" view.
      me: { practitionerId: me?.id ?? null },
      appointments: appointments.map((row) => ({ ...row, startsAt: undefined, time: this.stamp(row.startsAt).time, arrivedAt: row.arrivedAt ? this.stamp(row.arrivedAt).time : null })),
      openEncounters: encounters.map((row) => ({ ...this.encounterView(row), patient: row.patient })),
      alerts: alerts.map((row) => ({ ...this.alertView(row), patient: row.patient })),
      ordersAwaitingReview,
      followUpsDue,
    }
  }

  // The member's care scope, after checking they may see this patient (404 otherwise, so ids are not probed).
  async visiblePatient(access: AccessContext, patientId: string): Promise<CareScope> {
    const scope = await this.careScope.resolve(access)
    if (!(await this.clinical.visiblePatient(access.orgId, scope, patientId))) throw notFound('Patient not found.')
    return scope
  }

  private async findEncounter(orgId: string, scope: CareScope, id: string) {
    const row = await this.clinical.encounter(orgId, scope, id)
    if (!row) throw notFound('Encounter not found.')
    return row
  }

  // An in-progress encounter of this patient, for entries recorded during a consultation.
  async openEncounterOf(orgId: string, scope: CareScope, encounterId: string, patientId: string) {
    const encounter = await this.findEncounter(orgId, scope, encounterId)
    if (encounter.patientId !== patientId) throw unprocessable('ENCOUNTER_MISMATCH', 'That encounter belongs to a different patient.')
    if (encounter.status !== 'in_progress') throw conflict('ENCOUNTER_SIGNED', 'This encounter is signed and locked.')
    return encounter
  }

  // Tells open charts that something changed. Only ids travel; the branch is the encounter's, else the patient's home.
  private async chartChanged(orgId: string, patientId: string, entityId: string, branchId?: string) {
    const branch = branchId ?? (await this.visitingBranch(orgId, patientId))
    if (branch) await this.live.publish([{ topic: 'records', orgId, entityId, patientId, branchId: branch }])
  }

  // The branch of the patient's visit under way today, or their home branch.
  private async visitingBranch(orgId: string, patientId: string) {
    const today = localDate(new Date(), this.env.CLINIC_TIMEZONE)
    const visit = await this.prisma.appointment.findFirst({
      where: { orgId, patientId, status: { in: ['arrived', 'in_progress'] }, startsAt: { gte: zonedInstant(today, 0, this.env.CLINIC_TIMEZONE) } },
      orderBy: { startsAt: 'asc' },
      select: { branchId: true },
    })
    return visit?.branchId ?? (await this.prisma.patient.findFirst({ where: { id: patientId, orgId }, select: { homeBranchId: true } }))?.homeBranchId
  }

  private async findAlert(access: AccessContext, id: string) {
    const row = await this.clinical.alert(access.orgId, await this.careScope.resolve(access), id)
    if (!row) throw notFound('Alert not found.')
    return row
  }
}
