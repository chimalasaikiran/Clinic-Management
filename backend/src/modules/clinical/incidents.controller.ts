import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, OrgMember, RequirePermissions } from '../permissions/access.decorators'
import { createIncidentSchema, listIncidentsSchema } from './incidents.schemas'
import { IncidentsService } from './incidents.service'

// Patient-safety incidents. Anyone in the organisation may report one; reading the register needs clinical.read.
@Controller({ path: 'incidents', version: '1' })
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  @RequirePermissions('clinical.read')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { page, pageSize } = parse(listIncidentsSchema, query)
    return this.incidents.list(access, page, pageSize)
  }

  @Post()
  @HttpCode(201)
  @OrgMember()
  async report(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.incidents.report(access, auth.userId, parse(createIncidentSchema, body), client) }
  }
}
