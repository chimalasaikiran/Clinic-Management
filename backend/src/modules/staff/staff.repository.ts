import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import type { CreateStaffInput, ListStaffQuery } from './staff.schemas'

export const staffSelect = {
  id: true,
  staffCode: true,
  type: true,
  fullName: true,
  email: true,
  mobile: true,
  department: true,
  designation: true,
  council: true,
  councilNumber: true,
  qualifications: true,
  engagement: true,
  status: true,
  membershipId: true,
  invitationId: true,
  version: true,
  createdAt: true,
  branches: { select: { isPrimary: true, branch: { select: { id: true, name: true, city: true, status: true } } }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  membership: {
    select: {
      status: true,
      user: { select: { email: true, lastLoginAt: true } },
      roles: { select: { role: { select: { id: true, name: true } } } },
      practitioner: { select: { id: true, status: true } },
    },
  },
  invitation: { select: { email: true, expiresAt: true, acceptedAt: true, revokedAt: true } },
} satisfies Prisma.StaffMemberSelect

export type StaffRow = Prisma.StaffMemberGetPayload<{ select: typeof staffSelect }>

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  where(orgId: string, query: ListStaffQuery, today: Date): Prisma.StaffMemberWhereInput {
    const filters: Prisma.StaffMemberWhereInput[] = [{ orgId }]
    const text = query.query?.trim()
    if (text) filters.push({ OR: [{ fullName: { contains: text, mode: 'insensitive' } }, { staffCode: { contains: text, mode: 'insensitive' } }, { councilNumber: { contains: text, mode: 'insensitive' } }] })
    if (query.type) filters.push({ type: query.type })
    if (query.department) filters.push({ department: query.department })
    if (query.branchId) filters.push({ branches: { some: { branchId: query.branchId } } })
    if (query.status === 'on_leave') filters.push(this.onLeave(today))
    else if (query.status) filters.push({ status: query.status })
    return { AND: filters }
  }

  // Whole-day leave covering `today`.
  onLeave(today: Date): Prisma.StaffMemberWhereInput {
    return { leaves: { some: { status: 'scheduled', kind: { in: ['leave', 'relief'] }, startMinute: null, startDate: { lte: today }, endDate: { gte: today } } } }
  }

  async list(where: Prisma.StaffMemberWhereInput, page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.staffMember.count({ where }),
      this.prisma.staffMember.findMany({ where, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, select: staffSelect }),
    ])
    return { total, rows }
  }

  find(orgId: string, id: string, db: Db = this.prisma) {
    return db.staffMember.findFirst({ where: { id, orgId }, select: staffSelect })
  }

  // Who among these people is on whole-day leave today, and until when.
  leaveToday(staffIds: string[], today: Date) {
    return this.prisma.staffLeave.findMany({
      where: { staffId: { in: staffIds }, status: 'scheduled', kind: { in: ['leave', 'relief'] }, startMinute: null, startDate: { lte: today }, endDate: { gte: today } },
      select: { staffId: true, endDate: true, title: true },
    })
  }

  async summary(orgId: string, today: Date) {
    const [total, doctors, active, inactive, onLeave, departments] = await Promise.all([
      this.prisma.staffMember.count({ where: { orgId } }),
      this.prisma.staffMember.count({ where: { orgId, type: 'doctor' } }),
      this.prisma.staffMember.count({ where: { orgId, status: 'active' } }),
      this.prisma.staffMember.count({ where: { orgId, status: { in: ['inactive', 'draft'] } } }),
      this.prisma.staffMember.count({ where: { orgId, ...this.onLeave(today) } }),
      this.prisma.staffMember.findMany({ where: { orgId }, distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }),
    ])
    return { total, doctors, staff: total - doctors, active, inactive, onLeave, departments: departments.map((row) => row.department) }
  }

  create(tx: Tx, orgId: string, staffCode: string, input: CreateStaffInput, createdById: string) {
    return tx.staffMember.create({ data: { ...input, orgId, staffCode, createdById }, select: { id: true } })
  }

  async update(orgId: string, id: string, version: number, input: CreateStaffInput) {
    const { count } = await this.prisma.staffMember.updateMany({ where: { id, orgId, version }, data: { ...input, version: { increment: 1 } } })
    return count
  }

  activeBranches(orgId: string, ids: string[]) {
    return this.prisma.branch.findMany({ where: { orgId, id: { in: ids }, status: 'active' }, select: { id: true } })
  }

  async replaceBranches(tx: Tx, staffId: string, branchIds: string[], primaryBranchId: string) {
    await tx.staffBranch.deleteMany({ where: { staffId } })
    await tx.staffBranch.createMany({ data: branchIds.map((branchId) => ({ staffId, branchId, isPrimary: branchId === primaryBranchId })) })
    await tx.staffMember.update({ where: { id: staffId }, data: { version: { increment: 1 } } })
  }

  activeMemberByEmail(orgId: string, email: string) {
    return this.prisma.membership.findFirst({ where: { orgId, status: 'active', user: { email } }, select: { id: true, staff: { select: { id: true } } } })
  }

  linkMembership(id: string, membershipId: string) {
    return this.prisma.staffMember.update({ where: { id }, data: { membershipId, invitationId: null, version: { increment: 1 } } })
  }

  setInvitation(id: string, invitationId: string) {
    return this.prisma.staffMember.update({ where: { id }, data: { invitationId, version: { increment: 1 } } })
  }

  // The staff record's audit entries, newest first, with the names of the people who made them.
  async history(orgId: string, staffId: string) {
    const entries = await this.prisma.auditLog.findMany({
      where: { orgId, entityType: 'staff', entityId: staffId },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: { id: true, action: true, occurredAt: true, actorUserId: true, details: true },
    })
    const actorIds = [...new Set(entries.map((entry) => entry.actorUserId).filter((id): id is string => Boolean(id)))]
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })
    const names = new Map(actors.map((actor) => [actor.id, actor.fullName]))
    return entries.map((entry) => ({ id: entry.id.toString(), action: entry.action, at: entry.occurredAt, actor: entry.actorUserId ? (names.get(entry.actorUserId) ?? null) : null, details: entry.details }))
  }
}
