import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import type { AppRequest } from '../../common/utils/request'

export const ACCESS_KEY = 'auth:access'
export const ORG_FROM_QUERY_KEY = 'auth:org-from-query'

export interface AccessRequirement {
  allOf?: string[]
  anyOf?: string[]
}

// Each of these requires an active membership in the organisation named by the X-Org-Id header.
export const RequirePermissions = (...permissions: string[]) => SetMetadata(ACCESS_KEY, { allOf: permissions } satisfies AccessRequirement)
export const RequireAnyPermission = (...permissions: string[]) => SetMetadata(ACCESS_KEY, { anyOf: permissions } satisfies AccessRequirement)
export const OrgMember = () => SetMetadata(ACCESS_KEY, {} satisfies AccessRequirement)
// For EventSource streams, which cannot send headers: the organisation may come from `?orgId=` instead.
export const OrgFromQuery = () => SetMetadata(ORG_FROM_QUERY_KEY, true)

// The caller's access in the X-Org-Id organisation. Only use on routes with one of the decorators above.
export const CurrentAccess = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().access!)
