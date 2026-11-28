import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { bearerToken } from '../../common/utils/bearer'
import type { AppRequest } from '../../common/utils/request'
import { PatientSessionsService, patientSessionEnded } from './patient-sessions.service'
import { PATIENT_PUBLIC_KEY, PATIENT_REALM_KEY } from './patient.decorators'

// Global guard for @PatientRealm() routes. It accepts only a patient session token sent as
// "Authorization: Bearer"; cookies are ignored, so a signed-in staff browser has no standing here.
@Injectable()
export class PatientGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: PatientSessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]
    if (!this.reflector.getAllAndOverride<boolean>(PATIENT_REALM_KEY, targets)) return true
    if (this.reflector.getAllAndOverride<boolean>(PATIENT_PUBLIC_KEY, targets)) return true

    const req = context.switchToHttp().getRequest<AppRequest>()
    const token = bearerToken(req.get('authorization'))
    if (!token) throw patientSessionEnded.missing()
    req.patient = await this.sessions.authenticate(token)
    return true
  }
}

export { bearerToken }
