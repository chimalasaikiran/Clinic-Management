import { Inject, Injectable, Logger } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import { MailService } from '../../common/mail/mail.service'
import { generateToken, keyedHash } from '../../common/utils/crypto'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { Invitation } from '../../generated/prisma/client'
import { PasswordService } from '../auth/password.service'
import { MembersRepository } from '../members/members.repository'
import { MembersService } from '../members/members.service'
import { OrganisationsRepository } from '../organisations/organisations.repository'
import { UsersRepository } from '../users/users.repository'
import { InvitationsRepository } from './invitations.repository'

export const INVITATION_TTL_HOURS = 72

const statusOf = (invitation: Pick<Invitation, 'acceptedAt' | 'revokedAt' | 'expiresAt'>) =>
  invitation.acceptedAt ? 'accepted' : invitation.revokedAt ? 'revoked' : invitation.expiresAt.getTime() <= Date.now() ? 'expired' : 'pending'

const unusable = () => notFound('This invitation is invalid, has expired or was already used.')
const accountExists = () => conflict('ACCOUNT_EXISTS', 'You already have an account. Sign in to accept the invitation.')

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: InvitationsRepository,
    private readonly users: UsersRepository,
    private readonly members: MembersService,
    private readonly memberships: MembersRepository,
    private readonly organisations: OrganisationsRepository,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(orgId: string, actor: AccessContext, actorUserId: string, input: { email: string; roleIds: string[] }, client: ClientInfo) {
    const roleIds = await this.members.assertAssignable(orgId, input.roleIds, actor)
    if (roleIds.length === 0) throw unprocessable('ROLES_REQUIRED', 'Choose at least one role.')

    const existing = await this.memberships.findByEmail(orgId, input.email)
    if (existing && existing.status !== 'removed') throw conflict('ALREADY_MEMBER', 'This person is already a member of the organisation.')

    const token = generateToken()
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3_600_000)
    const id = await this.prisma.transaction(async (tx) => {
      await this.invitations.revokePending(tx, orgId, input.email)
      const created = await this.invitations.create(tx, { orgId, email: input.email, roleIds, tokenHash: this.hash(token), invitedById: actorUserId, expiresAt })
      await this.audit.record({ action: 'invitation.created', entityType: 'invitation', entityId: created.id, orgId, actorUserId, details: { email: input.email, roleIds } }, client, tx)
      return created.id
    })

    const [org, inviter] = await Promise.all([this.organisations.displayName(orgId), this.users.findById(actorUserId)])
    try {
      // The token goes in the URL fragment, which browsers never send to servers or put in referrers.
      await this.mail.invitation(input.email, org!.displayName, inviter!.fullName, `${this.env.APP_URL}/auth/invite#token=${token}`, expiresAt)
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to send invitation email')
      throw unprocessable('INVITATION_EMAIL_FAILED', 'The invitation was saved but the email could not be sent. Try sending it again.')
    }
    return (await this.list(orgId)).find((invitation) => invitation.id === id)!
  }

  async list(orgId: string) {
    const rows = await this.invitations.list(orgId)
    return rows.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      roleIds: invitation.roleIds,
      status: statusOf(invitation),
      invitedBy: invitation.invitedBy.fullName,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    }))
  }

  async revoke(orgId: string, id: string, actorUserId: string, client: ClientInfo) {
    if ((await this.invitations.revoke(orgId, id)) === 0) throw notFound('No pending invitation with this id.')
    await this.audit.record({ action: 'invitation.revoked', entityType: 'invitation', entityId: id, orgId, actorUserId }, client)
  }

  // What the invitee sees before accepting. Only the holder of the link can call this.
  async preview(token: string) {
    const invitation = await this.findUsable(token)
    const [roles, account] = await Promise.all([this.invitations.roleNames(invitation.roleIds), this.users.findByEmail(invitation.email)])
    return {
      email: invitation.email,
      organisation: invitation.organisation.displayName,
      invitedBy: invitation.invitedBy.fullName,
      roles: roles.map((role) => role.name),
      expiresAt: invitation.expiresAt,
      accountExists: Boolean(account),
    }
  }

  // New person: creates the account (the email counts as verified because the link reached the inbox) and joins.
  async acceptAsNewUser(token: string, input: { fullName: string; password: string }, client: ClientInfo) {
    const invitation = await this.findUsable(token)
    if (await this.users.findByEmail(invitation.email)) throw accountExists()
    const passwordHash = await this.passwords.hash(input.password)

    try {
      await this.prisma.transaction(async (tx) => {
        const user = await this.users.create({ email: invitation.email, fullName: input.fullName, passwordHash, verified: true }, tx)
        await this.audit.record({ action: 'auth.registered', entityType: 'user', entityId: user.id, actorUserId: user.id, details: { via: 'invitation' } }, client, tx)
        await this.join(tx, invitation.id, user.id, client)
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw accountExists()
      throw error
    }
    return { email: invitation.email }
  }

  // Existing, signed-in person whose email matches the invitation.
  async acceptAsExistingUser(token: string, userId: string, email: string, client: ClientInfo) {
    const invitation = await this.findUsable(token)
    if (invitation.email !== email.toLowerCase()) throw forbidden('INVITATION_EMAIL_MISMATCH', 'This invitation was sent to a different email address.')
    await this.prisma.transaction((tx) => this.join(tx, invitation.id, userId, client))
    return { orgId: invitation.orgId }
  }

  private async join(tx: Tx, invitationId: string, userId: string, client: ClientInfo) {
    if (!(await this.invitations.lockUsable(tx, invitationId))) throw unusable()
    const invitation = (await this.invitations.findById(tx, invitationId))!

    const existing = await this.memberships.findByUser(invitation.orgId, userId, tx)
    if (existing?.status === 'active') throw conflict('ALREADY_MEMBER', 'You are already a member of this organisation.')
    if (existing?.status === 'suspended') throw forbidden('MEMBERSHIP_SUSPENDED', 'Your access to this organisation is suspended.')

    const roleIds = await this.invitations.activeRoleIds(tx, invitation.orgId, invitation.roleIds)
    let membershipId: string
    if (existing) {
      await this.memberships.rejoin(tx, existing.id, invitation.invitedById, roleIds)
      membershipId = existing.id
    } else {
      membershipId = (await this.memberships.create(tx, { orgId: invitation.orgId, userId, invitedById: invitation.invitedById, roleIds })).id
    }

    await this.invitations.markAccepted(tx, invitationId, userId)
    // A staff record waiting on this invitation now belongs to the new member's account.
    await tx.staffMember.updateMany({ where: { orgId: invitation.orgId, invitationId }, data: { membershipId, invitationId: null } })
    await this.audit.record(
      { action: 'invitation.accepted', entityType: 'invitation', entityId: invitationId, orgId: invitation.orgId, actorUserId: userId, details: { membershipId } },
      client,
      tx,
    )
  }

  private async findUsable(token: string) {
    const invitation = await this.invitations.findByTokenHash(this.hash(token))
    if (!invitation || statusOf(invitation) !== 'pending') throw unusable()
    return invitation
  }

  private hash(token: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `invitation:${token}`)
  }
}
