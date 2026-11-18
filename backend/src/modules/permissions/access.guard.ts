import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { z } from 'zod'
import { badRequest, forbidden } from '../../common/errors/app-error'
import type { AppRequest } from '../../common/utils/request'
import { ACCESS_KEY, AccessRequirement } from './access.decorators'
import { AccessService } from './access.service'

const orgIdSchema = z.uuid()

// Global guard that runs after SessionGuard. Routes marked with @RequirePermissions, @RequireAnyPermission or
// @OrgMember need an active membership in the X-Org-Id organisation and the listed permissions.
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<AccessRequirement | undefined>(ACCESS_KEY, [context.getHandler(), context.getClass()])
    if (!requirement) return true

    const req = context.switchToHttp().getRequest<AppRequest>()
    if (!req.auth) throw forbidden('PERMISSION_DENIED', 'You do not have access to this.')

    const orgId = orgIdSchema.safeParse(req.get('x-org-id'))
    if (!orgId.success) throw badRequest('ORG_REQUIRED', 'Choose an organisation first.')

    const [membership] = await this.access.forUser(req.auth.userId, orgId.data)
    if (!membership) throw forbidden('NOT_A_MEMBER', 'You are not a member of this organisation.')

    const held = new Set(membership.permissions)
    if (!satisfies(requirement, held)) throw forbidden('PERMISSION_DENIED', 'Your role does not allow this action.')

    req.access = { orgId: orgId.data, membershipId: membership.membershipId, permissions: held, branchScope: membership.branchScope }
    return true
  }
}

export function satisfies(requirement: AccessRequirement, held: ReadonlySet<string>): boolean {
  const all = (requirement.allOf ?? []).every((permission) => held.has(permission))
  const any = !requirement.anyOf?.length || requirement.anyOf.some((permission) => held.has(permission))
  return all && any
}
