import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { availabilitySchema, createPractitionerSchema, listPractitionersSchema, slotsQuerySchema, updatePractitionerSchema } from './practitioners.schemas'
import { PractitionersService } from './practitioners.service'

// Therapists (doctors and other practitioners), their weekly consulting hours and bookable slots.
// Managing profiles and hours needs bookings.assign ("Assign & dispatch therapist").
@Controller({ path: 'practitioners', version: '1' })
export class PractitionersController {
  constructor(private readonly practitioners: PractitionersService) {}

  @Get()
  // Clinicians pick therapists as referral targets and care-plan leads.
  @RequireAnyPermission('bookings.view', 'bookings.create', 'bookings.assign', 'clinical.write')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.practitioners.list(access.orgId, parse(listPractitionersSchema, query)) }
  }

  @Get('candidates')
  @RequirePermissions('bookings.assign')
  async candidates(@CurrentAccess() access: AccessContext) {
    return { data: await this.practitioners.candidates(access.orgId) }
  }

  @Get(':id')
  @RequireAnyPermission('bookings.view', 'bookings.create', 'bookings.assign')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.practitioners.get(access.orgId, parse(uuid, id)) }
  }

  @Get(':id/slots')
  @RequireAnyPermission('bookings.create', 'bookings.reschedule')
  async slots(@Param('id') id: string, @Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.practitioners.slots(access.orgId, parse(uuid, id), parse(slotsQuerySchema, query)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('bookings.assign')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.practitioners.create(access.orgId, auth.userId, parse(createPractitionerSchema, body), client) }
  }

  @Patch(':id')
  @RequirePermissions('bookings.assign')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.practitioners.update(access.orgId, parse(uuid, id), auth.userId, parse(updatePractitionerSchema, body), client) }
  }

  @Put(':id/availability')
  @RequirePermissions('bookings.assign')
  async setAvailability(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.practitioners.setAvailability(access.orgId, parse(uuid, id), auth.userId, parse(availabilitySchema, body), client) }
  }
}
