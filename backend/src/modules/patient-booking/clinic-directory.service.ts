import { Inject, Injectable } from '@nestjs/common'
import { notFound } from '../../common/errors/app-error'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { addDays, localDate } from '../scheduling/clinic-time'
import { AvailabilityService } from './availability.service'
import type { ClinicsQuery } from './booking.schemas'
import { PatientRecordService } from './patient-record.service'

// What the patient app may show of a branch. Only branches a clinic has listed are ever selected.
const clinicSelect = {
  id: true,
  orgId: true,
  name: true,
  facilityType: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  pinCode: true,
  phone: true,
  latitude: true,
  longitude: true,
  organisation: { select: { displayName: true, specialties: true } },
} as const satisfies Prisma.BranchSelect

type ClinicRow = Prisma.BranchGetPayload<{ select: typeof clinicSelect }>

const listed: Prisma.BranchWhereInput = { listedInPatientApp: true, status: 'active', organisation: { status: { not: 'suspended' } } }

@Injectable()
export class ClinicDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly records: PatientRecordService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // The listed branch behind an id, or "not found": unlisted branches cannot be told apart from missing ones.
  async find(branchId: string) {
    const row = await this.prisma.branch.findFirst({ where: { ...listed, id: branchId }, select: clinicSelect })
    if (!row) throw notFound('Clinic not found.')
    return row
  }

  async list(accountId: string, query: ClinicsQuery) {
    const text = query.query
    const where: Prisma.BranchWhereInput = {
      AND: [
        listed,
        text
          ? {
              OR: [
                { name: { contains: text, mode: 'insensitive' } },
                { city: { contains: text, mode: 'insensitive' } },
                { pinCode: { startsWith: text } },
                { organisation: { displayName: { contains: text, mode: 'insensitive' } } },
              ],
            }
          : {},
        query.department ? { availability: { some: { practitioner: { department: query.department, status: 'active', onlineBooking: true } } } } : {},
        query.saved ? { savedBy: { some: { accountId } } } : {},
      ],
    }
    const [total, rows] = await Promise.all([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({ where, orderBy: [{ organisation: { displayName: 'asc' } }, { name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: clinicSelect }),
    ])
    return { items: await this.cards(accountId, rows), page: query.page, pageSize: query.pageSize, total }
  }

  async detail(accountId: string, branchId: string) {
    const row = await this.find(branchId)
    const today = localDate(new Date(), this.env.CLINIC_TIMEZONE)
    const [cards, services, hours, closures, booking] = await Promise.all([
      this.cards(accountId, [row]),
      this.availability.services(row.orgId, branchId),
      this.prisma.branchHours.findMany({ where: { branchId }, orderBy: [{ weekday: 'asc' }, { start: 'asc' }], select: { weekday: true, start: true, end: true } }),
      this.prisma.branchClosure.findMany({
        where: { branchId, date: { gte: new Date(`${today}T00:00:00Z`), lte: new Date(`${addDays(today, 60)}T00:00:00Z`) } },
        orderBy: { date: 'asc' },
        select: { date: true, kind: true, reason: true },
      }),
      this.records.preview(accountId, row.orgId),
    ])
    return {
      ...cards[0]!,
      services,
      hours,
      closures: closures.map((closure) => ({ ...closure, date: closure.date.toISOString().slice(0, 10) })),
      // Whose record a booking here would go on, so the app can say so before the patient confirms.
      booking: booking.status === 'linked' ? { status: booking.status, patientName: booking.patientName } : booking,
    }
  }

  async setSaved(accountId: string, branchId: string, saved: boolean) {
    if (saved) {
      await this.find(branchId)
      await this.prisma.savedClinic.createMany({ data: [{ accountId, branchId }], skipDuplicates: true })
    } else {
      await this.prisma.savedClinic.deleteMany({ where: { accountId, branchId } })
    }
    return { saved }
  }

  // Fetched for the whole page at once, so a longer list does not mean more queries.
  private async cards(accountId: string, rows: ClinicRow[]) {
    const branchIds = rows.map((row) => row.id)
    const [saved, links, therapists, services] = await Promise.all([
      this.prisma.savedClinic.findMany({ where: { accountId, branchId: { in: branchIds } }, select: { branchId: true } }),
      this.prisma.patientLink.findMany({ where: { accountId, revokedAt: null, orgId: { in: rows.map((row) => row.orgId) } }, select: { orgId: true } }),
      this.prisma.practitionerAvailability.findMany({
        where: { branchId: { in: branchIds }, practitioner: { status: 'active', onlineBooking: true, membership: { status: 'active' } } },
        distinct: ['branchId', 'practitionerId'],
        select: { branchId: true, practitioner: { select: { department: true } } },
      }),
      this.prisma.billingService.findMany({
        where: { status: 'active', patientBookable: true, prices: { some: { branchId: { in: branchIds } } } },
        select: { department: true, prices: { where: { branchId: { in: branchIds } }, select: { branchId: true } } },
      }),
    ])
    return rows.map(({ organisation, latitude, longitude, ...row }) => {
      const departments = new Set(therapists.filter((entry) => entry.branchId === row.id).map((entry) => entry.practitioner.department))
      const bookable = services.filter((service) => service.department && departments.has(service.department) && service.prices.some((price) => price.branchId === row.id))
      return {
        ...row,
        clinicName: organisation.displayName,
        specialties: organisation.specialties,
        latitude: latitude === null ? null : Number(latitude),
        longitude: longitude === null ? null : Number(longitude),
        departments: [...new Set(bookable.map((service) => service.department!))].sort(),
        onlineBooking: bookable.length > 0,
        saved: saved.some((entry) => entry.branchId === row.id),
        connected: links.some((link) => link.orgId === row.orgId),
      }
    })
  }
}
