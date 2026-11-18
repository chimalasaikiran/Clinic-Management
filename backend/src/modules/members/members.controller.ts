import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { MembersService } from './members.service'

const rolesSchema = z.object({ roleIds: z.array(uuid).max(20) })
const statusSchema = z.object({ status: z.enum(['active', 'suspended']) })

@Controller({ path: 'members', version: '1' })
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequireAnyPermission('settings.roles', 'staff.credentials')
  async list(@CurrentAccess() access: AccessContext) {
    return { data: await this.members.list(access.orgId) }
  }

  @Put(':id/roles')
  @RequirePermissions('settings.roles')
  async setRoles(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const { roleIds } = parse(rolesSchema, body)
    return { data: await this.members.setRoles(access.orgId, parse(uuid, id), roleIds, access, auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('settings.roles')
  async setStatus(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const { status } = parse(statusSchema, body)
    return { data: await this.members.setStatus(access.orgId, parse(uuid, id), status, auth.userId, client) }
  }
}
