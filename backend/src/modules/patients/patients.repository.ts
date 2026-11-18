import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { PatientStatus, Prisma } from '../../generated/prisma/client'
import type { CareScope } from '../scheduling/care-scope.service'
import type { ListPatientsQuery, PatientFields } from './patients.schemas'

export const patientSelect = {
  id: true,
  mrn: true,
  title: true,
  fullName: true,
  alias: true,
  aadhaarLast4: true,
  abhaNumber: true,
  mobile: true,
  altMobile: true,
  email: true,
  addressLine: true,
  area: true,
  city: true,
  state: true,
  pinCode: true,
  dateOfBirth: true,
  gender: true,
  bloodGroup: true,
  language: true,
  emergencyName: true,
  emergencyRelation: true,
  emergencyPhone: true,
  notifyWhatsapp: true,
  notifySms: true,
  intakeUnit: true,
  status: true,
  statusNote: true,
  version: true,
  createdAt: true,
  homeBranch: { select: { id: true, name: true } },
  // The most recent completed visit, for "last visit & attending".
  appointments: {
    where: { status: 'completed' },
    orderBy: { startsAt: 'desc' },
    take: 1,
    select: { startsAt: true, practitioner: { select: { displayName: true, department: true } } },
  },
} as const satisfies Prisma.PatientSelect

export type PatientRow = Prisma.PatientGetPayload<{ select: typeof patientSelect }>

const DAY_MS = 86_400_000

@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Organisation filter plus the member's care scope; every read goes through this.
  private scoped(orgId: string, scope: CareScope): Prisma.PatientWhereInput {
    return { orgId, ...(scope.patients === 'all' ? {} : { appointments: { some: { practitionerId: scope.patients.practitionerId } } }) }
  }

  async search(orgId: string, scope: CareScope, query: ListPatientsQuery, now = new Date()) {
    const filters: Prisma.PatientWhereInput[] = [this.scoped(orgId, scope)]
    const text = query.query?.trim()
    if (text) {
      const digits = text.replace(/\D/g, '')
      filters.push({
        OR: [
          { fullName: { contains: text, mode: 'insensitive' } },
          { mrn: { contains: text, mode: 'insensitive' } },
          { abhaNumber: { contains: text } },
          ...(digits.length >= 3 ? [{ mobile: { contains: digits } }, { altMobile: { contains: digits } }] : []),
        ],
      })
    }
    if (query.status) filters.push({ status: query.status })
    if (query.gender) filters.push({ gender: query.gender })
    if (query.branchId) filters.push({ homeBranchId: query.branchId })
    if (query.department) filters.push({ appointments: { some: { practitioner: { department: query.department } } } })
    if (query.visitWithinDays) {
      filters.push({ appointments: { some: { status: 'completed', startsAt: { gte: new Date(now.getTime() - query.visitWithinDays * DAY_MS) } } } })
    }

    const where: Prisma.PatientWhereInput = { AND: filters }
    const [total, rows] = await Promise.all([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: patientSelect }),
    ])
    return { total, rows }
  }

  find(orgId: string, scope: CareScope, id: string, db: Db = this.prisma) {
    return db.patient.findFirst({ where: { AND: [this.scoped(orgId, scope), { id }] }, select: patientSelect })
  }

  findByMobile(orgId: string, mobile: string, excludeId?: string) {
    return this.prisma.patient.findMany({
      where: { orgId, mobile, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: patientSelect,
    })
  }

  activeBranch(orgId: string, branchId: string) {
    return this.prisma.branch.findFirst({ where: { id: branchId, orgId, status: 'active' }, select: { id: true } })
  }

  create(tx: Tx, orgId: string, mrn: string, fields: PatientFields, createdById: string) {
    const { dateOfBirth, ...rest } = fields
    return tx.patient.create({ data: { ...rest, orgId, mrn, dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`), createdById }, select: { id: true } })
  }

  // Optimistic locking: the update only applies to the version the editor started from.
  async update(orgId: string, id: string, version: number, fields: PatientFields) {
    const { dateOfBirth, ...rest } = fields
    const { count } = await this.prisma.patient.updateMany({
      where: { id, orgId, version },
      data: { ...rest, dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`), version: { increment: 1 } },
    })
    return count
  }

  async setStatus(orgId: string, id: string, status: PatientStatus, note: string | null) {
    const { count } = await this.prisma.patient.updateMany({ where: { id, orgId }, data: { status, statusNote: note, version: { increment: 1 } } })
    return count
  }

  exists(orgId: string, id: string) {
    return this.prisma.patient.findFirst({ where: { id, orgId }, select: { id: true } })
  }
}
