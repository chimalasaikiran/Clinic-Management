import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, OrgMember } from '../permissions/access.decorators'
import { createOrganisationSchema } from './organisations.schemas'
import { OrganisationsService } from './organisations.service'

@Controller({ version: '1' })
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Post('organisations')
  @HttpCode(201)
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Client() client: ClientInfo) {
    return { data: await this.organisations.create(auth.userId, parse(createOrganisationSchema, body), client) }
  }

  @Get('branches')
  @OrgMember()
  async branches(@CurrentAccess() access: AccessContext) {
    return { data: await this.organisations.branches(access.orgId) }
  }
}
