import { Inject, Injectable } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { AppointmentsRepository } from '../appointments/appointments.repository'
import { PatientsRepository } from '../patients/patients.repository'
import { CareScopeService } from '../scheduling/care-scope.service'
import { localDate, localMinute, minuteToTime } from '../scheduling/clinic-time'

// Results per group: the header search is for jumping to a record, the full lists live on each page.
export const SEARCH_LIMIT = 5

// The header search: patients, appointments and invoices matching the text, each group only for people who may
// read those records, and within the same scope the record's own pages use (care scope, branches).
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsRepository,
    private readonly appointments: AppointmentsRepository,
    private readonly careScope: CareScopeService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async search(access: AccessContext, text: string) {
    const { orgId } = access
    const zone = this.env.CLINIC_TIMEZONE
    const can = (permission: string) => access.permissions.has(permission)
    const scope = can('patients.view') || can('bookings.view') ? await this.careScope.resolve(access) : null
    const contains = { contains: text, mode: 'insensitive' as const }
    const patientMatch = { OR: [{ fullName: contains }, { mrn: contains }] }

    const [patients, appointments, invoices] = await Promise.all([
      can('patients.view') && scope ? this.patients.search(orgId, scope, { query: text, page: 1, pageSize: SEARCH_LIMIT }) : null,
      can('bookings.view') && scope
        ? this.prisma.appointment.findMany({
            where: { AND: [this.appointments.scoped(orgId, scope), { OR: [{ reference: contains }, { patient: patientMatch }] }] },
            orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
            take: SEARCH_LIMIT,
            select: { id: true, reference: true, startsAt: true, status: true, patientId: true, patient: { select: { fullName: true, mrn: true } }, practitioner: { select: { displayName: true } }, branch: { select: { name: true } } },
          })
        : null,
      // Billing records are organisation-wide, as on the billing pages.
      can('accounting.invoices')
        ? this.prisma.invoice.findMany({
            where: { orgId, OR: [{ reference: contains }, { patient: patientMatch }] },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: SEARCH_LIMIT,
            select: { reference: true, invoiceDate: true, title: true, total: true, patient: { select: { fullName: true, mrn: true } } },
          })
        : null,
    ])

    return {
      query: text,
      patients: patients && patients.rows.map((row) => ({ id: row.id, mrn: row.mrn, fullName: row.fullName, mobile: row.mobile, status: row.status })),
      appointments: appointments && appointments.map((row) => ({
        id: row.id, reference: row.reference, date: localDate(row.startsAt, zone), time: minuteToTime(localMinute(row.startsAt, zone)), status: row.status, patientId: row.patientId,
        patient: row.patient.fullName, mrn: row.patient.mrn, practitioner: row.practitioner.displayName, branch: row.branch.name,
      })),
      invoices: invoices && invoices.map((row) => ({
        reference: row.reference, date: row.invoiceDate.toISOString().slice(0, 10), title: row.title, total: Number(row.total), patient: row.patient.fullName, mrn: row.patient.mrn,
      })),
    }
  }
}
