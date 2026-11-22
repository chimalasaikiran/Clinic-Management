import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import type { CreateDepartmentInput, DepartmentMembersInput, UpdateDepartmentInput } from './configuration.schemas'

const departmentSelect = {
  id: true, code: true, name: true, type: true, description: true, status: true, version: true, createdAt: true, updatedAt: true,
  branches: { select: { branch: { select: { id: true, code: true, name: true, status: true } } } },
} as const satisfies Prisma.DepartmentSelect

type DepartmentRow = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>

// The organisation's master list of departments. Staff, doctors and services name one of these: while an
// organisation has any departments, a department name elsewhere must match an active one.
@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
  ) {}

  view(row: DepartmentRow, counts?: { staff: number; doctors: number; services: number }) {
    const { branches, ...rest } = row
    return { ...rest, branches: branches.map((entry) => entry.branch), counts: counts ?? null }
  }

  async list(orgId: string, status?: 'active' | 'inactive') {
    const rows = await this.prisma.department.findMany({ where: { orgId, ...(status ? { status } : {}) }, orderBy: { name: 'asc' }, select: departmentSelect })
    const [staff, doctors, services] = await Promise.all([
      this.prisma.staffMember.groupBy({ by: ['department'], where: { orgId }, _count: { _all: true } }),
      this.prisma.practitioner.groupBy({ by: ['department'], where: { orgId }, _count: { _all: true } }),
      this.prisma.billingService.groupBy({ by: ['department'], where: { orgId }, _count: { _all: true } }),
    ])
    const count = (list: Array<{ department: string | null; _count: { _all: number } }>, name: string) => list.filter((entry) => entry.department?.toLowerCase() === name.toLowerCase()).reduce((sum, entry) => sum + entry._count._all, 0)
    return rows.map((row) => this.view(row, { staff: count(staff, row.name), doctors: count(doctors, row.name), services: count(services, row.name) }))
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.department.findFirst({ where: { id, orgId }, select: departmentSelect })
    if (!row) throw notFound('Department not found.')
    const [staff, doctors, services] = await Promise.all([
      this.prisma.staffMember.findMany({ where: { orgId, department: { equals: row.name, mode: 'insensitive' } }, orderBy: { fullName: 'asc' }, select: { id: true, staffCode: true, fullName: true, type: true, designation: true, status: true } }),
      this.prisma.practitioner.findMany({ where: { orgId, department: { equals: row.name, mode: 'insensitive' } }, orderBy: { displayName: 'asc' }, select: { id: true, displayName: true, specialty: true, status: true } }),
      this.prisma.billingService.findMany({ where: { orgId, department: { equals: row.name, mode: 'insensitive' } }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, category: true, unit: true, price: true, status: true } }),
    ])
    return { ...this.view(row, { staff: staff.length, doctors: doctors.length, services: services.length }), staff, doctors, services: services.map((service) => ({ ...service, price: service.price.toFixed(2) })) }
  }

  async create(access: AccessContext, input: CreateDepartmentInput, actorUserId: string, client: ClientInfo) {
    await this.assertBranches(access.orgId, input.branchIds)
    await this.assertUnique(access.orgId, input.code, input.name)
    const id = await this.prisma.transaction(async (tx) => {
      const created = await tx.department.create({ data: { orgId: access.orgId, code: input.code, name: input.name, type: input.type, description: input.description, status: input.status, createdById: actorUserId }, select: { id: true } })
      await tx.departmentBranch.createMany({ data: input.branchIds.map((branchId) => ({ departmentId: created.id, branchId })) })
      await this.audit.record({ action: 'department.created', entityType: 'department', entityId: created.id, orgId: access.orgId, actorUserId, details: { code: input.code } }, client, tx)
      return created.id
    })
    return this.get(access.orgId, id)
  }

  // A rename keeps the people and services that used the old name: their department text moves with it.
  async update(access: AccessContext, id: string, input: UpdateDepartmentInput, actorUserId: string, client: ClientInfo) {
    const current = await this.get(access.orgId, id)
    await this.assertBranches(access.orgId, input.branchIds)
    if (input.name.toLowerCase() !== current.name.toLowerCase()) await this.assertUnique(access.orgId, null, input.name)
    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.department.updateMany({ where: { id, orgId: access.orgId, version: input.version }, data: { name: input.name, type: input.type, description: input.description, status: input.status, version: { increment: 1 } } })
      if (count === 0) throw conflict('DEPARTMENT_CHANGED', 'Someone else changed this department. Reload it and try again.')
      await tx.departmentBranch.deleteMany({ where: { departmentId: id } })
      await tx.departmentBranch.createMany({ data: input.branchIds.map((branchId) => ({ departmentId: id, branchId })) })
      if (input.name !== current.name) {
        const same = { orgId: access.orgId, department: { equals: current.name, mode: 'insensitive' as const } }
        await tx.staffMember.updateMany({ where: same, data: { department: input.name } })
        await tx.practitioner.updateMany({ where: same, data: { department: input.name } })
        await tx.billingService.updateMany({ where: same, data: { department: input.name } })
      }
      await this.audit.record({ action: 'department.updated', entityType: 'department', entityId: id, orgId: access.orgId, actorUserId, details: { renamed: input.name !== current.name, status: input.status } }, client, tx)
    })
    return this.get(access.orgId, id)
  }

  async assignMembers(access: AccessContext, id: string, input: DepartmentMembersInput, actorUserId: string, client: ClientInfo) {
    const department = await this.prisma.department.findFirst({ where: { id, orgId: access.orgId }, select: { name: true, status: true } })
    if (!department) throw notFound('Department not found.')
    if (department.status !== 'active') throw unprocessable('DEPARTMENT_INACTIVE', 'Activate the department before adding people to it.')
    const [staff, doctors] = await Promise.all([
      this.prisma.staffMember.count({ where: { orgId: access.orgId, id: { in: input.staffIds } } }),
      this.prisma.practitioner.count({ where: { orgId: access.orgId, id: { in: input.practitionerIds } } }),
    ])
    if (staff !== new Set(input.staffIds).size || doctors !== new Set(input.practitionerIds).size) throw unprocessable('PERSON_UNKNOWN', 'Choose staff and doctors of this organisation.')
    await this.prisma.transaction(async (tx) => {
      if (input.staffIds.length) await tx.staffMember.updateMany({ where: { orgId: access.orgId, id: { in: input.staffIds } }, data: { department: department.name } })
      if (input.practitionerIds.length) await tx.practitioner.updateMany({ where: { orgId: access.orgId, id: { in: input.practitionerIds } }, data: { department: department.name } })
      await this.audit.record({ action: 'department.members_added', entityType: 'department', entityId: id, orgId: access.orgId, actorUserId, details: { staff: input.staffIds.length, doctors: input.practitionerIds.length } }, client, tx)
    })
    return this.get(access.orgId, id)
  }

  // Creates departments named during onboarding that do not exist yet, at every branch.
  async ensure(tx: Tx, orgId: string, names: string[], actorUserId: string) {
    const existing = await tx.department.findMany({ where: { orgId }, select: { name: true } })
    const known = new Set(existing.map((entry) => entry.name.toLowerCase()))
    const branches = await tx.branch.findMany({ where: { orgId }, select: { id: true } })
    for (const name of [...new Set(names.map((entry) => entry.trim()))]) {
      if (!name || known.has(name.toLowerCase())) continue
      known.add(name.toLowerCase())
      const code = formatNumber('DEP-', await this.counters.next(tx, orgId, 'department'), 3)
      const created = await tx.department.create({ data: { orgId, code, name, type: 'Clinical', createdById: actorUserId }, select: { id: true } })
      if (branches.length) await tx.departmentBranch.createMany({ data: branches.map((branch) => ({ departmentId: created.id, branchId: branch.id })) })
    }
  }

  // Used by staff, doctors and services: the department as the master list spells it.
  async resolve(db: Db, orgId: string, name: string | null | undefined): Promise<string | null> {
    if (!name?.trim()) return null
    const departments = await db.department.findMany({ where: { orgId }, select: { name: true, status: true } })
    if (!departments.length) return name.trim()
    const match = departments.find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase())
    if (!match || match.status !== 'active') throw unprocessable('DEPARTMENT_UNKNOWN', `Choose an active department from Configuration › Departments (“${name.trim()}” is not one).`)
    return match.name
  }

  private async assertBranches(orgId: string, branchIds: string[]) {
    if ((await this.prisma.branch.count({ where: { id: { in: branchIds }, orgId } })) !== new Set(branchIds).size) throw unprocessable('BRANCH_UNKNOWN', 'Choose branches of this organisation.')
  }

  private async assertUnique(orgId: string, code: string | null, name: string) {
    const clash = await this.prisma.department.findFirst({ where: { orgId, OR: [...(code ? [{ code }] : []), { name: { equals: name, mode: 'insensitive' } }] }, select: { code: true, name: true } })
    if (clash) throw conflict('DEPARTMENT_EXISTS', clash.code === code ? `Another department already uses the code ${code}.` : `A department called “${clash.name}” already exists.`)
  }
}
