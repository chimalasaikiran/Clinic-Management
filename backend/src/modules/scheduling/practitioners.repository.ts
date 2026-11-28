import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { PractitionerStatus, Prisma } from '../../generated/prisma/client'
import { OPEN_STATUSES } from './scheduling.constants'

export interface PractitionerInput {
  displayName: string
  credentials: string | null
  specialty: string
  department: string
  room: string | null
  slotMinutes: number
  onlineBooking?: boolean
}

export interface AvailabilityRow {
  branchId: string
  weekday: number
  startMinute: number
  endMinute: number
}

const practitionerView = {
  id: true,
  membershipId: true,
  displayName: true,
  credentials: true,
  specialty: true,
  department: true,
  room: true,
  slotMinutes: true,
  onlineBooking: true,
  status: true,
  version: true,
  membership: { select: { userId: true, user: { select: { fullName: true, email: true } } } },
  availability: {
    select: { branchId: true, weekday: true, startMinute: true, endMinute: true, branch: { select: { name: true } } },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  },
} satisfies Prisma.PractitionerSelect

@Injectable()
export class PractitionersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string, filter: { status?: PractitionerStatus; branchId?: string }) {
    return this.prisma.practitioner.findMany({
      where: { orgId, status: filter.status, ...(filter.branchId ? { availability: { some: { branchId: filter.branchId } } } : {}) },
      orderBy: { displayName: 'asc' },
      select: practitionerView,
    })
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.practitioner.findFirst({ where: { id, orgId }, select: practitionerView })
  }

  findByMembership(membershipId: string) {
    return this.prisma.practitioner.findUnique({ where: { membershipId }, select: { id: true, status: true } })
  }

  // Active members who do not have a practitioner profile yet.
  candidates(orgId: string) {
    return this.prisma.membership.findMany({
      where: { orgId, status: 'active', practitioner: null },
      orderBy: { user: { fullName: 'asc' } },
      select: { id: true, user: { select: { fullName: true, email: true } } },
    })
  }

  activeMembership(orgId: string, membershipId: string) {
    return this.prisma.membership.findFirst({ where: { id: membershipId, orgId, status: 'active' }, select: { id: true } })
  }

  create(orgId: string, membershipId: string, input: PractitionerInput) {
    return this.prisma.practitioner.create({ data: { orgId, membershipId, ...input }, select: { id: true } })
  }

  async update(orgId: string, id: string, input: PractitionerInput & { status: PractitionerStatus }) {
    const { count } = await this.prisma.practitioner.updateMany({ where: { id, orgId }, data: { ...input, version: { increment: 1 } } })
    return count
  }

  activeBranchIds(orgId: string, branchIds: string[]) {
    return this.prisma.branch.findMany({ where: { orgId, id: { in: branchIds }, status: 'active' }, select: { id: true } })
  }

  async replaceAvailability(tx: Tx, practitionerId: string, rows: AvailabilityRow[]) {
    await tx.practitionerAvailability.deleteMany({ where: { practitionerId } })
    if (rows.length) await tx.practitionerAvailability.createMany({ data: rows.map((row) => ({ practitionerId, ...row })) })
    await tx.practitioner.update({ where: { id: practitionerId }, data: { version: { increment: 1 } } })
  }

  // Scheduled leave and blocks of the staff member behind this practitioner that touch [from, to] (dates).
  async leaves(practitionerId: string, from: string, to: string) {
    const rows = await this.prisma.staffLeave.findMany({
      where: { status: 'scheduled', startDate: { lte: new Date(`${to}T00:00:00Z`) }, endDate: { gte: new Date(`${from}T00:00:00Z`) }, staff: { membership: { practitioner: { id: practitionerId } } } },
      select: { startDate: true, endDate: true, startMinute: true, endMinute: true, branchId: true },
    })
    return rows.map((row) => ({ ...row, startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate.toISOString().slice(0, 10) }))
  }

  // Open appointments of a practitioner (at any branch: nobody is in two places) between two instants.
  busy(practitionerId: string, from: Date, to: Date, excludeAppointmentId?: string) {
    return this.prisma.appointment.findMany({
      where: {
        practitionerId,
        status: { in: [...OPEN_STATUSES] },
        waitingQueue: false,
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    })
  }
}
