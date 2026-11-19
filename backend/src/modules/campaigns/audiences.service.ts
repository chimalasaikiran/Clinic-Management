import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { ConsentStatus, MessageChannel, Prisma } from '../../generated/prisma/client'
import { AutomatedTemplate, contactAddress, notificationSetting } from '../messaging/automated-send.service'
import { AutomatedSkip, missingVariables, renderTemplate, sendBlock } from '../messaging/messaging.logic'
import { localDate } from '../scheduling/clinic-time'
import { AudienceRules, birthDateWindow, byAddress, describeRules, firstName, Member } from './campaigns.logic'
import type { CreateAudienceInput, ListAudiencesQuery, UpdateAudienceInput } from './campaigns.schemas'

// An audience larger than this is refused rather than half-sent.
const MAX_MEMBERS = 20_000
const WEEK_MS = 7 * 24 * 3_600_000
const DAY_MS = 24 * 3_600_000
const CHANNELS: MessageChannel[] = ['whatsapp', 'sms', 'email']

const audienceSelect = {
  id: true, code: true, name: true, purpose: true, status: true, rules: true, version: true, createdAt: true, updatedAt: true,
  branch: { select: { id: true, name: true } },
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
  campaigns: { select: { id: true, code: true, name: true }, orderBy: { createdAt: 'desc' } },
} as const satisfies Prisma.AudienceSelect

type AudienceRow = Prisma.AudienceGetPayload<{ select: typeof audienceSelect }>

export interface Reach {
  addresses: number
  reachable: number
  optedOut: number
  noConsent: number
  noAddress: number
}

// One address an audience would message, and why it would not.
export interface Recipient {
  member: Member
  address: string
  skip: AutomatedSkip | null
}

@Injectable()
export class AudiencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view(row: AudienceRow) {
    const { createdBy, updatedBy, rules, ...rest } = row
    return { ...rest, rules, description: describeRules(rules as unknown as AudienceRules), createdBy: createdBy.fullName, updatedBy: updatedBy?.fullName ?? createdBy.fullName }
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  async list(access: AccessContext, query: ListAudiencesQuery) {
    const text = query.q?.trim()
    const where: Prisma.AudienceWhereInput = {
      AND: [
        this.scopeWhere(access),
        query.status ? { status: query.status } : { status: { not: 'archived' } },
        text ? { OR: [{ name: { contains: text, mode: 'insensitive' } }, { code: { contains: text, mode: 'insensitive' } }, { purpose: { contains: text, mode: 'insensitive' } }] } : {},
      ],
    }
    const [total, rows] = await Promise.all([
      this.prisma.audience.count({ where }),
      this.prisma.audience.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: audienceSelect }),
    ])
    return { items: rows.map((row) => this.view(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async get(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const versions = await this.prisma.audienceVersion.findMany({ where: { audienceId: id }, orderBy: { version: 'desc' }, select: { version: true, changeNote: true, createdAt: true, actor: { select: { fullName: true } }, rules: true } })
    return { ...this.view(row), versions: versions.map(({ actor, rules, ...entry }) => ({ ...entry, actor: actor.fullName, description: describeRules(rules as unknown as AudienceRules) })) }
  }

  // How many people the rules match now, and how many of them each channel could reach with marketing.
  async count(access: AccessContext, rules: AudienceRules, branchId: string | null) {
    this.assertBranchScope(access, branchId)
    const members = await this.members(access.orgId, rules, branchId)
    const channels = Object.fromEntries(await Promise.all(CHANNELS.map(async (channel) => [channel, await this.reach(access.orgId, members, channel)] as const))) as Record<MessageChannel, Reach>
    return { leads: members.filter((member) => member.kind === 'lead').length, patients: members.filter((member) => member.kind === 'patient').length, channels, description: describeRules(rules) }
  }

  // ─── Changes ──────────────────────────────────────────────────────────────

  async create(access: AccessContext, input: CreateAudienceInput, actorUserId: string, client: ClientInfo) {
    await this.assertBranch(access, input.branchId)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('AU-', await this.counters.next(tx, access.orgId, 'audience'), 4)
      const rules = input.rules as unknown as Prisma.InputJsonObject
      const created = await tx.audience.create({ data: { orgId: access.orgId, code, name: input.name, purpose: input.purpose, branchId: input.branchId, status: input.status, rules, createdById: actorUserId }, select: { id: true } })
      await tx.audienceVersion.create({ data: { audienceId: created.id, version: 1, rules, changeNote: 'Audience created.', actorId: actorUserId } })
      await this.audit.record({ action: 'audience.created', entityType: 'audience', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return this.get(access, id)
  }

  // Every save moves the version on; a change to the rules also adds an entry to the history, with its reason.
  async update(access: AccessContext, id: string, input: UpdateAudienceInput, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    await this.assertBranch(access, input.branchId)
    const rulesChanged = JSON.stringify(normalise(current.rules as unknown as AudienceRules)) !== JSON.stringify(normalise(input.rules))
    if (rulesChanged && !input.changeNote) throw unprocessable('CHANGE_NOTE_REQUIRED', 'Give a reason for changing who this audience includes.')
    await this.prisma.transaction(async (tx) => {
      const rules = input.rules as unknown as Prisma.InputJsonObject
      const { count } = await tx.audience.updateMany({
        where: { id, orgId: access.orgId, version: input.version },
        data: { name: input.name, purpose: input.purpose, branchId: input.branchId, status: input.status, rules, updatedById: actorUserId, version: { increment: 1 } },
      })
      if (count === 0) throw conflict('AUDIENCE_CHANGED', 'Someone else changed this audience. Reload it and try again.')
      if (rulesChanged) await tx.audienceVersion.create({ data: { audienceId: id, version: input.version + 1, rules, changeNote: input.changeNote!, actorId: actorUserId } })
      await this.audit.record({ action: 'audience.updated', entityType: 'audience', entityId: id, orgId: access.orgId, actorUserId, details: { rulesChanged, status: input.status } }, client, tx)
    })
    return this.get(access, id)
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  // The leads and patients the rules match right now, within one branch or all of them.
  async members(orgId: string, rules: AudienceRules, branchId: string | null, now = new Date()): Promise<Member[]> {
    const [leads, patients] = await Promise.all([
      rules.include === 'patients' ? [] : this.leadMembers(orgId, rules, branchId, now),
      rules.include === 'leads' ? [] : this.patientMembers(orgId, rules, branchId, now),
    ])
    if (leads.length + patients.length > MAX_MEMBERS) throw unprocessable('AUDIENCE_TOO_LARGE', `This audience matches more than ${MAX_MEMBERS.toLocaleString('en-IN')} people. Narrow the rules.`)
    return [...patients, ...leads]
  }

  // What a broadcast of this template would do for each address the audience reaches.
  async recipients(orgId: string, members: Member[], template: AutomatedTemplate, variables: Record<string, string>, weeklyCap: number, now = new Date()): Promise<{ recipients: Recipient[]; noAddress: number }> {
    const channel = template.channel
    const { entries, noAddress } = byAddress(members, (member) => contactAddress(channel, member), (member, address) => ({ member, address }))
    const addresses = entries.map((entry) => entry.address)
    const [consents, recent] = await Promise.all([this.latestConsents(orgId, channel, addresses), this.recentAutomated(orgId, addresses, now)])
    const recipients = entries.map(({ member, address }) => {
      const block = sendBlock({ channel, consent: consents.get(address) ?? null, freeText: false, template, patientNotifications: notificationSetting(channel, member.notify), windowOpen: false })
      const missing = missingVariables(template.body, { ...variables, preferred_name: member.preferredName }).length > 0
      const skip: AutomatedSkip | null = block ?? (missing ? 'VARIABLES_MISSING' : (recent.get(address) ?? 0) >= weeklyCap ? 'WEEKLY_CAP' : null)
      return { member, address, skip }
    })
    return { recipients, noAddress }
  }

  sample(template: AutomatedTemplate, variables: Record<string, string>, member: Member | undefined) {
    return renderTemplate(template.body, { ...variables, preferred_name: member?.preferredName ?? 'there' })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async reach(orgId: string, members: Member[], channel: MessageChannel): Promise<Reach> {
    const { entries, noAddress } = byAddress(members, (member) => contactAddress(channel, member), (_member, address) => address)
    const consents = await this.latestConsents(orgId, channel, entries)
    let reachable = 0
    let optedOut = 0
    for (const address of entries) {
      const status = consents.get(address)
      if (status === 'granted') reachable += 1
      else if (status === 'withdrawn') optedOut += 1
    }
    return { addresses: entries.length, reachable, optedOut, noConsent: entries.length - reachable - optedOut, noAddress }
  }

  private leadMembers(orgId: string, rules: AudienceRules, branchId: string | null, now: Date): Promise<Member[]> {
    return this.prisma.lead
      .findMany({
        where: {
          orgId, stage: { in: rules.leadStages }, ...(branchId ? { branchId } : {}),
          ...(rules.leadSources.length ? { source: { in: rules.leadSources } } : {}),
          ...(rules.leadInterest ? { interest: { contains: rules.leadInterest, mode: 'insensitive' as const } } : {}),
          ...(rules.leadCreatedWithinDays ? { createdAt: { gte: new Date(now.getTime() - rules.leadCreatedWithinDays * DAY_MS) } } : {}),
        },
        take: MAX_MEMBERS + 1,
        select: { id: true, fullName: true, mobile: true, email: true, interest: true, branchId: true },
      })
      .then((rows) => rows.map((lead) => ({ kind: 'lead' as const, id: lead.id, branchId: lead.branchId, preferredName: firstName(lead.fullName), mobile: lead.mobile, email: lead.email, interest: lead.interest, notify: null })))
  }

  private patientMembers(orgId: string, rules: AudienceRules, branchId: string | null, now: Date): Promise<Member[]> {
    const today = localDate(now, this.env.CLINIC_TIMEZONE)
    const window = birthDateWindow(today, rules.patientMinAge, rules.patientMaxAge)
    const visits: Prisma.PatientWhereInput[] = []
    if (rules.patientVisitedWithinDays) visits.push({ appointments: { some: { status: 'completed', startsAt: { gte: new Date(now.getTime() - rules.patientVisitedWithinDays * DAY_MS) } } } })
    if (rules.patientNotVisitedForDays) {
      visits.push({ appointments: { some: { status: 'completed' } } })
      visits.push({ appointments: { none: { status: 'completed', startsAt: { gte: new Date(now.getTime() - rules.patientNotVisitedForDays * DAY_MS) } } } })
    }
    return this.prisma.patient
      .findMany({
        where: {
          AND: [
            { orgId, status: 'active', ...(branchId ? { homeBranchId: branchId } : {}) },
            rules.patientGender ? { gender: rules.patientGender } : {},
            window.lte || window.gt ? { dateOfBirth: { ...(window.lte ? { lte: new Date(window.lte) } : {}), ...(window.gt ? { gt: new Date(window.gt) } : {}) } } : {},
            ...visits,
          ],
        },
        take: MAX_MEMBERS + 1,
        select: { id: true, fullName: true, alias: true, mobile: true, email: true, homeBranchId: true, notifyWhatsapp: true, notifySms: true },
      })
      .then((rows) => rows.map((patient) => ({
        kind: 'patient' as const, id: patient.id, branchId: patient.homeBranchId, preferredName: patient.alias || firstName(patient.fullName), mobile: patient.mobile, email: patient.email, interest: null,
        notify: { whatsapp: patient.notifyWhatsapp, sms: patient.notifySms },
      })))
  }

  // The latest consent entry for each address, in one query.
  private async latestConsents(orgId: string, channel: MessageChannel, addresses: string[]) {
    if (!addresses.length) return new Map<string, ConsentStatus>()
    const rows = await this.prisma.$queryRaw<Array<{ address: string; status: ConsentStatus }>>`
      select distinct on (address) address, status::text as status from contact_consents
      where org_id = ${orgId}::uuid and channel = ${channel}::message_channel and address = any(${addresses})
      order by address, created_at desc`
    return new Map(rows.map((row) => [row.address, row.status]))
  }

  // Automated messages each address received in the last 7 days, for the weekly limit.
  private async recentAutomated(orgId: string, addresses: string[], now: Date) {
    if (!addresses.length) return new Map<string, number>()
    const since = new Date(now.getTime() - WEEK_MS)
    const rows = await this.prisma.$queryRaw<Array<{ address: string; n: number }>>`
      select c.address, count(*)::int as n from messages m join conversations c on c.id = m.conversation_id
      where m.org_id = ${orgId}::uuid and m.origin in ('broadcast', 'workflow') and m.created_at > ${since} and c.address = any(${addresses})
      group by c.address`
    return new Map(rows.map((row) => [row.address, row.n]))
  }

  // Branch-limited roles work with audiences at their branches; ones covering every branch are for organisation-wide roles.
  scopeWhere(access: AccessContext): Prisma.AudienceWhereInput {
    return { orgId: access.orgId, ...(access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  async find(access: AccessContext, id: string) {
    const row = await this.prisma.audience.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: audienceSelect })
    if (!row) throw notFound('Audience not found.')
    return row
  }

  assertBranchScope(access: AccessContext, branchId: string | null) {
    if (access.branchScope === 'all') return
    if (!branchId) throw forbidden('BRANCH_OUT_OF_SCOPE', 'Only organisation-wide roles can work with every branch at once. Choose your branch.')
    if (!access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
  }

  private async assertBranch(access: AccessContext, branchId: string | null) {
    this.assertBranchScope(access, branchId)
    if (branchId && !(await this.prisma.branch.count({ where: { id: branchId, orgId: access.orgId, status: 'active' } }))) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch of this organisation.')
  }
}

// Rules in a fixed key order with defaults, so a saved copy and a resubmitted copy compare equal.
function normalise(rules: AudienceRules) {
  return {
    include: rules.include, leadStages: [...(rules.leadStages ?? [])].sort(), leadSources: [...(rules.leadSources ?? [])].sort(), leadInterest: rules.leadInterest ?? null,
    leadCreatedWithinDays: rules.leadCreatedWithinDays ?? null, patientVisitedWithinDays: rules.patientVisitedWithinDays ?? null, patientNotVisitedForDays: rules.patientNotVisitedForDays ?? null,
    patientMinAge: rules.patientMinAge ?? null, patientMaxAge: rules.patientMaxAge ?? null, patientGender: rules.patientGender ?? null,
  }
}
