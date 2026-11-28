import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import type { AppRequest } from '../../common/utils/request'

export const PATIENT_REALM_KEY = 'patient:realm'
export const PATIENT_PUBLIC_KEY = 'patient:public'

// Put on every patient-app controller. It moves the routes out of the staff guards and into PatientGuard, which
// demands a patient session unless a route also says @PatientPublic(). One decorator, so a route cannot end up
// outside the staff guards without being inside the patient one.
export const PatientRealm = () => SetMetadata(PATIENT_REALM_KEY, true)
// Sign-in and registration: no patient session yet.
export const PatientPublic = () => SetMetadata(PATIENT_PUBLIC_KEY, true)

// The signed-in patient account. Only use on patient routes that are not @PatientPublic().
export const CurrentPatient = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().patient!)
