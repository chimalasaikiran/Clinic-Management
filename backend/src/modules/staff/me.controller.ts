import { Controller, Get, Header, Query } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import { PrismaService } from '../../database/prisma.service'
import { minuteToTime } from '../scheduling/clinic-time'
import { CurrentAccess, OrgMember } from '../permissions/access.decorators'
import { AttendanceService } from './attendance.service'
import { attendanceQuerySchema } from './staff.schemas'

// The signed-in person's own records in the organisation. Any member may read their own; nothing about anyone else.
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  private async ownStaffId(access: AccessContext) {
    const record = await this.prisma.staffMember.findFirst({ where: { orgId: access.orgId, membershipId: access.membershipId }, select: { id: true } })
    return record?.id ?? null
  }

  // One month of the member's own attendance. `linked` is false when they have no staff record.
  @Get('attendance')
  @OrgMember()
  @Header('Cache-Control', 'no-store')
  async myAttendance(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { month, branchId } = parse(attendanceQuerySchema, query)
    const staffId = await this.ownStaffId(access)
    if (!staffId) return { data: { linked: false, month, counts: { present: 0, late: 0, absent: 0, leave: 0, unavailable: 0 }, records: [] } }
    return { data: { linked: true, ...(await this.attendance.month(access.orgId, staffId, month, branchId)) } }
  }

  // The member's own leave and blocked time, as recorded by an authorised person.
  @Get('leaves')
  @OrgMember()
  @Header('Cache-Control', 'no-store')
  async myLeaves(@CurrentAccess() access: AccessContext) {
    const staffId = await this.ownStaffId(access)
    return { data: { linked: !!staffId, leaves: staffId ? await this.attendance.leaves(access.orgId, staffId) : [] } }
  }

  // The staff record linked to this membership, and the therapist profile if there is one. Either may be null.
  @Get('staff')
  @OrgMember()
  async staff(@CurrentAccess() access: AccessContext) {
    const [record, practitioner] = await Promise.all([
      this.prisma.staffMember.findFirst({
        where: { orgId: access.orgId, membershipId: access.membershipId },
        select: {
          id: true,
          staffCode: true,
          type: true,
          fullName: true,
          designation: true,
          department: true,
          mobile: true,
          email: true,
          status: true,
          council: true,
          councilNumber: true,
          qualifications: true,
          engagement: true,
          createdAt: true,
          branches: { orderBy: { isPrimary: 'desc' }, select: { isPrimary: true, branch: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.practitioner.findUnique({
        where: { membershipId: access.membershipId },
        select: {
          id: true, displayName: true, credentials: true, specialty: true, department: true, room: true, status: true, slotMinutes: true,
          availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }], select: { weekday: true, startMinute: true, endMinute: true, branch: { select: { id: true, name: true } } } },
        },
      }),
    ])
    return {
      data: {
        staff: record && { ...record, createdAt: record.createdAt.toISOString(), branches: record.branches.map((entry) => ({ ...entry.branch, primary: entry.isPrimary })) },
        practitioner: practitioner && {
          ...practitioner,
          // Weekly consulting hours; weekday 0 is Sunday.
          availability: practitioner.availability.map((window) => ({ weekday: window.weekday, start: minuteToTime(window.startMinute), end: minuteToTime(window.endMinute), branch: window.branch })),
        },
      },
    }
  }
}
