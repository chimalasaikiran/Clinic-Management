import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import { AttendanceService } from './attendance.service'
import { attendanceQuerySchema, branchesSchema, correctAttendanceSchema, createLeaveSchema, createStaffSchema, inviteSchema, listStaffSchema, recordAttendanceSchema, updateStaffSchema } from './staff.schemas'
import { StaffService } from './staff.service'

// Workforce records. Viewing needs staff.view; changing a record staff.create; logins staff.credentials;
// attendance staff.attendance; leave and blocks staff.leave.
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get()
  @RequirePermissions('staff.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.staff.list(access.orgId, parse(listStaffSchema, query))
    return { data: items, meta }
  }

  @Get('summary')
  @RequirePermissions('staff.view')
  async summary(@CurrentAccess() access: AccessContext) {
    return { data: await this.staff.summary(access.orgId) }
  }

  @Get(':id')
  @RequirePermissions('staff.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.staff.get(access.orgId, parse(uuid, id)) }
  }

  @Get(':id/history')
  @RequirePermissions('staff.view')
  async history(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    const staffId = parse(uuid, id)
    await this.staff.find(access.orgId, staffId)
    return { data: await this.staff.history(access.orgId, staffId) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('staff.create')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.staff.create(access.orgId, auth.userId, parse(createStaffSchema, body), client) }
  }

  @Patch(':id')
  @RequirePermissions('staff.create')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.staff.update(access.orgId, parse(uuid, id), auth.userId, parse(updateStaffSchema, body), client) }
  }

  @Put(':id/branches')
  @RequirePermissions('staff.create')
  async setBranches(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.staff.setBranches(access.orgId, parse(uuid, id), auth.userId, parse(branchesSchema, body), client) }
  }

  @Post(':id/invite')
  @HttpCode(200)
  @RequirePermissions('staff.credentials')
  async invite(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.staff.invite(access, auth.userId, parse(uuid, id), parse(inviteSchema, body), client) }
  }

  @Get(':id/attendance')
  @RequirePermissions('staff.view')
  async attendanceMonth(@Param('id') id: string, @Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { month, branchId } = parse(attendanceQuerySchema, query)
    return { data: await this.attendance.month(access.orgId, parse(uuid, id), month, branchId) }
  }

  @Post(':id/attendance')
  @HttpCode(201)
  @RequirePermissions('staff.attendance')
  async recordAttendance(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.attendance.record(access.orgId, parse(uuid, id), auth.userId, parse(recordAttendanceSchema, body), client) }
  }

  @Patch(':id/attendance/:recordId')
  @RequirePermissions('staff.attendance')
  async correctAttendance(@Param('id') id: string, @Param('recordId') recordId: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.attendance.correct(access.orgId, parse(uuid, id), parse(uuid, recordId), auth.userId, parse(correctAttendanceSchema, body), client) }
  }

  @Get(':id/leaves')
  @RequirePermissions('staff.view')
  async leaves(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.attendance.leaves(access.orgId, parse(uuid, id)) }
  }

  @Post(':id/leaves')
  @HttpCode(201)
  @RequirePermissions('staff.leave')
  async createLeave(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.attendance.createLeave(access.orgId, parse(uuid, id), auth.userId, parse(createLeaveSchema, body), client) }
  }

  @Delete(':id/leaves/:leaveId')
  @RequirePermissions('staff.leave')
  async cancelLeave(@Param('id') id: string, @Param('leaveId') leaveId: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.attendance.cancelLeave(access.orgId, parse(uuid, id), parse(uuid, leaveId), auth.userId, client) }
  }
}
