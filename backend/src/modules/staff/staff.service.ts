import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import { InvitationsService } from '../invitations/invitations.service'
import { localDate } from '../scheduling/clinic-time'
import { StaffRepository, StaffRow } from './staff.repository'
import type { CreateStaffInput, ListStaffQuery, UpdateStaffInput } from './staff.schemas'

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffRepository,
    private readonly counters: CountersRepository,
    private readonly invitations: InvitationsService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  today() {
    return asDate(localDate(new Date(), this.env.CLINIC_TIMEZONE))
  }

  view(row: StaffRow, leave?: { endDate: Date; title: string }) {
    const invitationPending = Boolean(row.invitation && !row.invitation.acceptedAt && !row.invitation.revokedAt && row.invitation.expiresAt > new Date())
    return {
      id: row.id,
      staffCode: row.staffCode,
      type: row.type,
      fullName: row.fullName,
      email: row.email,
      mobile: row.mobile,
      department: row.department,
      designation: row.designation,
      council: row.council,
      councilNumber: row.councilNumber,
      qualifications: row.qualifications,
      engagement: row.engagement,
      status: row.status,
      onLeave: leave ? { until: leave.endDate.toISOString().slice(0, 10), title: leave.title } : null,
      branches: row.branches.map((entry) => ({ id: entry.branch.id, name: entry.branch.name, city: entry.branch.city, isPrimary: entry.isPrimary })),
      account: row.membership
        ? {
            linked: true,
            membershipId: row.membershipId,
            status: row.membership.status,
            email: row.membership.user.email,
            lastLoginAt: row.membership.user.lastLoginAt?.toISOString() ?? null,
            roles: row.membership.roles.map((entry) => entry.role.name),
          }
        : { linked: false, invitationPending, invitedEmail: invitationPending ? row.invitation!.email : null },
      practitioner: row.membership?.practitioner ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
    }
  }

  async list(orgId: string, query: ListStaffQuery) {
    const today = this.today()
    const { total, rows } = await this.staff.list(this.staff.where(orgId, query, today), query.page, query.pageSize)
    const leaves = new Map((await this.staff.leaveToday(rows.map((row) => row.id), today)).map((leave) => [leave.staffId, leave]))
    return { items: rows.map((row) => this.view(row, leaves.get(row.id))), page: query.page, pageSize: query.pageSize, total }
  }

  summary(orgId: string) {
    return this.staff.summary(orgId, this.today())
  }

  async get(orgId: string, id: string) {
    const row = await this.find(orgId, id)
    const [leave] = await this.staff.leaveToday([id], this.today())
    return this.view(row, leave)
  }

  history(orgId: string, id: string) {
    return this.staff.history(orgId, id)
  }

  async create(orgId: string, actorUserId: string, input: CreateStaffInput, client: ClientInfo) {
    const id = await this.prisma.transaction(async (tx) => {
      const code = `STF-${String(await this.counters.next(tx, orgId, 'staff_code')).padStart(3, '0')}`
      const created = await this.staff.create(tx, orgId, code, input, actorUserId)
      await this.audit.record({ action: 'staff.created', entityType: 'staff', entityId: created.id, orgId, actorUserId, details: { staffCode: code } }, client, tx)
      return created.id
    })
    return this.get(orgId, id)
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateStaffInput, client: ClientInfo) {
    await this.find(orgId, id)
    const { version, ...fields } = input
    if ((await this.staff.update(orgId, id, version, fields)) === 0) {
      throw conflict('STAFF_CHANGED', 'Someone else changed this record while you were editing. Reload to see the latest details, then make your change again.')
    }
    await this.audit.record({ action: 'staff.updated', entityType: 'staff', entityId: id, orgId, actorUserId }, client)
    return this.get(orgId, id)
  }

  async setBranches(orgId: string, id: string, actorUserId: string, input: { branchIds: string[]; primaryBranchId: string }, client: ClientInfo) {
    await this.find(orgId, id)
    const branchIds = [...new Set(input.branchIds)]
    if (!branchIds.includes(input.primaryBranchId)) throw unprocessable('PRIMARY_NOT_SELECTED', 'The primary branch must be one of the selected branches.')
    if ((await this.staff.activeBranches(orgId, branchIds)).length !== branchIds.length) throw unprocessable('BRANCH_UNKNOWN', 'One or more branches do not exist or are not active.')
    await this.prisma.transaction(async (tx) => {
      await this.staff.replaceBranches(tx, id, branchIds, input.primaryBranchId)
      await this.audit.record({ action: 'staff.branches_changed', entityType: 'staff', entityId: id, orgId, actorUserId, details: { branches: branchIds.length } }, client, tx)
    })
    return this.get(orgId, id)
  }

  // Gives the person a login: links an existing member with that email straight away, otherwise sends an
  // invitation whose acceptance links the account (see InvitationsService.join).
  async invite(access: AccessContext, actorUserId: string, id: string, input: { email: string; roleIds: string[] }, client: ClientInfo) {
    const row = await this.find(access.orgId, id)
    if (row.membershipId) throw conflict('ACCOUNT_LINKED', 'This person already has a ClinicOS account.')

    const member = await this.staff.activeMemberByEmail(access.orgId, input.email)
    if (member) {
      if (member.staff) throw conflict('ACCOUNT_TAKEN', 'That account already belongs to another staff record.')
      await this.staff.linkMembership(id, member.id)
      await this.audit.record({ action: 'staff.account_linked', entityType: 'staff', entityId: id, orgId: access.orgId, actorUserId }, client)
      return { result: 'linked' as const, staff: await this.get(access.orgId, id) }
    }

    const invitation = await this.invitations.create(access.orgId, access, actorUserId, input, client)
    await this.staff.setInvitation(id, invitation.id)
    await this.audit.record({ action: 'staff.invited', entityType: 'staff', entityId: id, orgId: access.orgId, actorUserId }, client)
    return { result: 'invited' as const, staff: await this.get(access.orgId, id) }
  }

  async find(orgId: string, id: string) {
    const row = await this.staff.find(orgId, id)
    if (!row) throw notFound('Staff member not found.')
    return row
  }
}
