import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { checkInSchema, closeSchema, createAppointmentSchema, listAppointmentsSchema, rescheduleSchema } from './appointments.schemas'
import { AppointmentsService } from './appointments.service'

// Status changes are separate actions (not a writable "status" field), so the server decides every transition.
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @RequirePermissions('bookings.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.appointments.list(access, parse(listAppointmentsSchema, query))
    return { data: items, meta }
  }

  @Get(':id')
  @RequirePermissions('bookings.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.appointments.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('bookings.create')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.create(access, auth.userId, parse(createAppointmentSchema, body), client) }
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions('bookings.create')
  async confirm(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.confirm(access, parse(uuid, id), auth.userId, client) }
  }

  @Post(':id/check-in')
  @HttpCode(200)
  @RequirePermissions('bookings.create')
  async checkIn(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.checkIn(access, parse(uuid, id), auth.userId, parse(checkInSchema, body ?? {}).note, client) }
  }

  @Post(':id/start')
  @HttpCode(200)
  @RequireAnyPermission('clinical.write')
  async start(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.start(access, parse(uuid, id), auth.userId, client) }
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequireAnyPermission('clinical.write')
  async complete(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.complete(access, parse(uuid, id), auth.userId, client) }
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  @RequirePermissions('bookings.reschedule')
  async reschedule(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.reschedule(access, parse(uuid, id), auth.userId, parse(rescheduleSchema, body), client) }
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('bookings.cancel')
  async cancel(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.cancel(access, parse(uuid, id), auth.userId, parse(closeSchema, body), client) }
  }

  @Post(':id/no-show')
  @HttpCode(200)
  @RequirePermissions('bookings.cancel')
  async noShow(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.noShow(access, parse(uuid, id), auth.userId, parse(closeSchema, body), client) }
  }
}
