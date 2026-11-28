import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import { forbidden } from '../../common/errors/app-error'
import type { AppRequest, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import { bearerToken } from '../../common/utils/bearer'
import { AllowUnverified, CurrentAuth, Public } from './auth.decorators'
import { SessionService } from './session.service'
import { StaffAppAuthService, staffAppLoginSchema, staffAppVerifySchema } from './staff-app-auth.service'

// A token in a response body must never reach a web page, where a script could read it. Browsers always send Origin
// on these POSTs; the phone app does not.
function refuseBrowsers(req: AppRequest) {
  if (req.get('origin')) throw forbidden('APP_ONLY', 'Sign in to the admin panel with your email address instead.')
}

@Controller({ path: 'auth/app', version: '1' })
export class StaffAppAuthController {
  constructor(
    private readonly staffApp: StaffAppAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: AppRequest, @Client() client: ClientInfo) {
    refuseBrowsers(req)
    return { data: await this.staffApp.login(parse(staffAppLoginSchema, body), client) }
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: unknown, @Req() req: AppRequest, @Client() client: ClientInfo) {
    refuseBrowsers(req)
    return { data: await this.staffApp.verify(parse(staffAppVerifySchema, body), client) }
  }

  // Ends the app session that sent the request.
  @AllowUnverified()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @CurrentAuth() auth: AuthContext) {
    const token = bearerToken(req.get('authorization'))
    if (token) await this.sessions.endOne(auth.userId, auth.sessionId)
  }
}
