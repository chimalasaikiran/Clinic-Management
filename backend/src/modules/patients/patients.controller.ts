import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { createPatientSchema, duplicatesQuerySchema, listPatientsSchema, patientStatusSchema, updatePatientSchema } from './patients.schemas'
import { PatientsService } from './patients.service'

@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @RequirePermissions('patients.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.patients.list(access, parse(listPatientsSchema, query))
    return { data: items, meta }
  }

  // Declared before ':id' so "duplicates" is not read as a patient id.
  @Get('duplicates')
  @RequireAnyPermission('patients.create', 'patients.edit')
  async duplicates(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { mobile, excludeId } = parse(duplicatesQuerySchema, query)
    return { data: await this.patients.duplicates(access.orgId, mobile, excludeId) }
  }

  @Get(':id')
  @RequirePermissions('patients.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.patients.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('patients.create')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.patients.create(access, auth.userId, parse(createPatientSchema, body), client) }
  }

  @Patch(':id')
  @RequirePermissions('patients.edit')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.patients.update(access, parse(uuid, id), auth.userId, parse(updatePatientSchema, body), client) }
  }

  @Patch(':id/status')
  @RequirePermissions('patients.edit')
  async setStatus(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.patients.setStatus(access, parse(uuid, id), auth.userId, parse(patientStatusSchema, body), client) }
  }
}
