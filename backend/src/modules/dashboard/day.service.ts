import { Inject, Injectable } from '@nestjs/common'
import { forbidden, notFound } from '../../common/errors/app-error'
import type { AccessContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { AppointmentsRepository } from '../appointments/appointments.repository'
import { CareScope, CareScopeService } from '../scheduling/care-scope.service'
import { addDays, localDate, localMinute, minuteToTime, zonedInstant } from '../scheduling/clinic-time'
import { PractitionersRepository } from '../scheduling/practitioners.repository'

const LIST_LIMIT = 10
const EVENT_LIMIT = 8

const patientBrief = { select: { id: true, fullName: true, mrn: true, gender: true, dateOfBirth: true } } as const

type PatientBrief = { id: string; fullName: string; mrn: string; gender: string; dateOfBirth: Date }
const person = (row: PatientBrief) => ({ ...row, dateOfBirth: row.dateOfBirth.toISOString().slice(0, 10) })

// One day for the doctor, nurse and reception dashboards. Appointments follow the member's care scope; clinical
// detail is added only for members holding clinical.read, so a front-desk response never carries it.
@Injectable()
export class DayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsRepository,
    private readonly careScope: CareScopeService,
    private readonly practitioners: PractitionersRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async day(access: AccessContext, query: { date?: string; branchId?: string }) {
    const zone = this.env.CLINIC_TIMEZONE
    const today = localDate(new Date(), zone)
    const date = query.date ?? today
    const window = { gte: zonedInstant(date, 0, zone), lt: zonedInstant(addDays(date, 1), 0, zone) }
    const scope = await this.careScope.resolve(access)
    const branches = await this.branches(access, query.branchId)
    const branchIds = query.branchId ? [query.branchId] : branches.map((branch) => branch.id)
    const stamp = (instant: Date) => minuteToTime(localMinute(instant, zone))
    const visible: Prisma.AppointmentWhereInput = { AND: [this.appointments.scoped(access.orgId, scope), { branchId: { in: branchIds }, startsAt: window }] }

    const [me, rows, events] = await Promise.all([
      this.practitioners.findByMembership(access.membershipId),
      this.prisma.appointment.findMany({
        where: visible,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true, reference: true, status: true, type: true, startsAt: true, endsAt: true, queueToken: true, waitingQueue: true, arrivedAt: true, reason: true,
          patient: patientBrief,
          practitioner: { select: { id: true, displayName: true, department: true, room: true } },
          branch: { select: { id: true, name: true } },
          encounter: { select: { id: true, status: true } },
        },
      }),
      this.prisma.appointmentEvent.findMany({
        where: { appointment: visible },
        orderBy: { createdAt: 'desc' },
        take: EVENT_LIMIT,
        select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } }, appointment: { select: { id: true, queueToken: true, patient: { select: { id: true, fullName: true } } } } },
      }),
    ])
    const detail = access.permissions.has('clinical.read')
      ? await this.clinical(access.orgId, scope, branchIds, date, window, rows.map((row) => row.patient.id))
      : null

    return {
      date,
      today,
      timeZone: zone,
      generatedAt: new Date().toISOString(),
      me: { practitionerId: me?.id ?? null },
      branches,
      appointments: rows.map(({ encounter, ...row }) => ({
        id: row.id,
        reference: row.reference,
        status: row.status,
        type: row.type,
        time: stamp(row.startsAt),
        durationMinutes: Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000),
        token: row.queueToken,
        waitingQueue: row.waitingQueue,
        arrivedAt: row.arrivedAt?.toISOString() ?? null,
        arrivedTime: row.arrivedAt ? stamp(row.arrivedAt) : null,
        reason: row.reason,
        patient: person(row.patient),
        practitioner: row.practitioner,
        branch: row.branch,
        ...(detail && {
          encounter,
          vitals: detail.vitals.get(row.patient.id) ?? null,
          allergies: detail.allergies.get(row.patient.id) ?? [],
        }),
      })),
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        time: stamp(event.createdAt),
        actor: event.actor?.fullName ?? 'Patient app',
        appointmentId: event.appointment.id,
        token: event.appointment.queueToken,
        patient: event.appointment.patient,
      })),
      clinical: detail && {
        alerts: detail.alerts,
        results: detail.results,
        specimens: detail.specimens,
        unsigned: detail.unsigned,
        carePlans: detail.carePlans,
      },
    }
  }

  private async branches(access: AccessContext, branchId?: string) {
    const all = await this.prisma.branch.findMany({ where: { orgId: access.orgId }, orderBy: { code: 'asc' }, select: { id: true, name: true, city: true } })
    const permitted = all.filter((branch) => access.branchScope === 'all' || access.branchScope.includes(branch.id))
    if (branchId && !permitted.some((branch) => branch.id === branchId)) {
      if (all.some((branch) => branch.id === branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
      throw notFound('Branch not found.')
    }
    return permitted
  }

  // `todays` are the patients on the day's list; the other items cover everyone in the member's care scope.
  private async clinical(orgId: string, scope: CareScope, branchIds: string[], date: string, window: { gte: Date; lt: Date }, todays: string[]) {
    const own = scope.patients === 'all' ? null : scope.patients.practitionerId
    const patient: Prisma.PatientWhereInput = own ? { appointments: { some: { practitionerId: own } } } : {}
    const onList = { in: [...new Set(todays)] }
    // A member who sees every patient gets alerts for today's list; a clinician gets alerts for all their patients.
    const alertWhere: Prisma.ClinicalAlertWhereInput = { orgId, status: 'active', severity: { in: ['critical', 'high'] }, ...(own ? { patient } : { patientId: onList }) }
    const resultWhere: Prisma.DiagnosticOrderWhereInput = { orgId, branchId: { in: branchIds }, patient, status: 'awaiting_review' }
    const specimenWhere: Prisma.DiagnosticOrderWhereInput = { orgId, branchId: { in: branchIds }, patient, status: 'ordered', kind: 'lab' }
    const unsignedWhere: Prisma.EncounterWhereInput = { orgId, branchId: { in: branchIds }, status: 'in_progress', patient, ...(own ? { practitionerId: own } : {}) }
    const planWhere: Prisma.CarePlanWhereInput = { orgId, status: { not: 'closed' }, nextReview: { lte: new Date(`${date}T00:00:00Z`) }, patient }
    const orderSelect = { id: true, title: true, urgent: true, resultFlag: true, resultSummary: true, patient: patientBrief } as const
    const orderBy: Prisma.DiagnosticOrderOrderByWithRelationInput[] = [{ urgent: 'desc' }, { createdAt: 'asc' }]

    const [vitals, allergies, alerts, alertTotal, results, resultTotal, specimens, specimenTotal, unsigned, unsignedTotal, carePlans, carePlanTotal] = await Promise.all([
      this.prisma.vitalSign.findMany({ where: { orgId, patientId: onList, recordedAt: window }, orderBy: { recordedAt: 'desc' }, select: { patientId: true, systolic: true, diastolic: true, pulse: true, temperatureF: true, spo2: true } }),
      this.prisma.allergy.findMany({ where: { orgId, patientId: onList, active: true }, select: { patientId: true, substance: true, severity: true } }),
      this.prisma.clinicalAlert.findMany({ where: alertWhere, orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }], take: LIST_LIMIT, select: { id: true, title: true, detail: true, severity: true, patient: patientBrief } }),
      this.prisma.clinicalAlert.count({ where: alertWhere }),
      this.prisma.diagnosticOrder.findMany({ where: resultWhere, orderBy, take: LIST_LIMIT, select: orderSelect }),
      this.prisma.diagnosticOrder.count({ where: resultWhere }),
      this.prisma.diagnosticOrder.findMany({ where: specimenWhere, orderBy, take: LIST_LIMIT, select: orderSelect }),
      this.prisma.diagnosticOrder.count({ where: specimenWhere }),
      this.prisma.encounter.findMany({ where: unsignedWhere, orderBy: { startedAt: 'asc' }, take: LIST_LIMIT, select: { id: true, reference: true, appointment: { select: { status: true } }, patient: patientBrief } }),
      this.prisma.encounter.count({ where: unsignedWhere }),
      this.prisma.carePlan.findMany({ where: planWhere, orderBy: { nextReview: 'asc' }, take: LIST_LIMIT, select: { id: true, title: true, nextReview: true, patient: patientBrief } }),
      this.prisma.carePlan.count({ where: planWhere }),
    ])

    const latest = new Map<string, { systolic: number; diastolic: number; pulse: number; temperatureF: number; spo2: number }>()
    for (const { patientId, ...reading } of vitals) if (!latest.has(patientId)) latest.set(patientId, reading)
    const byPatient = new Map<string, Array<{ substance: string; severity: string }>>()
    for (const { patientId, ...allergy } of allergies) byPatient.set(patientId, [...(byPatient.get(patientId) ?? []), allergy])
    const list = <T extends { patient: PatientBrief }>(items: T[], total: number) => ({ total, items: items.map((item) => ({ ...item, patient: person(item.patient) })) })

    return {
      vitals: latest,
      allergies: byPatient,
      alerts: list(alerts, alertTotal),
      results: list(results, resultTotal),
      specimens: list(specimens, specimenTotal),
      unsigned: list(unsigned, unsignedTotal),
      carePlans: list(carePlans.map((plan) => ({ ...plan, nextReview: plan.nextReview.toISOString().slice(0, 10) })), carePlanTotal),
    }
  }
}
