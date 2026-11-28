import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, OrgMember } from '../permissions/access.decorators'
import { MyPayService } from './my-pay.service'

const acknowledgeSchema = z.object({ version: z.number().int().min(1) })

// Self-service: every route here acts only on the signed-in member's own staff record.
@Controller({ path: 'me/pay', version: '1' })
export class MyPayController {
  constructor(private readonly pay: MyPayService) {}

  @Get()
  @OrgMember()
  @Header('Cache-Control', 'no-store')
  async mine(@CurrentAccess() access: AccessContext) {
    return { data: await this.pay.pay(access) }
  }

  @Post('advances/:id/acknowledge')
  @HttpCode(200)
  @OrgMember()
  async acknowledge(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.pay.acknowledge(access, parse(uuid, id), auth.userId, parse(acknowledgeSchema, body).version, client) }
  }
}
