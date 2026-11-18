import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { ClientInfo } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import { LIMITS } from '../auth/auth.limits'
import { AccessService } from '../permissions/access.service'
import { OWNER_ROLE_NAME, ROLE_TEMPLATES } from '../roles/role-templates'
import type { CreateOrganisationInput } from './organisations.schemas'
import { OrganisationsRepository } from './organisations.repository'

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organisations: OrganisationsRepository,
    private readonly access: AccessService,
    private readonly limits: RateLimitService,
    private readonly audit: AuditService,
  ) {}

  // Onboarding "Create your clinic": the organisation, its first branch and the default roles,
  // with the caller as Super Admin. All or nothing.
  async create(userId: string, input: CreateOrganisationInput, client: ClientInfo) {
    await this.limits.consume(LIMITS.createOrganisation, userId)

    return this.prisma.transaction(async (tx) => {
      const org = await this.organisations.createWithMainBranch(
        tx,
        { displayName: input.clinicName, facilityType: input.facilityType, location: input.location, city: input.city, state: input.state },
        userId,
      )
      const mainBranchId = org.branches[0]!.id

      const roleIds = await this.organisations.createRolesFromTemplates(tx, org.id, mainBranchId, ROLE_TEMPLATES, userId)
      await this.organisations.addOwner(tx, org.id, userId, roleIds.get(OWNER_ROLE_NAME)!)

      await this.audit.record(
        { action: 'organisation.created', entityType: 'organisation', entityId: org.id, orgId: org.id, actorUserId: userId, details: { name: input.clinicName } },
        client,
        tx,
      )
      const [membership] = await this.access.forUser(userId, org.id, tx)
      return membership!
    })
  }

  branches(orgId: string) {
    return this.organisations.branches(orgId)
  }
}
