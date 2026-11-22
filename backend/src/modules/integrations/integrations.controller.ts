import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { IntegrationsService } from './integrations.service'

const provider = z.enum(['meta', 'google'])
// A secret left empty on an update keeps the saved value.
const secret = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined)
const numericId = (label: string) => z.string().trim().regex(/^\d{5,30}$/, `Enter the numeric ${label}.`)

const SCHEMAS = {
  meta: z.object({
    pageId: numericId('Facebook Page ID'),
    instagramAccountId: numericId('Instagram professional account ID').optional().or(z.literal('').transform(() => undefined)),
    pageAccessToken: secret(1000),
  }),
  google: z.object({
    accountId: numericId('Google Business Profile account ID'),
    clientId: z.string().trim().min(10, 'Enter the OAuth client ID.').max(200),
    clientSecret: secret(200),
    refreshToken: secret(1000),
  }),
}

// The Meta and Google Business Profile accounts used for posts and reviews. Connecting them is an organisation setting.
@Controller({ path: 'integrations', version: '1' })
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @RequirePermissions('settings.organisation')
  async list(@CurrentAccess() access: AccessContext) {
    return { data: await this.integrations.list(access.orgId) }
  }

  // For linking a branch to its Google location on the Business Profile screen.
  @Get('google/locations')
  @RequireAnyPermission('growth.manage', 'settings.organisation')
  async locations(@CurrentAccess() access: AccessContext) {
    return { data: await this.integrations.googleLocations(access) }
  }

  @Put(':provider')
  @RequirePermissions('settings.organisation')
  async save(@Param('provider') name: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const which = parse(provider, name)
    return { data: await this.integrations.save(access, which, parse(SCHEMAS[which], body), auth.userId, client) }
  }

  @Delete(':provider')
  @RequirePermissions('settings.organisation')
  async disconnect(@Param('provider') name: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.integrations.disconnect(access, parse(provider, name), auth.userId, client) }
  }
}
