import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import { MembersRepository } from './members.repository'

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string) {
    const rows = await this.members.list(orgId)
    return rows.map(({ roles, ...row }) => ({ ...row, roles: roles.map((entry) => entry.role) }))
  }

  // Checks that every role exists in the organisation and that the actor may hand it out.
  // Holders of settings.roles may assign any active role; others (staff.credentials) only roles whose
  // permissions and branches they hold themselves, so nobody can grant more access than they have.
  async assertAssignable(orgId: string, roleIds: string[], actor: AccessContext, db?: Db) {
    const unique = [...new Set(roleIds)]
    if (unique.length === 0) return []
    const found = await this.members.rolesForAssignment(orgId, unique, db)
    if (found.length !== unique.length) throw unprocessable('ROLE_UNKNOWN', 'One or more roles do not exist in this organisation.')
    if (found.some((role) => role.status !== 'active')) throw unprocessable('ROLE_INACTIVE', 'Only active roles can be assigned.')
    if (actor.permissions.has('settings.roles')) return unique

    if (found.some((role) => role.isSystem)) throw forbidden('ROLE_NOT_ASSIGNABLE', 'Only role managers can assign system roles.')
    if (found.some((role) => role.permissions.some((entry) => !actor.permissions.has(entry.permission)))) {
      throw forbidden('ROLE_NOT_ASSIGNABLE', 'You cannot assign a role with permissions you do not hold.')
    }
    if (actor.branchScope !== 'all') {
      const allowed = new Set(actor.branchScope)
      const outside = found.some((role) => role.scope === 'org' || role.branches.some((entry) => !allowed.has(entry.branchId)))
      if (outside) throw forbidden('ROLE_NOT_ASSIGNABLE', 'You cannot assign a role outside your branches.')
    }
    return unique
  }

  async setRoles(orgId: string, membershipId: string, roleIds: string[], actor: AccessContext, actorUserId: string, client: ClientInfo) {
    const target = await this.find(orgId, membershipId)
    if (target.userId === actorUserId) throw forbidden('SELF_CHANGE_FORBIDDEN', 'You cannot change your own roles.')
    const assignable = await this.assertAssignable(orgId, roleIds, actor)

    await this.prisma.transaction(async (tx) => {
      await this.members.lockOrganisation(tx, orgId)
      const before = await this.members.replaceRoles(tx, membershipId, assignable)
      await this.assertOwnerRemains(tx, orgId)
      await this.audit.record(
        { action: 'membership.roles_changed', entityType: 'membership', entityId: membershipId, orgId, actorUserId, details: { before, after: assignable } },
        client,
        tx,
      )
    })
    return this.view(orgId, membershipId)
  }

  async setStatus(orgId: string, membershipId: string, status: 'active' | 'suspended', actorUserId: string, client: ClientInfo) {
    const target = await this.find(orgId, membershipId)
    if (target.userId === actorUserId) throw forbidden('SELF_CHANGE_FORBIDDEN', 'You cannot change your own access.')
    if (target.status === 'removed') throw conflict('MEMBERSHIP_REMOVED', 'This person is no longer a member.')

    await this.prisma.transaction(async (tx) => {
      await this.members.lockOrganisation(tx, orgId)
      await this.members.setStatus(tx, membershipId, status)
      await this.assertOwnerRemains(tx, orgId)
      await this.audit.record(
        { action: `membership.${status === 'active' ? 'reactivated' : 'suspended'}`, entityType: 'membership', entityId: membershipId, orgId, actorUserId },
        client,
        tx,
      )
    })
    // Access is checked against the membership on every request, so a suspension applies to the next call.
    return this.view(orgId, membershipId)
  }

  async assertOwnerRemains(tx: Tx, orgId: string) {
    if ((await this.members.countActiveOwners(tx, orgId)) === 0) {
      throw conflict('LAST_OWNER', 'The organisation must keep at least one active Super Admin.')
    }
  }

  private async find(orgId: string, membershipId: string) {
    const membership = await this.members.find(orgId, membershipId)
    if (!membership) throw notFound('Member not found.')
    return membership
  }

  private async view(orgId: string, membershipId: string) {
    return (await this.list(orgId)).find((member) => member.id === membershipId)!
  }
}
