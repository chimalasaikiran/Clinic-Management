import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { localDate } from '../scheduling/clinic-time'
import { ClinicalRepository } from './clinical.repository'
import { ClinicalService } from './clinical.service'
import type { CreateIncidentInput } from './incidents.schemas'

const incidentSelect = {
  id: true,
  reference: true,
  category: true,
  severity: true,
  occurredOn: true,
  occurredTime: true,
  zone: true,
  headline: true,
  chronology: true,
  factors: true,
  actions: true,
  witnesses: true,
  notifyQuality: true,
  logRegister: true,
  createdAt: true,
  patient: { select: { id: true, fullName: true, mrn: true } },
  branch: { select: { id: true, name: true } },
  reporter: { select: { fullName: true } },
} satisfies Prisma.IncidentSelect

type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof incidentSelect }>

// Severity 5 is a sentinel event.
const SENTINEL = 5

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: ClinicalService,
    private readonly clinicalRecords: ClinicalRepository,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private view = (row: IncidentRow) => ({
    ...row,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    reporter: row.reporter?.fullName ?? 'Anonymous (safe harbor)',
    created: this.clinical.stamp(row.createdAt),
    createdAt: undefined,
  })

  async list(access: AccessContext, page: number, pageSize: number) {
    const where = { orgId: access.orgId }
    const [rows, total] = await Promise.all([
      this.prisma.incident.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: incidentSelect }),
      this.prisma.incident.count({ where }),
    ])
    return { data: rows.map(this.view), meta: { page, pageSize, total } }
  }

  // Any member may report. An anonymous report keeps no trace of who filed it: no reporter, and an audit entry
  // without the actor or their connection details. A sentinel event involving a patient flags their chart.
  async report(access: AccessContext, actorUserId: string, input: CreateIncidentInput, client: ClientInfo) {
    if (input.date > localDate(new Date(), this.env.CLINIC_TIMEZONE)) throw unprocessable('DATE_IN_FUTURE', 'The incident cannot have occurred in the future.')
    if (input.patientId) await this.clinical.visiblePatient(access, input.patientId)
    if (!(await this.prisma.branch.findFirst({ where: { id: input.branchId, orgId: access.orgId }, select: { id: true } }))) throw unprocessable('BRANCH_INVALID', 'Choose a branch of this organisation.')

    const id = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('INC-', await this.counters.next(tx, access.orgId, 'incident_reference'))
      const created = await tx.incident.create({
        data: {
          orgId: access.orgId, reference, patientId: input.patientId ?? null, branchId: input.branchId, category: input.category, severity: input.severity,
          occurredOn: new Date(`${input.date}T00:00:00Z`), occurredTime: input.time, zone: input.zone, headline: input.headline, chronology: input.chronology,
          factors: input.factors, actions: input.actions, witnesses: input.witnesses, notifyQuality: input.notifyQuality, logRegister: input.logRegister,
          reporterId: input.anonymous ? null : actorUserId,
        },
        select: { id: true },
      })
      if (input.severity === SENTINEL && input.patientId) {
        await this.clinicalRecords.createAlert(tx, {
          orgId: access.orgId, patientId: input.patientId, kind: 'SENTINEL EVENT', title: `Sentinel incident ${reference}: ${input.headline}`, severity: 'critical',
          detail: 'Reported as a sentinel safety event. Review the incident before the next clinical action.', createdById: input.anonymous ? null : actorUserId,
        })
      }
      await this.audit.record(
        { action: 'incident.reported', entityType: 'incident', entityId: created.id, orgId: access.orgId, actorUserId: input.anonymous ? null : actorUserId, details: { reference, severity: input.severity } },
        input.anonymous ? null : client,
        tx,
      )
      return created.id
    })
    return this.view(await this.prisma.incident.findUniqueOrThrow({ where: { id }, select: incidentSelect }))
  }
}
