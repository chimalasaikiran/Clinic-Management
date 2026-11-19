import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import {
  convertNewPatientSchema, convertSchema, createLeadSchema, dispositionSchema, duplicatesSchema, interactionSchema, listLeadsSchema, ownersSchema, performanceSchema, updateLeadSchema,
} from './leads.schemas'
import { LeadsService } from './leads.service'

@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.leads.list(access, parse(listLeadsSchema, query))
    return { data: items, meta }
  }

  // The fixed paths are declared before ':id' so they are not read as lead ids.
  @Get('owners')
  @RequirePermissions('growth.view')
  async owners(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.leads.owners(access, parse(ownersSchema, query).branchId) }
  }

  @Get('duplicates')
  @RequirePermissions('growth.leads')
  async duplicates(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { mobile, excludeId } = parse(duplicatesSchema, query)
    return { data: await this.leads.duplicates(access, mobile, excludeId) }
  }

  @Get('performance')
  @RequirePermissions('growth.view')
  async performance(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.leads.performance(access, parse(performanceSchema, query)) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.leads.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.leads')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.leads.create(access, auth.userId, parse(createLeadSchema, body), client) }
  }

  @Patch(':id')
  @RequirePermissions('growth.leads')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.leads.update(access, parse(uuid, id), auth.userId, parse(updateLeadSchema, body), client) }
  }

  @Post(':id/interactions')
  @HttpCode(201)
  @RequirePermissions('growth.leads')
  async interaction(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.leads.recordInteraction(access, parse(uuid, id), auth.userId, parse(interactionSchema, body), client) }
  }

  @Post(':id/disposition')
  @HttpCode(200)
  @RequirePermissions('growth.leads')
  async disposition(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.leads.setDisposition(access, parse(uuid, id), auth.userId, parse(dispositionSchema, body), client) }
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermissions('growth.leads', 'patients.view')
  async convert(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.leads.convert(access, parse(uuid, id), auth.userId, parse(convertSchema, body), client) }
  }

  @Post(':id/convert/new-patient')
  @HttpCode(201)
  @RequirePermissions('growth.leads', 'patients.create')
  async convertNew(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.leads.convertToNewPatient(access, parse(uuid, id), auth.userId, parse(convertNewPatientSchema, body), client) }
  }
}
