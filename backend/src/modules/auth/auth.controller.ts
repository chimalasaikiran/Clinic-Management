import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Client } from '../../common/decorators/client.decorator'
import { notFound } from '../../common/errors/app-error'
import type { AppRequest, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { ENV, Env } from '../../config/env'
import { AllowUnverified, CurrentAuth, Public } from './auth.decorators'
import { changePasswordSchema, confirmEmailSchema, emailOnlySchema, loginSchema, registerSchema, resetSchema } from './auth.schemas'
import { AuthService } from './auth.service'
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie'

// HTTP layer only: validates input, calls AuthService, and sets or clears the session cookie.
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(202)
  async register(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.register(parse(registerSchema, body), client) }
  }

  @Public()
  @Post('email-verification/confirm')
  @HttpCode(200)
  async confirmEmail(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.confirmEmail(parse(confirmEmailSchema, body), client) }
  }

  @Public()
  @Post('email-verification/resend')
  @HttpCode(202)
  async resendVerification(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.resendVerification(parse(emailOnlySchema, body).email, client) }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(parse(loginSchema, body), client)
    setSessionCookie(res, this.env, result.token, result.expiresAt)
    return { data: result.payload }
  }

  // Public so a browser holding an expired or revoked cookie can still clear it.
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readSessionCookie(req, this.env), client)
    clearSessionCookie(res, this.env)
  }

  @AllowUnverified()
  @Post('logout-all')
  @HttpCode(204)
  async logoutEverywhere(@CurrentAuth() auth: AuthContext, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutEverywhere(auth, client)
    clearSessionCookie(res, this.env)
  }

  @AllowUnverified()
  @Get('session')
  async session(@CurrentAuth() auth: AuthContext) {
    return { data: await this.auth.currentSession(auth) }
  }

  @Get('sessions')
  async sessions(@CurrentAuth() auth: AuthContext) {
    return { data: await this.auth.listSessions(auth) }
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async endSession(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @Client() client: ClientInfo) {
    if (!(await this.auth.endSession(auth, parse(uuid, id), client))) throw notFound('Session not found.')
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(202)
  async requestPasswordReset(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.requestPasswordReset(parse(emailOnlySchema, body).email, client) }
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(200)
  async confirmPasswordReset(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.confirmPasswordReset(parse(resetSchema, body), client) }
  }

  @Post('password/change')
  @HttpCode(200)
  async changePassword(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Client() client: ClientInfo) {
    return { data: await this.auth.changePassword(auth, parse(changePasswordSchema, body), client) }
  }
}
