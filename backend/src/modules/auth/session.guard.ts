import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import { forbidden } from '../../common/errors/app-error'
import type { AppRequest } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { ALLOW_UNVERIFIED_KEY, PUBLIC_KEY } from './auth.decorators'
import { clearSessionCookie, readSessionCookie } from './session-cookie'
import { SessionService, sessionEnded } from './session.service'

// Global guard: every route needs a valid session cookie unless it is marked @Public().
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true

    const http = context.switchToHttp()
    const req = http.getRequest<AppRequest>()
    const token = readSessionCookie(req, this.env)
    if (!token) throw sessionEnded.missing()

    try {
      req.auth = await this.sessions.authenticate(token)
    } catch (error) {
      // The browser should forget a cookie that no longer works.
      clearSessionCookie(http.getResponse<Response>(), this.env)
      throw error
    }

    if (!req.auth.emailVerified && !this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)) {
      throw forbidden('EMAIL_NOT_VERIFIED', 'Verify your email address to continue.')
    }
    return true
  }
}
