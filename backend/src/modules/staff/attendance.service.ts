import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import { addDays, localDate, localMinute, minuteToTime, timeToMinute, zonedInstant } from '../scheduling/clinic-time'
import { AttendanceRepository, AttendanceRow, LeaveRow } from './attendance.repository'
import type { CorrectAttendanceInput, CreateLeaveInput, RecordAttendanceInput } from './staff.schemas'
import { StaffService } from './staff.service'

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const isoOf = (date: Date) => date.toISOString().slice(0, 10)
const timed = (status: string) => status === 'present' || status === 'late'

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceRepository,
    private readonly staff: StaffService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private view(row: AttendanceRow) {
    return {
      id: row.id,
      date: isoOf(row.date),
      status: row.status,
      time: row.arrivalMinute === null ? null : minuteToTime(row.arrivalMinute),
      note: row.note,
      branch: row.branch,
      recordedBy: row.recordedBy.fullName,
      recordedAt: row.createdAt.toISOString(),
      version: row.version,
      corrections: row.corrections.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        fromTime: entry.fromMinute === null ? null : minuteToTime(entry.fromMinute),
        toTime: entry.toMinute === null ? null : minuteToTime(entry.toMinute),
        reason: entry.reason,
        by: entry.correctedBy.fullName,
        at: entry.createdAt.toISOString(),
      })),
    }
  }

  // One month of records and the counts per status for it.
  async month(orgId: string, staffId: string, month: string, branchId?: string) {
    await this.staff.find(orgId, staffId)
    const from = asDate(`${month}-01`)
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
    const rows = await this.attendance.month(staffId, from, to, branchId)
    const counts = { present: 0, late: 0, absent: 0, leave: 0, unavailable: 0 }
    for (const row of rows) counts[row.status] += 1
    return { month, counts, records: rows.map((row) => this.view(row)) }
  }

  async record(orgId: string, staffId: string, actorUserId: string, input: RecordAttendanceInput, client: ClientInfo) {
    await this.staff.find(orgId, staffId)
    if (!(await this.attendance.staffBranch(staffId, input.branchId))) throw unprocessable('BRANCH_NOT_ASSIGNED', 'This person is not assigned to that branch. Assign the branch first.')
    if (input.date > localDate(new Date(), this.env.CLINIC_TIMEZONE)) throw unprocessable('DATE_IN_FUTURE', 'Attendance can only be recorded for today or earlier.')
    try {
      const { id } = await this.attendance.create({
        staffId,
        branchId: input.branchId,
        date: asDate(input.date),
        status: input.status,
        arrivalMinute: timed(input.status) ? timeToMinute(input.time!) : null,
        note: input.note,
        recordedById: actorUserId,
      })
      await this.audit.record({ action: 'staff.attendance_recorded', entityType: 'staff', entityId: staffId, orgId, actorUserId, details: { date: input.date, status: input.status } }, client)
      return this.view((await this.attendance.find(staffId, id))!)
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('ATTENDANCE_EXISTS', 'Attendance is already recorded for this person, branch and date. Correct the existing record instead.')
      throw error
    }
  }

  async correct(orgId: string, staffId: string, id: string, actorUserId: string, input: CorrectAttendanceInput, client: ClientInfo) {
    await this.staff.find(orgId, staffId)
    const current = await this.attendance.find(staffId, id)
    if (!current) throw notFound('Attendance record not found.')
    const arrivalMinute = timed(input.status) ? timeToMinute(input.time!) : null
    await this.prisma.transaction(async (tx) => {
      if ((await this.attendance.correct(tx, id, input.version, { status: input.status, arrivalMinute })) === 0) {
        throw conflict('ATTENDANCE_CHANGED', 'Someone else corrected this record first. Reload to see the latest values.')
      }
      await this.attendance.addCorrection(tx, { attendanceId: id, fromStatus: current.status, toStatus: input.status, fromMinute: current.arrivalMinute, toMinute: arrivalMinute, reason: input.reason, correctedById: actorUserId })
      await this.audit.record({ action: 'staff.attendance_corrected', entityType: 'staff', entityId: staffId, orgId, actorUserId, details: { date: isoOf(current.date), from: current.status, to: input.status } }, client, tx)
    })
    return this.view((await this.attendance.find(staffId, id))!)
  }

  private leaveView(row: LeaveRow) {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      startDate: isoOf(row.startDate),
      endDate: isoOf(row.endDate),
      startTime: row.startMinute === null ? null : minuteToTime(row.startMinute),
      endTime: row.endMinute === null ? null : minuteToTime(row.endMinute),
      branch: row.branch,
      reason: row.reason,
      status: row.status,
      createdBy: row.createdBy.fullName,
      createdAt: row.createdAt.toISOString(),
      cancelledBy: row.cancelledBy?.fullName ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    }
  }

  async leaves(orgId: string, staffId: string) {
    await this.staff.find(orgId, staffId)
    return (await this.attendance.leaves(staffId)).map((row) => this.leaveView(row))
  }

  // Records leave or a block. While scheduled it removes the person's bookable slots; appointments already
  // booked in the window are reported back so the desk can move them, never cancelled automatically.
  async createLeave(orgId: string, staffId: string, actorUserId: string, input: CreateLeaveInput, client: ClientInfo) {
    const person = await this.staff.find(orgId, staffId)
    if (input.branchId && !person.branches.some((entry) => entry.branch.id === input.branchId)) {
      throw unprocessable('BRANCH_NOT_ASSIGNED', 'This person is not assigned to that branch.')
    }
    const startMinute = input.startTime ? timeToMinute(input.startTime) : null
    const endMinute = input.endTime ? timeToMinute(input.endTime) : null
    const { id } = await this.attendance.createLeave({
      staffId,
      kind: input.kind,
      title: input.title,
      startDate: asDate(input.startDate),
      endDate: asDate(input.endDate),
      startMinute,
      endMinute,
      branchId: input.branchId,
      reason: input.reason,
      createdById: actorUserId,
    })
    await this.audit.record({ action: 'staff.leave_created', entityType: 'staff', entityId: staffId, orgId, actorUserId, details: { kind: input.kind, from: input.startDate, to: input.endDate } }, client)

    const zone = this.env.CLINIC_TIMEZONE
    let affected = 0
    if (person.membershipId) {
      const appointments = await this.attendance.affectedAppointments(person.membershipId, zonedInstant(input.startDate, 0, zone), zonedInstant(addDays(input.endDate, 1), 0, zone), input.branchId)
      affected = appointments.filter((entry) => startMinute === null || (localMinute(entry.startsAt, zone) < endMinute! && localMinute(entry.endsAt, zone) > startMinute)).length
    }
    return { leave: this.leaveView((await this.attendance.findLeave(staffId, id))!), affectedAppointments: affected }
  }

  async cancelLeave(orgId: string, staffId: string, id: string, actorUserId: string, client: ClientInfo) {
    await this.staff.find(orgId, staffId)
    if (!(await this.attendance.findLeave(staffId, id))) throw notFound('Leave not found.')
    if ((await this.attendance.cancelLeave(id, actorUserId)) === 0) throw conflict('LEAVE_CLOSED', 'This leave is already cancelled.')
    await this.audit.record({ action: 'staff.leave_cancelled', entityType: 'staff', entityId: staffId, orgId, actorUserId }, client)
    return this.leaveView((await this.attendance.findLeave(staffId, id))!)
  }
}
