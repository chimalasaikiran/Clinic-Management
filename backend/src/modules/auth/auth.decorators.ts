import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import type { AppRequest } from '../../common/utils/request'

export const PUBLIC_KEY = 'auth:public'
export const ALLOW_UNVERIFIED_KEY = 'auth:allow-unverified'

// No session required (registration, sign-in, verification, password reset, invitation preview, health).
export const Public = () => SetMetadata(PUBLIC_KEY, true)
// Signed in, but the email may not be verified yet (session bootstrap, sign out).
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true)

// The signed-in person. Only use on routes that are not @Public().
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().auth!)
