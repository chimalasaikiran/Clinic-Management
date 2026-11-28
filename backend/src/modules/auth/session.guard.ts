import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import { forbidden } from '../../common/errors/app-error'
import type { AppRequest } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PATIENT_REALM_KEY } from '../patient-auth/patient.decorators'
import { bearerToken } from '../../common/utils/bearer'
import { ALLOW_UNVERIFIED_KEY, PUBLIC_KEY } from './auth.decorators'
import { clearSessionCookie, readSessionCookie } from './session-cookie'
import { SessionService, sessionEnded } from './session.service'

// Global guard: every route needs a valid session (a cookie from the admin panel, or a bearer token from the staff
// app) unless it is marked @Public().
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
    // Patient-app routes are a separate realm, authenticated by PatientGuard instead.
    if (this.reflector.getAllAndOverride<boolean>(PATIENT_REALM_KEY, targets)) return true

    const http = context.switchToHttp()
    const req = http.getRequest<AppRequest>()
    const cookie = readSessionCookie(req, this.env)
    // The staff app sends its session as a bearer token; the admin panel as a cookie. A cookie wins if both arrive.
    const bearer = cookie ? null : bearerToken(req.get('authorization'))
    if (!cookie && !bearer) throw sessionEnded.missing()

    try {
      req.auth = cookie ? await this.sessions.authenticate(cookie, 'browser') : await this.sessions.authenticate(bearer!, 'app')
    } catch (error) {
      // The browser should forget a cookie that no longer works.
      if (cookie) clearSessionCookie(http.getResponse<Response>(), this.env)
      throw error
    }

    if (!req.auth.emailVerified && !this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)) {
      throw forbidden('EMAIL_NOT_VERIFIED', 'Verify your email address to continue.')
    }
    return true
  }
}
