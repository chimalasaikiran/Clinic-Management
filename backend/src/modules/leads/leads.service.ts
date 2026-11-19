import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { LeadActivityKind, LeadStage, Prisma } from '../../generated/prisma/client'
import { PatientsService } from '../patients/patients.service'
import { CareScopeService } from '../scheduling/care-scope.service'
import { localDate } from '../scheduling/clinic-time'
import {
  clinicInstant, cohortWindow, describeChanges, DISPOSITION_LABELS, dueState, dueWindows, funnel, INTERACTION_LABELS, OUTCOME_LABELS, SOURCE_LABELS, STAGE_LABELS,
} from './leads.logic'
import type { ConvertNewPatientInput, CreateLeadInput, DispositionInput, InteractionInput, ListLeadsQuery, PerformanceQuery, UpdateLeadInput } from './leads.schemas'

const LEAD_PERMISSION = 'growth.leads'
// Calls logged a few minutes "in the future" are clock drift between devices, not invented activity.
const CLOCK_SLACK_MS = 5 * 60_000

const leadSelect = {
  id: true, number: true, fullName: true, mobile: true, email: true, interest: true, source: true, stage: true, nextAction: true, nextDueAt: true,
  convertedAt: true, lastActivityAt: true, createdAt: true, version: true,
  branch: { select: { id: true, name: true } },
  owner: { select: { id: true, user: { select: { fullName: true } } } },
  patient: { select: { id: true, mrn: true, fullName: true } },
} as const satisfies Prisma.LeadSelect

type LeadRow = Prisma.LeadGetPayload<{ select: typeof leadSelect }>

const activitySelect = {
  id: true, kind: true, title: true, text: true, details: true, occurredAt: true,
  actor: { select: { fullName: true } },
  owner: { select: { user: { select: { fullName: true } } } },
} as const satisfies Prisma.LeadActivitySelect

const EDIT_LABELS = { fullName: 'Name', mobile: 'Mobile', email: 'Email', interest: 'Interest', branch: 'Branch', owner: 'Owner', stage: 'Stage' }

interface Owner {
  membershipId: string
  name: string
  branches: 'all' | string[]
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly patients: PatientsService,
    private readonly careScope: CareScopeService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get zone() {
    return this.env.CLINIC_TIMEZONE
  }

  view(row: LeadRow, now = new Date()) {
    const { owner, ...rest } = row
    return { ...rest, owner: { membershipId: owner.id, name: owner.user.fullName }, dueState: dueState(row.nextDueAt, now, this.zone) }
  }

  // ─── Reading ────────────────────────────────────────────────────────────────

  async list(access: AccessContext, query: ListLeadsQuery) {
    const scope = this.scopeWhere(access, query.branchId)
    const now = new Date()
    const where: Prisma.LeadWhereInput = { AND: [scope, ...this.filters(query, now)] }
    const orderBy: Prisma.LeadOrderByWithRelationInput[] = query.sort === 'name'
      ? [{ fullName: 'asc' }, { id: 'asc' }]
      : query.sort === 'newest'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : [{ nextDueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }]

    const { endOfToday } = dueWindows(now, this.zone)
    const [total, rows, stages, overdue, dueToday] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({ where, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: leadSelect }),
      this.prisma.lead.groupBy({ by: ['stage'], where: scope, _count: { _all: true } }),
      this.prisma.lead.count({ where: { AND: [scope, { nextDueAt: { lt: now } }] } }),
      this.prisma.lead.count({ where: { AND: [scope, { nextDueAt: { gte: now, lt: endOfToday } }] } }),
    ])
    const byStage = Object.fromEntries(Object.keys(STAGE_LABELS).map((stage) => [stage, stages.find((entry) => entry.stage === stage)?._count._all ?? 0])) as Record<LeadStage, number>
    return {
      items: rows.map((row) => this.view(row, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      // Over every lead in scope (and the chosen branch), not just the filtered page.
      summary: { byStage, overdue, dueToday, followUpsDue: overdue + dueToday },
    }
  }

  async get(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const activities = await this.prisma.lead.findUniqueOrThrow({ where: { id }, select: { activities: { orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], select: activitySelect } } })
    return {
      ...this.view(row),
      activities: activities.activities.map(({ actor, owner, ...rest }) => ({ ...rest, actor: actor?.fullName ?? null, owner: owner?.user.fullName ?? null })),
      journey: await this.journey(access, row),
    }
  }

  // Other leads in scope with this mobile number, shown before a second record is created for one person.
  async duplicates(access: AccessContext, mobile: string, excludeId?: string) {
    const rows = await this.prisma.lead.findMany({
      where: { AND: [this.scopeWhere(access), { mobile }, excludeId ? { id: { not: excludeId } } : {}] },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: leadSelect,
    })
    return rows.map((row) => this.view(row))
  }

  // Members who may own a lead: an active login holding the lead permission. Each lists the branches it covers.
  async owners(access: AccessContext, branchId?: string) {
    if (branchId) await this.assertBranch(access, branchId)
    const owners = await this.eligibleOwners(access.orgId)
    const visible = owners.filter((owner) => access.branchScope === 'all' || owner.branches === 'all' || owner.branches.some((id) => access.branchScope.includes(id)))
    return visible.filter((owner) => !branchId || covers(owner, branchId))
  }

  // Lead volume by source and how far converted leads got, for leads created in [from, to].
  async performance(access: AccessContext, query: PerformanceQuery) {
    const where: Prisma.LeadWhereInput = {
      AND: [this.scopeWhere(access, query.branchId), { createdAt: cohortWindow(query.from, query.to, this.zone) }, query.source ? { source: query.source } : {}],
    }
    const leads = await this.prisma.lead.findMany({ where, select: { source: true, stage: true, patientId: true, convertedAt: true } })
    const patientIds = [...new Set(leads.flatMap((lead) => (lead.patientId ? [lead.patientId] : [])))]
    const earliest = leads.reduce<Date | null>((min, lead) => (lead.convertedAt && (!min || lead.convertedAt < min) ? lead.convertedAt : min), null)
    const appointments = patientIds.length && earliest
      ? await this.prisma.appointment.findMany({ where: { orgId: access.orgId, patientId: { in: patientIds }, startsAt: { gte: earliest } }, select: { patientId: true, startsAt: true, status: true } })
      : []
    const bySource = Object.fromEntries(Object.keys(SOURCE_LABELS).map((source) => [source, leads.filter((lead) => lead.source === source).length]))
    const byStage = Object.fromEntries(Object.keys(STAGE_LABELS).map((stage) => [stage, leads.filter((lead) => lead.stage === stage).length]))
    return { from: query.from, to: query.to, branchId: query.branchId ?? null, total: leads.length, bySource, byStage, ...funnel(leads, appointments) }
  }

  // ─── Changes ────────────────────────────────────────────────────────────────

  async create(access: AccessContext, actorUserId: string, input: CreateLeadInput, client: ClientInfo) {
    await this.assertBranch(access, input.branchId)
    await this.assertOwner(access.orgId, input.ownerMembershipId, input.branchId)
    if (!input.confirmedNotDuplicate) await this.assertNoDuplicate(access, input.mobile)
    const nextDueAt = input.nextDueDate ? this.futureDue(input.nextDueDate, input.nextDueTime) : null

    const id = await this.prisma.transaction(async (tx) => {
      const number = formatNumber('LD-', await this.counters.next(tx, access.orgId, 'lead_number'))
      const now = new Date()
      const lead = await tx.lead.create({
        data: {
          orgId: access.orgId, number, branchId: input.branchId, fullName: input.fullName, mobile: input.mobile, email: input.email, interest: input.interest, source: input.source,
          stage: input.stage, ownerMembershipId: input.ownerMembershipId, nextAction: nextDueAt ? input.nextAction : null, nextDueAt, lastActivityAt: now, createdById: actorUserId,
        },
        select: { id: true },
      })
      const about = input.interest ? ` about ${input.interest}` : ''
      await this.activity(tx, access.orgId, lead.id, 'created', `${SOURCE_LABELS[input.source]} recorded`, `New enquiry${about}.`, actorUserId, now)
      await this.audit.record({ action: 'lead.created', entityType: 'lead', entityId: lead.id, orgId: access.orgId, actorUserId, details: { number } }, client, tx)
      return lead.id
    })
    return this.get(access, id)
  }

  async update(access: AccessContext, id: string, actorUserId: string, input: UpdateLeadInput, client: ClientInfo) {
    const lead = await this.find(access, id)
    if ((lead.stage === 'converted') !== (input.stage === 'converted')) {
      throw unprocessable('LEAD_STAGE_LOCKED', lead.stage === 'converted' ? 'A converted lead keeps its Converted stage.' : 'Use Convert Lead to link this lead to a patient.')
    }
    await this.assertBranch(access, input.branchId)
    if (input.ownerMembershipId !== lead.owner.id || input.branchId !== lead.branch.id) await this.assertOwner(access.orgId, input.ownerMembershipId, input.branchId)
    if (input.mobile !== lead.mobile && !input.confirmedNotDuplicate) await this.assertNoDuplicate(access, input.mobile, id)

    const [branch, owner] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { id: input.branchId }, select: { name: true } }),
      this.prisma.membership.findUniqueOrThrow({ where: { id: input.ownerMembershipId }, select: { user: { select: { fullName: true } } } }),
    ])
    const before = { fullName: lead.fullName, mobile: lead.mobile, email: lead.email, interest: lead.interest, branch: lead.branch.name, owner: lead.owner.user.fullName, stage: STAGE_LABELS[lead.stage] }
    const after = { fullName: input.fullName, mobile: input.mobile, email: input.email, interest: input.interest, branch: branch.name, owner: owner.user.fullName, stage: STAGE_LABELS[input.stage] }
    const { changed, text } = describeChanges(before, after, EDIT_LABELS)
    // Closing a lead ends its open follow-up.
    const closing = input.stage === 'closed' && lead.stage !== 'closed'

    await this.prisma.transaction(async (tx) => {
      const now = new Date()
      const { count } = await tx.lead.updateMany({
        where: { id, orgId: access.orgId, version: input.version },
        data: {
          fullName: input.fullName, mobile: input.mobile, email: input.email, interest: input.interest, branchId: input.branchId, ownerMembershipId: input.ownerMembershipId, stage: input.stage,
          ...(closing ? { nextDueAt: null, nextAction: null } : {}), lastActivityAt: now, version: { increment: 1 },
        },
      })
      if (count === 0) throw this.changed()
      const closedNote = closing && lead.nextDueAt ? ' Open follow-up closed with the lead.' : ''
      await this.activity(tx, access.orgId, id, 'updated', changed.length ? 'Lead updated' : 'Lead saved', `${text || 'Saved without changes.'}${closedNote}`, actorUserId, now, { changed: Object.fromEntries(changed.map((key) => [key, [before[key as keyof typeof before], after[key as keyof typeof after]]])) })
      await this.audit.record({ action: 'lead.updated', entityType: 'lead', entityId: id, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
    })
    return this.get(access, id)
  }

  async recordInteraction(access: AccessContext, id: string, actorUserId: string, input: InteractionInput, client: ClientInfo) {
    const lead = await this.find(access, id)
    const occurredAt = clinicInstant(input.occurredDate, input.occurredTime, this.zone)
    if (occurredAt.getTime() > Date.now() + CLOCK_SLACK_MS) throw unprocessable('INTERACTION_IN_FUTURE', 'An interaction can only be recorded once it has happened.')
    const finished = lead.stage === 'converted' || lead.stage === 'closed'
    if (input.decision === 'complete' && !lead.nextDueAt) throw unprocessable('NO_OPEN_FOLLOW_UP', 'This lead has no open follow-up to complete.')
    if (input.decision === 'reschedule' && finished) throw unprocessable('LEAD_FINISHED', `A ${STAGE_LABELS[lead.stage].toLowerCase()} lead has no follow-ups to schedule.`)
    await this.assertOwner(access.orgId, input.ownerMembershipId, lead.branch.id)
    const nextDueAt = input.decision === 'reschedule' ? this.futureDue(input.nextDueDate!, input.nextDueTime) : null

    const task: Prisma.LeadUncheckedUpdateManyInput = input.decision === 'reschedule'
      ? { nextDueAt, nextAction: input.nextAction, ownerMembershipId: input.ownerMembershipId }
      : input.decision === 'complete' ? { nextDueAt: null, nextAction: null } : {}
    const when = (instant: Date | null) => (instant ? this.stamp(instant) : 'no date')
    const note = input.decision === 'reschedule'
      ? `Follow-up rescheduled ${when(lead.nextDueAt)} → ${when(nextDueAt)}. Reason: ${input.reason}`
      : input.decision === 'complete' ? 'Open follow-up completed.' : lead.nextDueAt ? 'Open follow-up kept open.' : ''

    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.lead.updateMany({
        where: { id, orgId: access.orgId, version: input.version },
        data: { ...task, lastActivityAt: occurredAt > lead.lastActivityAt ? occurredAt : lead.lastActivityAt, version: { increment: 1 } },
      })
      if (count === 0) throw this.changed()
      await this.activity(tx, access.orgId, id, 'interaction', `${INTERACTION_LABELS[input.type]} · ${OUTCOME_LABELS[input.outcome]}`, [input.notes, note].filter(Boolean).join(' '), actorUserId, occurredAt, {
        type: input.type, outcome: input.outcome, decision: input.decision, ...(input.decision === 'reschedule' ? { previousDueAt: lead.nextDueAt?.toISOString() ?? null, reason: input.reason } : {}),
      }, input.ownerMembershipId)
      await this.audit.record({ action: 'lead.interaction_recorded', entityType: 'lead', entityId: id, orgId: access.orgId, actorUserId, details: { decision: input.decision } }, client, tx)
    })
    return this.get(access, id)
  }

  // Re-engagement: defer to a later contact, or close the lead as unresponsive or not interested.
  async setDisposition(access: AccessContext, id: string, actorUserId: string, input: DispositionInput, client: ClientInfo) {
    const lead = await this.find(access, id)
    if (lead.stage === 'converted' || lead.stage === 'closed') throw unprocessable('LEAD_FINISHED', `This lead is already ${STAGE_LABELS[lead.stage].toLowerCase()}.`)
    await this.assertOwner(access.orgId, input.ownerMembershipId, lead.branch.id)
    const defer = input.disposition === 'defer'
    const nextDueAt = defer ? this.futureDue(input.nextDueDate!, input.nextDueTime) : null
    const text = defer
      ? `Deferred to ${this.stamp(nextDueAt!)}: ${input.nextAction}. Reason: ${input.reason}`
      : `${DISPOSITION_LABELS[input.disposition]}. ${STAGE_LABELS[lead.stage]} → Closed. ${input.nextAction}${input.reason ? ` Reason: ${input.reason}` : ''}`

    await this.prisma.transaction(async (tx) => {
      const now = new Date()
      const { count } = await tx.lead.updateMany({
        where: { id, orgId: access.orgId, version: input.version },
        data: {
          ...(defer ? { nextDueAt, nextAction: input.nextAction, ownerMembershipId: input.ownerMembershipId } : { stage: 'closed', nextDueAt: null, nextAction: null }),
          lastActivityAt: now, version: { increment: 1 },
        },
      })
      if (count === 0) throw this.changed()
      await this.activity(tx, access.orgId, id, 'disposition', `Re-engagement · ${DISPOSITION_LABELS[input.disposition]}`, text, actorUserId, now, { disposition: input.disposition }, input.ownerMembershipId)
      await this.audit.record({ action: 'lead.disposition', entityType: 'lead', entityId: id, orgId: access.orgId, actorUserId, details: { disposition: input.disposition } }, client, tx)
    })
    return this.get(access, id)
  }

  // Links the lead to a patient the member can see. The original source is kept; no appointment is booked.
  async convert(access: AccessContext, id: string, actorUserId: string, input: { patientId: string; version: number }, client: ClientInfo) {
    const lead = await this.find(access, id)
    this.assertConvertible(lead)
    const patient = await this.patients.get(access, input.patientId)
    await this.prisma.transaction((tx) => this.markConverted(tx, access, lead, input.version, { id: patient.id, mrn: patient.mrn, fullName: patient.fullName }, actorUserId, client, false))
    return this.get(access, id)
  }

  // Registers the patient from the lead's details and links the lead in the same transaction.
  async convertToNewPatient(access: AccessContext, id: string, actorUserId: string, input: ConvertNewPatientInput, client: ClientInfo) {
    const lead = await this.find(access, id)
    this.assertConvertible(lead)
    const { leadVersion, ...patient } = input
    await this.patients.create(access, actorUserId, patient, client, (tx, created) =>
      this.markConverted(tx, access, lead, leadVersion, { id: created.id, mrn: created.mrn, fullName: patient.fullName }, actorUserId, client, true))
    return this.get(access, id)
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async markConverted(tx: Tx, access: AccessContext, lead: LeadRow, version: number, patient: { id: string; mrn: string; fullName: string }, actorUserId: string, client: ClientInfo, registered: boolean) {
    const now = new Date()
    const { count } = await tx.lead.updateMany({
      where: { id: lead.id, orgId: access.orgId, version, stage: { notIn: ['converted', 'closed'] } },
      data: { stage: 'converted', patientId: patient.id, convertedAt: now, convertedById: actorUserId, nextDueAt: null, nextAction: null, lastActivityAt: now, version: { increment: 1 } },
    })
    if (count === 0) throw this.changed()
    const link = registered ? `Registered as new patient ${patient.fullName} (${patient.mrn}) and linked.` : `Linked to patient ${patient.fullName} (${patient.mrn}).`
    const followUp = lead.nextDueAt ? ' Open follow-up closed.' : ''
    await this.activity(tx, access.orgId, lead.id, 'converted', 'Lead converted', `${STAGE_LABELS[lead.stage]} → Converted. ${link}${followUp} Original source kept; no appointment booked.`, actorUserId, now, { patientId: patient.id, registered })
    await this.audit.record({ action: 'lead.converted', entityType: 'lead', entityId: lead.id, orgId: access.orgId, actorUserId, details: { patientId: patient.id, registered } }, client, tx)
  }

  private assertConvertible(lead: LeadRow) {
    if (lead.stage === 'converted') throw conflict('LEAD_ALREADY_CONVERTED', 'This lead is already converted.')
    if (lead.stage === 'closed') throw unprocessable('LEAD_FINISHED', 'Reopen this closed lead before converting it.')
  }

  // For a converted lead: the patient's first appointment on or after conversion and the first completed visit.
  private async journey(access: AccessContext, lead: LeadRow) {
    if (!lead.patient || !lead.convertedAt || !access.permissions.has('bookings.view')) return null
    const scope = await this.careScope.resolve(access)
    if (scope.appointments === 'none') return null
    const where: Prisma.AppointmentWhereInput = {
      orgId: access.orgId, patientId: lead.patient.id, startsAt: { gte: lead.convertedAt }, status: { not: 'cancelled' },
      ...(scope.appointments === 'all' ? {} : { practitionerId: scope.appointments.practitionerId }),
      ...(scope.branches === 'all' ? {} : { branchId: { in: [...scope.branches] } }),
    }
    const select = { id: true, reference: true, startsAt: true, status: true } as const
    const [first, completed] = await Promise.all([
      this.prisma.appointment.findFirst({ where, orderBy: { startsAt: 'asc' }, select }),
      this.prisma.appointment.findFirst({ where: { ...where, status: 'completed' }, orderBy: { startsAt: 'asc' }, select }),
    ])
    const shape = (row: typeof first) => (row ? { id: row.id, reference: row.reference, date: localDate(row.startsAt, this.zone), status: row.status } : null)
    return { appointment: shape(first), consultation: shape(completed) }
  }

  private filters(query: ListLeadsQuery, now: Date): Prisma.LeadWhereInput[] {
    const filters: Prisma.LeadWhereInput[] = []
    const text = query.q?.trim()
    if (text) {
      const digits = text.replace(/\D/g, '')
      filters.push({
        OR: [
          { fullName: { contains: text, mode: 'insensitive' } },
          { number: { contains: text, mode: 'insensitive' } },
          { interest: { contains: text, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : []),
        ],
      })
    }
    if (query.stage) filters.push({ stage: query.stage })
    if (query.source) filters.push({ source: query.source })
    if (query.ownerId) filters.push({ ownerMembershipId: query.ownerId })
    if (query.due) {
      const { endOfToday } = dueWindows(now, this.zone)
      const window = { overdue: { lt: now }, due_today: { gte: now, lt: endOfToday }, upcoming: { gte: endOfToday }, open: { not: null } }[query.due]
      filters.push({ nextDueAt: window })
    }
    if (query.from || query.to) {
      const window = cohortWindow(query.from ?? '1970-01-01', query.to ?? '9999-12-30', this.zone)
      filters.push({ createdAt: window })
    }
    return filters
  }

  // Leads in the member's branches (and the chosen one, if any).
  private scopeWhere(access: AccessContext, branchId?: string): Prisma.LeadWhereInput {
    if (branchId && access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    return { orgId: access.orgId, ...(branchId ? { branchId } : access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prisma.lead.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: leadSelect })
    // Out of scope and missing look the same, so lead ids cannot be probed.
    if (!row) throw notFound('Lead not found.')
    return row
  }

  private async assertBranch(access: AccessContext, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, orgId: access.orgId, status: 'active' }, select: { id: true } })
    if (!branch) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch of this organisation.')
    if (access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
  }

  private async assertOwner(orgId: string, membershipId: string, branchId: string) {
    const owner = (await this.eligibleOwners(orgId, membershipId))[0]
    if (!owner || !covers(owner, branchId)) {
      throw unprocessable('OWNER_NOT_ELIGIBLE', 'Choose an owner who can work leads at this branch.')
    }
  }

  private async assertNoDuplicate(access: AccessContext, mobile: string, excludeId?: string) {
    const matches = await this.duplicates(access, mobile, excludeId)
    if (matches.length) {
      throw conflict('POSSIBLE_DUPLICATE', 'Another lead already uses this mobile number. Review it, or confirm this is a separate enquiry.', matches.map((match) => ({ field: 'mobile', issue: `${match.fullName} (${match.number})` })))
    }
  }

  private async eligibleOwners(orgId: string, membershipId?: string): Promise<Owner[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        orgId, status: 'active', user: { status: 'active' }, ...(membershipId ? { id: membershipId } : {}),
        roles: { some: { role: { status: 'active', permissions: { some: { permission: LEAD_PERMISSION } } } } },
      },
      select: {
        id: true,
        user: { select: { fullName: true } },
        roles: { where: { role: { status: 'active' } }, select: { role: { select: { scope: true, branches: { select: { branchId: true } } } } } },
      },
      orderBy: { user: { fullName: 'asc' } },
    })
    return memberships.map((membership) => {
      const roles = membership.roles.map((entry) => entry.role)
      const branches = roles.some((role) => role.scope === 'org') ? ('all' as const) : [...new Set(roles.flatMap((role) => role.branches.map((entry) => entry.branchId)))]
      return { membershipId: membership.id, name: membership.user.fullName, branches }
    })
  }

  private futureDue(date: string, time: string) {
    const due = clinicInstant(date, time, this.zone)
    if (localDate(due, this.zone) < localDate(new Date(), this.zone)) throw unprocessable('FOLLOW_UP_IN_PAST', 'Choose a follow-up date from today onwards.')
    return due
  }

  private stamp(instant: Date) {
    return new Intl.DateTimeFormat('en-IN', { timeZone: this.zone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  }

  private activity(tx: Tx, orgId: string, leadId: string, kind: LeadActivityKind, title: string, text: string, actorId: string, occurredAt: Date, details?: Prisma.InputJsonObject, ownerMembershipId?: string) {
    return tx.leadActivity.create({ data: { orgId, leadId, kind, title, text: text.slice(0, 2000), details, occurredAt, actorId, ownerMembershipId } })
  }

  private changed() {
    return conflict('LEAD_CHANGED', 'Someone else changed this lead while you were working on it. Reload to see the latest details, then try again.')
  }
}

const covers = (owner: Owner, branchId: string) => owner.branches === 'all' || owner.branches.includes(branchId)
