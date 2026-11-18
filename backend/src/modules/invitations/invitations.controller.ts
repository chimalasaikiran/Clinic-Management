import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth, Public } from '../auth/auth.decorators'
import { LIMITS } from '../auth/auth.limits'
import { CurrentAccess, RequireAnyPermission } from '../permissions/access.decorators'
import { acceptNewSchema, createInvitationSchema, tokenOnlySchema } from './invitations.schemas'
import { InvitationsService } from './invitations.service'

@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly limits: RateLimitService,
  ) {}

  @Get()
  @RequireAnyPermission('settings.roles', 'staff.credentials')
  async list(@CurrentAccess() access: AccessContext) {
    return { data: await this.invitations.list(access.orgId) }
  }

  @Post()
  @HttpCode(201)
  @RequireAnyPermission('settings.roles', 'staff.credentials')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.limits.consume(LIMITS.invitationCreate, auth.userId)
    return { data: await this.invitations.create(access.orgId, access, auth.userId, parse(createInvitationSchema, body), client) }
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAnyPermission('settings.roles', 'staff.credentials')
  async revoke(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.invitations.revoke(access.orgId, parse(uuid, id), auth.userId, client)
  }

  // The token travels in the request body, never the URL, so it does not end up in access logs.
  @Public()
  @Post('preview')
  @HttpCode(200)
  async preview(@Body() body: unknown, @Client() client: ClientInfo) {
    await this.limits.consume(LIMITS.invitationAcceptIp, client.ip ?? 'unknown')
    return { data: await this.invitations.preview(parse(tokenOnlySchema, body).token) }
  }

  @Public()
  @Post('accept-new')
  @HttpCode(201)
  async acceptNew(@Body() body: unknown, @Client() client: ClientInfo) {
    await this.limits.consume(LIMITS.invitationAcceptIp, client.ip ?? 'unknown')
    const { token, ...input } = parse(acceptNewSchema, body)
    return { data: await this.invitations.acceptAsNewUser(token, input, client) }
  }

  @Post('accept')
  @HttpCode(200)
  async accept(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Client() client: ClientInfo) {
    await this.limits.consume(LIMITS.invitationAcceptIp, client.ip ?? 'unknown')
    return { data: await this.invitations.acceptAsExistingUser(parse(tokenOnlySchema, body).token, auth.userId, auth.email, client) }
  }
}
