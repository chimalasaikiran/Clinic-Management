import { Injectable } from '@nestjs/common'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { AttendanceStatus, LeaveKind, Prisma } from '../../generated/prisma/client'

export const attendanceSelect = {
  id: true,
  date: true,
  status: true,
  arrivalMinute: true,
  note: true,
  version: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
  recordedBy: { select: { fullName: true } },
  corrections: {
    orderBy: { createdAt: 'desc' },
    select: { id: true, fromStatus: true, toStatus: true, fromMinute: true, toMinute: true, reason: true, createdAt: true, correctedBy: { select: { fullName: true } } },
  },
} satisfies Prisma.AttendanceRecordSelect

export type AttendanceRow = Prisma.AttendanceRecordGetPayload<{ select: typeof attendanceSelect }>

export const leaveSelect = {
  id: true,
  kind: true,
  title: true,
  startDate: true,
  endDate: true,
  startMinute: true,
  endMinute: true,
  reason: true,
  status: true,
  createdAt: true,
  cancelledAt: true,
  branch: { select: { id: true, name: true } },
  createdBy: { select: { fullName: true } },
  cancelledBy: { select: { fullName: true } },
} satisfies Prisma.StaffLeaveSelect

export type LeaveRow = Prisma.StaffLeaveGetPayload<{ select: typeof leaveSelect }>

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  month(staffId: string, from: Date, to: Date, branchId?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { staffId, date: { gte: from, lt: to }, ...(branchId ? { branchId } : {}) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: attendanceSelect,
    })
  }

  find(staffId: string, id: string) {
    return this.prisma.attendanceRecord.findFirst({ where: { id, staffId }, select: attendanceSelect })
  }

  create(data: { staffId: string; branchId: string; date: Date; status: AttendanceStatus; arrivalMinute: number | null; note: string | null; recordedById: string }) {
    return this.prisma.attendanceRecord.create({ data, select: { id: true } })
  }

  // Optimistic locking: the correction applies only to the version the person was looking at.
  async correct(tx: Tx, id: string, version: number, change: { status: AttendanceStatus; arrivalMinute: number | null }) {
    const { count } = await tx.attendanceRecord.updateMany({ where: { id, version }, data: { ...change, version: { increment: 1 } } })
    return count
  }

  addCorrection(tx: Tx, data: { attendanceId: string; fromStatus: AttendanceStatus; toStatus: AttendanceStatus; fromMinute: number | null; toMinute: number | null; reason: string; correctedById: string }) {
    return tx.attendanceCorrection.create({ data, select: { id: true } })
  }

  staffBranch(staffId: string, branchId: string) {
    return this.prisma.staffBranch.findUnique({ where: { staffId_branchId: { staffId, branchId } }, select: { branchId: true } })
  }

  leaves(staffId: string) {
    return this.prisma.staffLeave.findMany({ where: { staffId }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }], select: leaveSelect })
  }

  findLeave(staffId: string, id: string) {
    return this.prisma.staffLeave.findFirst({ where: { id, staffId }, select: leaveSelect })
  }

  createLeave(data: { staffId: string; kind: LeaveKind; title: string; startDate: Date; endDate: Date; startMinute: number | null; endMinute: number | null; branchId: string | null; reason: string; createdById: string }) {
    return this.prisma.staffLeave.create({ data, select: { id: true } })
  }

  async cancelLeave(id: string, cancelledById: string) {
    const { count } = await this.prisma.staffLeave.updateMany({ where: { id, status: 'scheduled' }, data: { status: 'cancelled', cancelledById, cancelledAt: new Date() } })
    return count
  }

  // Open appointments with this person (as a therapist) between two instants, optionally at one branch.
  affectedAppointments(membershipId: string, from: Date, to: Date, branchId: string | null) {
    return this.prisma.appointment.findMany({
      where: { practitioner: { membershipId }, status: { in: ['pending', 'confirmed'] }, startsAt: { gte: from, lt: to }, ...(branchId ? { branchId } : {}) },
      select: { startsAt: true, endsAt: true },
    })
  }
}
