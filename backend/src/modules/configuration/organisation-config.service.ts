import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { MAX_MEDIA_BYTES, sniffImage } from '../content/content.logic'
import { localDate } from '../scheduling/clinic-time'
import type { ClosureInput, ContactInput, CreateBranchInput, HoursInput, OperationsInput, OrganisationInput, SpecialtiesInput, UpdateBranchInput } from './configuration.schemas'
import { DepartmentsService } from './departments.service'

const organisationSelect = {
  id: true, displayName: true, facilityType: true, location: true, city: true, state: true, status: true, phone: true, email: true, logoId: true,
  classification: true, structure: true, specialties: true, acceptsInsurance: true, version: true, createdAt: true,
} as const satisfies Prisma.OrganisationSelect

const branchSelect = {
  id: true, code: true, name: true, addressLine1: true, addressLine2: true, city: true, state: true, pinCode: true, country: true, phone: true, email: true, facilityType: true,
  status: true, isPrimary: true, version: true, createdAt: true, updatedAt: true,
  departments: { select: { department: { select: { id: true, code: true, name: true, status: true } } } },
  hours: { orderBy: [{ weekday: 'asc' }, { start: 'asc' }], select: { weekday: true, start: true, end: true, label: true } },
} as const satisfies Prisma.BranchSelect

type BranchRow = Prisma.BranchGetPayload<{ select: typeof branchSelect }>

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

// The organisation's profile (onboarding and Configuration), its branches, their weekly hours and closures.
@Injectable()
export class OrganisationConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departments: DepartmentsService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─── Organisation ─────────────────────────────────────────────────────────

  async profile(orgId: string) {
    const [organisation, branches, departments, members] = await Promise.all([
      this.prisma.organisation.findUniqueOrThrow({ where: { id: orgId }, select: organisationSelect }),
      this.prisma.branch.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true } }),
      this.prisma.department.count({ where: { orgId, status: 'active' } }),
      this.prisma.membership.count({ where: { orgId, status: 'active' } }),
    ])
    const count = (status: string) => branches.find((entry) => entry.status === status)?._count._all ?? 0
    return {
      ...organisation,
      counts: { branches: branches.reduce((sum, entry) => sum + entry._count._all, 0), activeBranches: count('active'), departments, members },
    }
  }

  async update(access: AccessContext, input: OrganisationInput, actorUserId: string, client: ClientInfo) {
    const { version, ...fields } = input
    await this.write(access.orgId, version, fields, 'organisation.updated', actorUserId, client)
    return this.profile(access.orgId)
  }

  // Onboarding steps 2–4. Each saves what that screen asks; none needs a version, because only the person setting
  // the clinic up uses them.
  async saveContact(access: AccessContext, input: ContactInput, actorUserId: string, client: ClientInfo) {
    await this.write(access.orgId, null, input, 'organisation.contact_saved', actorUserId, client)
    return this.profile(access.orgId)
  }

  async saveOperations(access: AccessContext, input: OperationsInput, actorUserId: string, client: ClientInfo) {
    await this.write(access.orgId, null, input, 'organisation.operations_saved', actorUserId, client)
    return this.profile(access.orgId)
  }

  // Saves the specialties and creates any named department that does not exist yet, at every branch.
  async saveSpecialties(access: AccessContext, input: SpecialtiesInput, actorUserId: string, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      await tx.organisation.update({ where: { id: access.orgId }, data: { specialties: input.specialties, version: { increment: 1 } } })
      await this.departments.ensure(tx, access.orgId, input.departments, actorUserId)
      await this.audit.record({ action: 'organisation.specialties_saved', entityType: 'organisation', entityId: access.orgId, orgId: access.orgId, actorUserId, details: { specialties: input.specialties.length, departments: input.departments.length } }, client, tx)
    })
    return this.profile(access.orgId)
  }

  // The last onboarding screen: the clinic is set up.
  async complete(access: AccessContext, actorUserId: string, client: ClientInfo) {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: access.orgId }, select: { status: true, phone: true, classification: true, specialties: true } })
    if (organisation.status === 'active') return this.profile(access.orgId)
    const missing = [!organisation.phone && 'clinic phone', !organisation.classification && 'clinic type', !organisation.specialties.length && 'specialties'].filter(Boolean)
    if (missing.length) throw unprocessable('SETUP_INCOMPLETE', `Finish setup first: ${missing.join(', ')}.`)
    await this.prisma.organisation.update({ where: { id: access.orgId }, data: { status: 'active' } })
    await this.audit.record({ action: 'organisation.setup_completed', entityType: 'organisation', entityId: access.orgId, orgId: access.orgId, actorUserId }, client)
    return this.profile(access.orgId)
  }

  async uploadLogo(access: AccessContext, bytes: Buffer, fileName: string, actorUserId: string, client: ClientInfo) {
    if (!bytes.length) throw unprocessable('MEDIA_EMPTY', 'Choose an image to upload.')
    if (bytes.length > MAX_MEDIA_BYTES) throw unprocessable('MEDIA_TOO_LARGE', 'Use an image of at most 5 MB.')
    const mimeType = sniffImage(bytes)
    if (!mimeType) throw unprocessable('MEDIA_TYPE', 'Upload a PNG, JPEG or WebP image.')
    await this.prisma.transaction(async (tx) => {
      const logo = await tx.mediaAsset.create({ data: { orgId: access.orgId, fileName: fileName.replace(/[^\w.\- ]/g, '_').slice(0, 200) || 'logo', mimeType, size: bytes.length, data: new Uint8Array(bytes), createdById: actorUserId }, select: { id: true } })
      await tx.organisation.update({ where: { id: access.orgId }, data: { logoId: logo.id, version: { increment: 1 } } })
      await this.audit.record({ action: 'organisation.logo_changed', entityType: 'organisation', entityId: access.orgId, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.profile(access.orgId)
  }

  async logo(orgId: string) {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: orgId }, select: { logo: { select: { mimeType: true, data: true } } } })
    if (!organisation.logo) throw notFound('No logo uploaded.')
    return { mimeType: organisation.logo.mimeType, data: Buffer.from(organisation.logo.data) }
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  view(row: BranchRow, today?: { appointments: number; staff: number }) {
    const { departments, ...rest } = row
    return { ...rest, departments: departments.map((entry) => entry.department), today: today ?? null }
  }

  async branches(access: AccessContext) {
    const rows = await this.prisma.branch.findMany({ where: this.scope(access), orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: branchSelect })
    const ids = rows.map((row) => row.id)
    const zone = this.env.CLINIC_TIMEZONE
    const today = localDate(new Date(), zone)
    const [appointments, staff] = await Promise.all([
      ids.length ? this.prisma.$queryRaw<Array<{ branchId: string; n: number }>>`
        select branch_id as "branchId", count(*)::int as n from appointments
        where branch_id = any(${ids}::uuid[]) and (starts_at at time zone ${zone})::date = ${today}::date and status not in ('cancelled')
        group by 1` : [],
      ids.length ? this.prisma.staffBranch.groupBy({ by: ['branchId'], where: { branchId: { in: ids } }, _count: { _all: true } }) : [],
    ])
    return rows.map((row) => this.view(row, { appointments: appointments.find((entry) => entry.branchId === row.id)?.n ?? 0, staff: staff.find((entry) => entry.branchId === row.id)?._count._all ?? 0 }))
  }

  async branch(access: AccessContext, id: string) {
    const row = await this.findBranch(access, id)
    const [closures, doctors, services, pharmacies, stores, staff] = await Promise.all([
      this.closures(access, id),
      this.prisma.practitioner.count({ where: { orgId: access.orgId, status: 'active', availability: { some: { branchId: id } } } }),
      this.prisma.billingServicePrice.count({ where: { branchId: id, service: { status: 'active' } } }),
      this.prisma.stockLocation.count({ where: { branchId: id, kind: 'pharmacy', active: true } }),
      this.prisma.stockLocation.count({ where: { branchId: id, kind: 'store', active: true } }),
      this.prisma.staffBranch.count({ where: { branchId: id } }),
    ])
    // What the branch is set up to do, from the records that make it possible.
    return { ...this.view(row), closures, capabilities: { doctors, services, pharmacies, stores, staff } }
  }

  async createBranch(access: AccessContext, input: CreateBranchInput, actorUserId: string, client: ClientInfo) {
    if (access.branchScope !== 'all') throw forbidden('ORG_WIDE_ROLE_REQUIRED', 'Only organisation-wide roles can add branches.')
    const { roleIds, ...fields } = input
    if (await this.prisma.branch.count({ where: { orgId: access.orgId, code: fields.code } })) throw conflict('BRANCH_CODE_TAKEN', `Another branch already uses the code ${fields.code}.`)
    if (roleIds.length && (await this.prisma.role.count({ where: { id: { in: roleIds }, orgId: access.orgId, scope: 'branch' } })) !== roleIds.length) {
      throw unprocessable('ROLE_UNKNOWN', 'Choose branch-limited roles of this organisation.')
    }
    const id = await this.prisma.transaction(async (tx) => {
      const branch = await tx.branch.create({ data: { ...fields, orgId: access.orgId }, select: { id: true } })
      if (roleIds.length) await tx.roleBranch.createMany({ data: roleIds.map((roleId) => ({ roleId, branchId: branch.id })) })
      await this.audit.record({ action: 'branch.created', entityType: 'branch', entityId: branch.id, orgId: access.orgId, actorUserId, details: { code: fields.code } }, client, tx)
      return branch.id
    })
    return this.branch(access, id)
  }

  async updateBranch(access: AccessContext, id: string, input: UpdateBranchInput, actorUserId: string, client: ClientInfo) {
    const current = await this.findBranch(access, id)
    if (current.isPrimary && input.status !== 'active') throw unprocessable('PRIMARY_BRANCH', 'The primary branch stays active.')
    const { version, ...fields } = input
    const { count } = await this.prisma.branch.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...fields, version: { increment: 1 } } })
    if (count === 0) throw conflict('BRANCH_CHANGED', 'Someone else changed this branch. Reload it and try again.')
    await this.audit.record({ action: 'branch.updated', entityType: 'branch', entityId: id, orgId: access.orgId, actorUserId, details: { status: input.status } }, client)
    return this.branch(access, id)
  }

  // ─── Hours and closures ───────────────────────────────────────────────────

  // Replaces the weekly sessions. Sessions on one day must not overlap.
  async setHours(access: AccessContext, id: string, input: HoursInput, actorUserId: string, client: ClientInfo) {
    await this.findBranch(access, id)
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = input.sessions.filter((session) => session.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start))
      if (day.length > 4) throw unprocessable('HOURS_TOO_MANY', 'Use at most 4 sessions a day.')
      if (day.some((session, index) => index > 0 && session.start < day[index - 1]!.end)) throw unprocessable('HOURS_OVERLAP', 'Two sessions on the same day overlap. Adjust the times so they do not.')
    }
    await this.prisma.transaction(async (tx) => {
      await tx.branchHours.deleteMany({ where: { branchId: id } })
      if (input.sessions.length) await tx.branchHours.createMany({ data: input.sessions.map((session) => ({ branchId: id, ...session })) })
      await this.audit.record({ action: 'branch.hours_changed', entityType: 'branch', entityId: id, orgId: access.orgId, actorUserId, details: { sessions: input.sessions.length } }, client, tx)
    })
    return this.branch(access, id)
  }

  // Closures from today on (and the last 30 days, for reference).
  async closures(access: AccessContext, branchId: string) {
    const from = new Date(`${localDate(new Date(Date.now() - 30 * 86_400_000), this.env.CLINIC_TIMEZONE)}T00:00:00Z`)
    const rows = await this.prisma.branchClosure.findMany({ where: { branchId, branch: { orgId: access.orgId }, date: { gte: from } }, orderBy: { date: 'asc' }, select: { id: true, date: true, kind: true, opensAt: true, closesAt: true, reason: true, createdAt: true, createdBy: { select: { fullName: true } } } })
    return rows.map(({ createdBy, date, ...row }) => ({ ...row, date: isoDay(date), createdBy: createdBy.fullName }))
  }

  async addClosure(access: AccessContext, branchId: string, input: ClosureInput, actorUserId: string, client: ClientInfo) {
    await this.findBranch(access, branchId)
    if (input.date < localDate(new Date(), this.env.CLINIC_TIMEZONE)) throw unprocessable('DATE_IN_PAST', 'Choose today or a later date.')
    if (await this.prisma.branchClosure.count({ where: { branchId, date: new Date(`${input.date}T00:00:00Z`) } })) throw conflict('CLOSURE_EXISTS', 'That date already has an exception. Remove it first to change it.')
    const booked = input.kind === 'closed' ? await this.bookedOn(branchId, input.date) : 0
    await this.prisma.transaction(async (tx) => {
      await tx.branchClosure.create({ data: { branchId, date: new Date(`${input.date}T00:00:00Z`), kind: input.kind, opensAt: input.kind === 'special' ? input.opensAt : null, closesAt: input.kind === 'special' ? input.closesAt : null, reason: input.reason, createdById: actorUserId } })
      await this.audit.record({ action: 'branch.closure_added', entityType: 'branch', entityId: branchId, orgId: access.orgId, actorUserId, details: { date: input.date, kind: input.kind } }, client, tx)
    })
    // Existing appointments are not cancelled automatically; the response says how many need rebooking.
    return { closures: await this.closures(access, branchId), bookedThatDay: booked }
  }

  async removeClosure(access: AccessContext, branchId: string, closureId: string, actorUserId: string, client: ClientInfo) {
    await this.findBranch(access, branchId)
    const closure = await this.prisma.branchClosure.findFirst({ where: { id: closureId, branchId }, select: { date: true } })
    if (!closure) throw notFound('Exception not found.')
    if (isoDay(closure.date) < localDate(new Date(), this.env.CLINIC_TIMEZONE)) throw unprocessable('DATE_IN_PAST', 'A past exception is kept as a record.')
    await this.prisma.branchClosure.delete({ where: { id: closureId } })
    await this.audit.record({ action: 'branch.closure_removed', entityType: 'branch', entityId: branchId, orgId: access.orgId, actorUserId, details: { date: isoDay(closure.date) } }, client)
    return { closures: await this.closures(access, branchId), bookedThatDay: 0 }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async bookedOn(branchId: string, date: string) {
    const zone = this.env.CLINIC_TIMEZONE
    const rows = await this.prisma.$queryRaw<Array<{ n: number }>>`
      select count(*)::int as n from appointments where branch_id = ${branchId}::uuid and (starts_at at time zone ${zone})::date = ${date}::date and status in ('pending', 'confirmed')`
    return rows[0]?.n ?? 0
  }

  private async write(orgId: string, version: number | null, data: Prisma.OrganisationUpdateManyMutationInput, action: string, actorUserId: string, client: ClientInfo) {
    const { count } = await this.prisma.organisation.updateMany({ where: { id: orgId, ...(version ? { version } : {}) }, data: { ...data, version: { increment: 1 } } })
    if (count === 0) throw conflict('ORGANISATION_CHANGED', 'Someone else changed the organisation. Reload it and try again.')
    await this.audit.record({ action, entityType: 'organisation', entityId: orgId, orgId, actorUserId }, client)
  }

  private scope(access: AccessContext): Prisma.BranchWhereInput {
    return { orgId: access.orgId, ...(access.branchScope === 'all' ? {} : { id: { in: [...access.branchScope] } }) }
  }

  private async findBranch(access: AccessContext, id: string) {
    const row = await this.prisma.branch.findFirst({ where: { AND: [this.scope(access), { id }] }, select: branchSelect })
    if (!row) throw notFound('Branch not found.')
    return row
  }
}
