import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import { PatientLinksService } from './patient-links.service'

// Staff side of app access: what the clinic desk sees and does on a patient's record. Staff routes, staff guards.
@Controller({ path: 'patients/:id', version: '1' })
export class PatientAccessController {
  constructor(private readonly links: PatientLinksService) {}

  @Get('app-access')
  @RequirePermissions('patients.view')
  async view(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.links.forPatient(access, parse(uuid, id)) }
  }

  @Post('app-link-code')
  @HttpCode(201)
  @RequirePermissions('patients.edit')
  async issueCode(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.links.issueCode(access, auth.userId, parse(uuid, id), client) }
  }

  @Delete('app-links/:linkId')
  @HttpCode(204)
  @RequirePermissions('patients.edit')
  async revoke(@Param('id') id: string, @Param('linkId') linkId: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.links.revoke(access, auth.userId, parse(uuid, id), parse(uuid, linkId), client)
  }
}
