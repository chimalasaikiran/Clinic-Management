import { Injectable } from '@nestjs/common'
import { Db } from '../../database/prisma.service'
import { AccessRepository } from './access.repository'

export interface MembershipAccess {
  membershipId: string
  organisation: { id: string; name: string; status: string }
  roles: Array<{ id: string; name: string; scope: string; isSystem: boolean }>
  permissions: string[]
  branchScope: 'all' | string[]
}

// Works out what a user may do in each organisation: the union of the permissions of their active roles,
// and the branches those roles cover. Computed per request so role changes take effect immediately.
@Injectable()
export class AccessService {
  constructor(private readonly access: AccessRepository) {}

  async forUser(userId: string, orgId?: string, db?: Db): Promise<MembershipAccess[]> {
    const memberships = await this.access.activeMemberships(userId, orgId, db)
    return memberships.map((membership) => {
      const roles = membership.roles.map((entry) => entry.role)
      const permissions = [...new Set(roles.flatMap((role) => role.permissions.map((entry) => entry.permission)))].sort()
      const branchScope = roles.some((role) => role.scope === 'org')
        ? ('all' as const)
        : [...new Set(roles.flatMap((role) => role.branches.map((entry) => entry.branchId)))]
      return {
        membershipId: membership.id,
        organisation: { id: membership.organisation.id, name: membership.organisation.displayName, status: membership.organisation.status },
        roles: roles.map(({ id, name, scope, isSystem }) => ({ id, name, scope, isSystem })),
        permissions,
        branchScope,
      }
    })
  }
}
