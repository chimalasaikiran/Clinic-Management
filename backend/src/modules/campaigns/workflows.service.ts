import { Inject, Injectable, Logger } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma, WorkflowRunOutcome, WorkflowTrigger } from '../../generated/prisma/client'
import { AutomatedContact, AutomatedSendService } from '../messaging/automated-send.service'
import { ChannelsService } from '../messaging/channels.service'
import { SKIP_LABELS, SkipReason, templateVariables } from '../messaging/messaging.logic'
import { RealtimeService } from '../messaging/realtime.service'
import { AudiencesService } from './audiences.service'
import { delayLabel, eventWindow, firstName, isUniqueViolation, TRIGGER_LABELS, TRIGGER_VARIABLES, unfilledVariables } from './campaigns.logic'
import type { ListRunsQuery, UpdateWorkflowInput, WorkflowInput } from './campaigns.schemas'
import { growthMembers } from './growth-members'

// Events looked at per workflow each time the worker runs; the rest wait for the next run.
const BATCH = 100

const templateSelect = { id: true, code: true, name: true, category: true, channel: true, subject: true, body: true, status: true, providerRef: true, version: true } as const

const workflowSelect = {
  id: true, code: true, name: true, trigger: true, delayHours: true, variables: true, weeklyCap: true, status: true, activatedAt: true, version: true, changeNote: true, createdAt: true, updatedAt: true,
  branch: { select: { id: true, name: true } },
  template: { select: templateSelect },
  owner: { select: { id: true, user: { select: { fullName: true } } } },
  activatedBy: { select: { fullName: true } },
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
} as const satisfies Prisma.WorkflowSelect

type WorkflowRow = Prisma.WorkflowGetPayload<{ select: typeof workflowSelect }>

const patientContact = { id: true, fullName: true, alias: true, mobile: true, email: true, homeBranchId: true, notifyWhatsapp: true, notifySms: true, status: true } as const

interface Candidate {
  subjectKey: string
  dueAt: Date
  leadId?: string
  patientId?: string
  appointmentId?: string
  contact: AutomatedContact | null
  values: Record<string, string>
  // Set when the event no longer calls for a message.
  skip?: SkipReason
}

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger('Workflows')

  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly audiences: AudiencesService,
    private readonly automated: AutomatedSendService,
    private readonly channels: ChannelsService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // What still stands between this workflow and switching it on.
  private async problems(orgId: string, row: { trigger: WorkflowTrigger; variables: unknown; template: WorkflowRow['template'] }) {
    const problems: string[] = []
    const template = row.template
    if (!template) return ['Choose a message template.']
    if (template.status !== 'approved' || (template.channel !== 'email' && !template.providerRef)) problems.push(`${template.code} is not approved, or has no provider template reference.`)
    if (!(await this.channels.connected(orgId, template.channel))) problems.push(`The ${template.channel === 'whatsapp' ? 'WhatsApp' : template.channel === 'sms' ? 'SMS' : 'email'} channel is not connected.`)
    const unfilled = unfilledVariables(templateVariables(template.body), row.variables as Record<string, string>, TRIGGER_VARIABLES[row.trigger])
    if (unfilled.length) problems.push(`Give a value for ${unfilled.map((name) => `{{${name}}}`).join(', ')}.`)
    if (row.trigger === 'review_request' && !templateVariables(template.body).includes('review_link')) problems.push('A review request template must include {{review_link}}.')
    return problems
  }

  async view(orgId: string, row: WorkflowRow) {
    const { owner, activatedBy, createdBy, updatedBy, ...rest } = row
    return {
      ...rest,
      triggerLabel: TRIGGER_LABELS[row.trigger],
      delayLabel: delayLabel(row.delayHours),
      eventVariables: TRIGGER_VARIABLES[row.trigger],
      owner: { membershipId: owner.id, name: owner.user.fullName },
      activatedBy: activatedBy?.fullName ?? null,
      updatedBy: updatedBy?.fullName ?? createdBy.fullName,
      problems: await this.problems(orgId, row),
    }
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  async list(access: AccessContext) {
    const rows = await this.prisma.workflow.findMany({ where: this.scopeWhere(access), orderBy: [{ createdAt: 'desc' }], select: workflowSelect })
    const ids = rows.map((row) => row.id)
    const since = new Date(Date.now() - 7 * 24 * 3_600_000)
    const counts = ids.length ? await this.prisma.workflowRun.groupBy({ by: ['workflowId', 'outcome'], where: { workflowId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }) : []
    return Promise.all(rows.map(async (row) => ({
      ...(await this.view(access.orgId, row)),
      lastWeek: Object.fromEntries((['queued', 'skipped'] as WorkflowRunOutcome[]).map((outcome) => [outcome, counts.find((entry) => entry.workflowId === row.id && entry.outcome === outcome)?._count._all ?? 0])),
    })))
  }

  async get(access: AccessContext, id: string) {
    return this.view(access.orgId, await this.find(access, id))
  }

  // What the workflows did: each event acted on, with the message's delivery state or the reason it was skipped.
  async runs(access: AccessContext, query: ListRunsQuery) {
    const where: Prisma.WorkflowRunWhereInput = {
      orgId: access.orgId,
      workflow: this.scopeWhere(access),
      ...(query.workflowId ? { workflowId: query.workflowId } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.problem ? { OR: [{ outcome: 'skipped' }, { message: { status: { in: ['failed', 'unknown'] } } }] } : {}),
    }
    const patients = access.permissions.has('patients.view')
    const [total, rows] = await Promise.all([
      this.prisma.workflowRun.count({ where }),
      this.prisma.workflowRun.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        select: {
          id: true, subjectKey: true, dueAt: true, outcome: true, skipReason: true, workflowVersion: true, createdAt: true,
          workflow: { select: { id: true, code: true, name: true, trigger: true } },
          lead: { select: { id: true, number: true, fullName: true } },
          patient: { select: { id: true, mrn: true, fullName: true } },
          appointment: { select: { id: true, reference: true, startsAt: true } },
          message: { select: { id: true, status: true, errorCode: true, errorMessage: true, conversationId: true, sentAt: true, deliveredAt: true } },
        },
      }),
    ])
    return {
      items: rows.map((row) => ({
        ...row,
        patient: row.patient ? (patients ? row.patient : { id: row.patient.id, mrn: null, fullName: null }) : null,
        skipLabel: row.skipReason ? SKIP_LABELS[row.skipReason as SkipReason] ?? row.skipReason : null,
      })),
      page: query.page, pageSize: query.pageSize, total,
    }
  }

  async owners(access: AccessContext) {
    return growthMembers(this.prisma, access.orgId)
  }

  // ─── Changes ──────────────────────────────────────────────────────────────

  async create(access: AccessContext, input: WorkflowInput, actorUserId: string, client: ClientInfo) {
    await this.assertReferences(access, input)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('WF-', await this.counters.next(tx, access.orgId, 'workflow'), 4)
      const created = await tx.workflow.create({ data: { orgId: access.orgId, code, ...this.fields(input), changeNote: input.changeNote ?? 'Workflow created.', createdById: actorUserId }, select: { id: true } })
      await this.audit.record({ action: 'workflow.created', entityType: 'workflow', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return this.get(access, id)
  }

  // A workflow that is switched on is never edited in place: pause it first.
  async update(access: AccessContext, id: string, input: UpdateWorkflowInput, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (current.status === 'active') throw conflict('WORKFLOW_ACTIVE', 'Pause this workflow before changing it.')
    await this.assertReferences(access, input)
    const { count } = await this.prisma.workflow.updateMany({
      where: { id, orgId: access.orgId, version: input.version, status: { not: 'active' } },
      data: { ...this.fields(input), changeNote: input.changeNote, updatedById: actorUserId, version: { increment: 1 } },
    })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'workflow.updated', entityType: 'workflow', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  // Switching on: only events falling due from now are acted on, never older history.
  async activate(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (current.status === 'active') throw conflict('WORKFLOW_ACTIVE', 'This workflow is already on.')
    this.audiences.assertBranchScope(access, current.branch?.id ?? null)
    const problems = await this.problems(access.orgId, current)
    if (problems.length) throw unprocessable('WORKFLOW_NOT_READY', problems.join(' '))
    const { count } = await this.prisma.workflow.updateMany({
      where: { id, orgId: access.orgId, version, status: { not: 'active' } },
      data: { status: 'active', activatedAt: new Date(), activatedById: actorUserId, version: { increment: 1 } },
    })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'workflow.activated', entityType: 'workflow', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  async pause(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    await this.find(access, id)
    const { count } = await this.prisma.workflow.updateMany({ where: { id, orgId: access.orgId, version, status: 'active' }, data: { status: 'paused', version: { increment: 1 } } })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'workflow.paused', entityType: 'workflow', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  // ─── Running ──────────────────────────────────────────────────────────────

  activeIds() {
    return this.prisma.workflow.findMany({ where: { status: 'active' }, select: { id: true } }).then((rows) => rows.map((row) => row.id))
  }

  // Acts on the events now due for one workflow. Returns how many it recorded.
  async process(workflowId: string, now = new Date()) {
    const workflow = await this.prisma.workflow.findUniqueOrThrow({ where: { id: workflowId }, select: { ...workflowSelect, orgId: true, activatedById: true } })
    if (workflow.status !== 'active' || !workflow.activatedAt || !workflow.template) return 0
    const template = workflow.template
    // Something changed since it was switched on (template unapproved, channel disconnected): pause rather than skip everyone.
    const problems = await this.problems(workflow.orgId, workflow)
    if (problems.length) {
      await this.prisma.workflow.updateMany({ where: { id: workflowId, status: 'active' }, data: { status: 'paused', changeNote: `Paused automatically: ${problems.join(' ')}`.slice(0, 500), version: { increment: 1 } } })
      this.logger.warn({ workflowId }, 'Workflow paused automatically')
      return 0
    }
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: workflow.orgId }, select: { displayName: true } })
    const fixed = { ...Object.fromEntries(Object.entries(workflow.variables as Record<string, string>).filter(([, value]) => value.trim())), clinic_name: organisation.displayName }
    const candidates = await this.candidates(workflow.orgId, workflow.id, workflow.trigger, workflow.branch?.id ?? null, eventWindow(workflow.activatedAt, workflow.delayHours, now), workflow.delayHours)

    let recorded = 0
    for (const candidate of candidates) {
      try {
        const result = await this.prisma.transaction(async (tx) => {
          const sent = candidate.skip || !candidate.contact
            ? null
            : await this.automated.queue(tx, { orgId: workflow.orgId, template, contact: candidate.contact, variables: { ...fixed, ...candidate.values }, origin: 'workflow', weeklyCap: workflow.weeklyCap, actorUserId: workflow.activatedById, now })
          const skipReason: SkipReason = candidate.skip ?? (sent && !sent.queued ? sent.reason : 'NO_ADDRESS')
          await tx.workflowRun.create({
            data: {
              orgId: workflow.orgId, workflowId: workflow.id, workflowVersion: workflow.version, subjectKey: candidate.subjectKey, leadId: candidate.leadId, patientId: candidate.patientId, appointmentId: candidate.appointmentId,
              dueAt: candidate.dueAt, ...(sent?.queued ? { outcome: 'queued', messageId: sent.messageId } : { outcome: 'skipped', skipReason }),
            },
          })
          return sent
        })
        recorded += 1
        if (result?.queued) await this.realtime.publish({ orgId: workflow.orgId, branchId: result.branchId, type: 'message', conversationId: result.conversationId, messageId: result.messageId })
      } catch (error) {
        // Another worker recorded this event first.
        if (!isUniqueViolation(error)) throw error
      }
    }
    return recorded
  }

  private async candidates(orgId: string, workflowId: string, trigger: WorkflowTrigger, branchId: string | null, window: { gte: Date; lte: Date }, delayHours: number): Promise<Candidate[]> {
    const delay = delayHours * 3_600_000
    const due = (at: Date) => new Date(at.getTime() + delay)
    const branch = branchId ? { branchId } : {}

    if (trigger === 'lead_not_booked') {
      const leads = await this.prisma.lead.findMany({
        where: { orgId, ...branch, createdAt: window, workflowRuns: { none: { workflowId } } },
        orderBy: { createdAt: 'asc' }, take: BATCH,
        select: { id: true, fullName: true, mobile: true, email: true, interest: true, branchId: true, stage: true, createdAt: true },
      })
      return leads.map((lead) => ({
        subjectKey: `lead:${lead.id}`, dueAt: due(lead.createdAt), leadId: lead.id,
        contact: { leadId: lead.id, patientId: null, branchId: lead.branchId, preferredName: firstName(lead.fullName), mobile: lead.mobile, email: lead.email, notify: null },
        values: lead.interest ? { service_name: lead.interest } : ({} as Record<string, string>),
        skip: lead.stage === 'converted' ? ('CONVERTED' as const) : lead.stage === 'closed' ? ('LEAD_CLOSED' as const) : undefined,
      }))
    }

    if (trigger === 'no_show') {
      const events = await this.prisma.appointmentEvent.findMany({
        where: { toStatus: 'no_show', createdAt: window, appointment: { orgId, ...branch, status: 'no_show', workflowRuns: { none: { workflowId } } } },
        orderBy: { createdAt: 'asc' }, take: BATCH,
        select: { createdAt: true, appointment: { select: { id: true, startsAt: true, branchId: true, patient: { select: patientContact } } } },
      })
      const rebooked = await this.bookedSince(orgId, events.map((event) => ({ patientId: event.appointment.patient.id, after: event.createdAt, field: 'createdAt' as const, excludeId: event.appointment.id })))
      return events.map((event) => this.appointmentCandidate(event.appointment, due(event.createdAt), rebooked.has(event.appointment.id)))
    }

    const visits = await this.prisma.appointment.findMany({
      where: { orgId, ...branch, status: 'completed', startsAt: window, workflowRuns: { none: { workflowId } } },
      orderBy: { startsAt: 'asc' }, take: BATCH,
      select: { id: true, startsAt: true, branchId: true, patient: { select: patientContact }, branch: { select: { profile: { select: { reviewUrl: true } } } } },
    })
    // Every completed visit is asked the same way: no filtering by how the visit went.
    if (trigger === 'review_request') {
      return visits.map((visit) => {
        const candidate = this.appointmentCandidate(visit, due(visit.startsAt), false)
        const link = visit.branch.profile?.reviewUrl
        return { ...candidate, subjectKey: `review:${visit.id}`, values: { ...candidate.values, ...(link ? { review_link: link } : {}) }, skip: candidate.skip ?? (link ? undefined : 'NO_REVIEW_LINK' as const) }
      })
    }
    const rebooked = await this.bookedSince(orgId, visits.map((visit) => ({ patientId: visit.patient.id, after: visit.startsAt, field: 'startsAt' as const, excludeId: visit.id })))
    return visits.map((visit) => this.appointmentCandidate(visit, due(visit.startsAt), rebooked.has(visit.id)))
  }

  private appointmentCandidate(appointment: { id: string; startsAt: Date; branchId: string; patient: { id: string; fullName: string; alias: string | null; mobile: string; email: string | null; notifyWhatsapp: boolean; notifySms: boolean; status: string } }, dueAt: Date, rebooked: boolean): Candidate {
    const patient = appointment.patient
    const zone = this.env.CLINIC_TIMEZONE
    return {
      subjectKey: `appointment:${appointment.id}`, dueAt, patientId: patient.id, appointmentId: appointment.id,
      contact: { leadId: null, patientId: patient.id, branchId: appointment.branchId, preferredName: patient.alias || firstName(patient.fullName), mobile: patient.mobile, email: patient.email, notify: { whatsapp: patient.notifyWhatsapp, sms: patient.notifySms } },
      values: {
        appointment_date: new Intl.DateTimeFormat('en-IN', { timeZone: zone, day: 'numeric', month: 'short', year: 'numeric' }).format(appointment.startsAt),
        appointment_time: new Intl.DateTimeFormat('en-IN', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(appointment.startsAt),
      },
      skip: patient.status !== 'active' ? 'PATIENT_INACTIVE' : rebooked ? 'ALREADY_BOOKED' : undefined,
    }
  }

  // The appointments (by the triggering appointment's id) whose patient has booked again since.
  private async bookedSince(orgId: string, checks: Array<{ patientId: string; after: Date; field: 'createdAt' | 'startsAt'; excludeId: string }>) {
    const booked = new Set<string>()
    for (const check of checks) {
      const later = await this.prisma.appointment.count({
        where: { orgId, patientId: check.patientId, id: { not: check.excludeId }, status: { notIn: ['cancelled', 'no_show'] }, [check.field]: { gt: check.after } },
      })
      if (later) booked.add(check.excludeId)
    }
    return booked
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private fields(input: WorkflowInput) {
    return {
      name: input.name, trigger: input.trigger, delayHours: input.delayHours, branchId: input.branchId, templateId: input.templateId, variables: input.variables,
      weeklyCap: input.weeklyCap, ownerMembershipId: input.ownerMembershipId,
    }
  }

  private async assertReferences(access: AccessContext, input: WorkflowInput) {
    this.audiences.assertBranchScope(access, input.branchId)
    const [branch, owners, template] = await Promise.all([
      input.branchId ? this.prisma.branch.count({ where: { id: input.branchId, orgId: access.orgId, status: 'active' } }) : Promise.resolve(1),
      growthMembers(this.prisma, access.orgId),
      input.templateId ? this.prisma.messageTemplate.count({ where: { id: input.templateId, orgId: access.orgId } }) : Promise.resolve(1),
    ])
    if (!branch) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch of this organisation.')
    if (!owners.some((owner) => owner.membershipId === input.ownerMembershipId)) throw unprocessable('OWNER_NOT_ELIGIBLE', 'Choose an owner who can run campaigns and messaging.')
    if (!template) throw unprocessable('TEMPLATE_UNKNOWN', 'Choose a message template of this organisation.')
  }

  // Branch-limited roles see workflows at their branches; ones covering every branch are for organisation-wide roles.
  private scopeWhere(access: AccessContext): Prisma.WorkflowWhereInput {
    return { orgId: access.orgId, ...(access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prisma.workflow.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: workflowSelect })
    if (!row) throw notFound('Workflow not found.')
    return row
  }

  private changed() {
    return conflict('WORKFLOW_CHANGED', 'Someone else changed this workflow. Reload it and try again.')
  }
}
