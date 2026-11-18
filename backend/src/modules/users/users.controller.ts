import { Body, Controller, Get, Patch } from '@nestjs/common'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import type { AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, personName } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { UsersService } from './users.service'

const profileSchema = z.object({ fullName: personName })

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext) {
    return { data: await this.users.profile(auth.userId) }
  }

  @Patch('me')
  async updateMe(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Client() client: ClientInfo) {
    return { data: await this.users.updateProfile(auth.userId, parse(profileSchema, body), client) }
  }
}
