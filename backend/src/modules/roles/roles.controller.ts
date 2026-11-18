import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { createRoleSchema, updateRoleSchema } from './roles.schemas'
import { RolesService } from './roles.service'

@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  // Readable by people who assign roles (staff credentials) as well as role managers.
  @Get()
  @RequireAnyPermission('settings.roles', 'staff.credentials')
  async list(@CurrentAccess() access: AccessContext) {
    return { data: await this.roles.list(access.orgId) }
  }

  @Get(':id')
  @RequireAnyPermission('settings.roles', 'staff.credentials')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.roles.get(access.orgId, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('settings.roles')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.roles.create(access.orgId, auth.userId, parse(createRoleSchema, body), client) }
  }

  @Patch(':id')
  @RequirePermissions('settings.roles')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.roles.update(access.orgId, auth.userId, parse(uuid, id), parse(updateRoleSchema, body), client) }
  }
}
