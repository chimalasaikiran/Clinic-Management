import { Inject, Injectable } from '@nestjs/common'
import { forbidden, notFound } from '../../common/errors/app-error'
import type { AccessContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { addDays, localDate, localMinute, zonedInstant } from '../scheduling/clinic-time'
import { operationsReport, type ReportAppointment } from './operations.logic'

const WEEK = 7 * 24 * 60 * 60 * 1000

// Owner reports read straight from the operational records, within the branches the person's roles cover.
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Appointments starting in the period (clinic-local dates, inclusive), with what happened to them.
  async operations(access: AccessContext, query: { from: string; to: string; branchId?: string | null }) {
    const zone = this.env.CLINIC_TIMEZONE
    const orgBranches = await this.prisma.branch.findMany({ where: { orgId: access.orgId }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    const permitted = orgBranches.filter((branch) => access.branchScope === 'all' || access.branchScope.includes(branch.id))
    if (query.branchId) {
      if (!orgBranches.some((branch) => branch.id === query.branchId)) throw notFound('Branch not found.')
      if (!permitted.some((branch) => branch.id === query.branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    }
    const branchIds = query.branchId ? [query.branchId] : permitted.map((branch) => branch.id)
    const start = zonedInstant(query.from, 0, zone)
    const end = zonedInstant(addDays(query.to, 1), 0, zone)

    const [appointments, practitioners] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { orgId: access.orgId, branchId: { in: branchIds }, startsAt: { gte: start, lt: end } },
        select: {
          id: true, patientId: true, practitionerId: true, branchId: true, startsAt: true, endsAt: true, status: true, type: true, arrivedAt: true,
          events: { where: { action: { in: ['start', 'cancel', 'noShow', 'reschedule'] } }, select: { action: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.practitioner.findMany({
        where: { orgId: access.orgId, availability: { some: { branchId: { in: branchIds } } } },
        select: { id: true, displayName: true, membershipId: true, availability: { where: { branchId: { in: branchIds } }, select: { branchId: true, weekday: true, startMinute: true, endMinute: true } } },
        orderBy: { displayName: 'asc' },
      }),
    ])
    const patientIds = [...new Set(appointments.filter((row) => row.status === 'cancelled' || row.status === 'no_show').map((row) => row.patientId))]
    const [bookings, leaves] = await Promise.all([
      patientIds.length
        ? this.prisma.appointment.findMany({ where: { orgId: access.orgId, patientId: { in: patientIds }, createdAt: { gte: start, lt: new Date(end.getTime() + WEEK) } }, select: { patientId: true, createdAt: true } })
        : Promise.resolve([]),
      this.prisma.staffLeave.findMany({
        where: { status: 'scheduled', startDate: { lte: new Date(query.to) }, endDate: { gte: new Date(query.from) }, staff: { orgId: access.orgId, membershipId: { in: practitioners.map((row) => row.membershipId) } } },
        select: { startDate: true, endDate: true, startMinute: true, endMinute: true, branchId: true, staff: { select: { membershipId: true } } },
      }),
    ])
    const practitionerOf = new Map(practitioners.map((row) => [row.membershipId, row.id]))

    const rows: ReportAppointment[] = appointments.map((row) => {
      const at = (action: string) => row.events.findLast((event) => event.action === action)?.createdAt.getTime() ?? null
      return {
        id: row.id, patientId: row.patientId, practitionerId: row.practitionerId, branchId: row.branchId,
        date: localDate(row.startsAt, zone), startMinute: localMinute(row.startsAt, zone), minutes: Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000),
        status: row.status, type: row.type, arrivedAt: row.arrivedAt?.getTime() ?? null, startedAt: at('start'),
        closedAt: row.status === 'cancelled' ? at('cancel') : row.status === 'no_show' ? at('noShow') : null, rescheduled: row.events.some((event) => event.action === 'reschedule'),
      }
    })
    const report = operationsReport({
      from: query.from, to: query.to, today: localDate(new Date(), zone), now: Date.now(), appointments: rows,
      bookings: bookings.map((row) => ({ patientId: row.patientId, createdAt: row.createdAt.getTime() })),
      practitioners: practitioners.map((row) => ({ id: row.id, name: row.displayName })),
      availability: practitioners.flatMap((row) => row.availability.map((window) => ({ ...window, practitionerId: row.id }))),
      leaves: leaves.map((row) => ({
        practitionerId: practitionerOf.get(row.staff.membershipId!)!, startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate.toISOString().slice(0, 10),
        startMinute: row.startMinute, endMinute: row.endMinute, branchId: row.branchId,
      })),
      branchIds,
    })
    return { ...report, branches: permitted, branchId: query.branchId ?? null }
  }
}
