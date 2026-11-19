import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { describeChanges, funnel } from '../leads/leads.logic'
import { AutomatedSendService, AutomatedTemplate } from '../messaging/automated-send.service'
import { ChannelsService } from '../messaging/channels.service'
import { AutomatedSkip, inQuietHours, SKIP_LABELS, templateVariables } from '../messaging/messaging.logic'
import { RealtimeService } from '../messaging/realtime.service'
import { localDate, localMinute } from '../scheduling/clinic-time'
import { AudiencesService } from './audiences.service'
import { AudienceRules, attributedRevenue, isUniqueViolation, BROADCAST_CHANNELS, CAMPAIGN_CHANNEL_LABELS, CAMPAIGN_STATUS_LABELS, describeRules, unfilledVariables } from './campaigns.logic'
import type { BroadcastPreviewInput, CampaignInput, LaunchBroadcastInput, ListCampaignsQuery, SpendInput, UpdateCampaignInput } from './campaigns.schemas'
import { growthMembers } from './growth-members'

const campaignSelect = {
  id: true, code: true, name: true, objective: true, channel: true, status: true, budget: true, startDate: true, endDate: true, cta: true, landingUrl: true, version: true, createdAt: true, updatedAt: true,
  branch: { select: { id: true, name: true } },
  owner: { select: { id: true, user: { select: { fullName: true } } } },
  audience: { select: { id: true, code: true, name: true, status: true } },
  _count: { select: { leads: true } },
} as const satisfies Prisma.CampaignSelect

type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>

const templateSelect = { id: true, code: true, name: true, category: true, channel: true, subject: true, body: true, status: true, providerRef: true, version: true } as const

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const asDate = (day: string) => new Date(`${day}T00:00:00Z`)
// A broadcast left "sending" this long belonged to a worker that stopped; another picks it up where it left off.
const STALE_CLAIM_MS = 10 * 60_000
// How often a running broadcast checks whether it was cancelled, and renews its claim.
const CHECK_EVERY = 25

@Injectable()
export class CampaignsService {
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

  view(row: CampaignRow, spent: number) {
    const { owner, _count, budget, startDate, endDate, ...rest } = row
    return { ...rest, budget: Number(budget), startDate: isoDay(startDate), endDate: isoDay(endDate), owner: { membershipId: owner.id, name: owner.user.fullName }, leadCount: _count.leads, spent }
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  async list(access: AccessContext, query: ListCampaignsQuery) {
    const text = query.q?.trim()
    const where: Prisma.CampaignWhereInput = {
      AND: [
        this.scopeWhere(access, query.branchId),
        text ? { OR: [{ name: { contains: text, mode: 'insensitive' } }, { code: { contains: text, mode: 'insensitive' } }, { objective: { contains: text, mode: 'insensitive' } }] } : {},
        query.status ? { status: query.status } : {},
        query.channel ? { channel: query.channel } : {},
        query.ownerId ? { ownerMembershipId: query.ownerId } : {},
      ],
    }
    const [total, rows] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({ where, orderBy: [{ startDate: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: campaignSelect }),
    ])
    const spend = await this.spendByCampaign(rows.map((row) => row.id))
    const attributed = await this.convertedByCampaign(rows.map((row) => row.id))
    return { items: rows.map((row) => ({ ...this.view(row, spend.get(row.id) ?? 0), converted: attributed.get(row.id) ?? 0 })), page: query.page, pageSize: query.pageSize, total }
  }

  // Campaigns a lead can be recorded against: every one in the organisation that is not finished.
  async options(access: AccessContext) {
    return this.prisma.campaign.findMany({
      where: { orgId: access.orgId, status: { not: 'completed' } },
      orderBy: { startDate: 'desc' },
      take: 200,
      select: { id: true, code: true, name: true, status: true, channel: true },
    })
  }

  async get(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const [spendEntries, events, broadcasts, attribution] = await Promise.all([
      this.prisma.campaignSpend.findMany({ where: { campaignId: id }, orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }], select: { id: true, spentOn: true, amount: true, note: true, createdAt: true, recordedBy: { select: { fullName: true } } } }),
      this.prisma.campaignEvent.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, kind: true, text: true, createdAt: true, actor: { select: { fullName: true } } } }),
      this.broadcasts(id),
      this.attribution(access, id),
    ])
    const spent = spendEntries.reduce((sum, entry) => sum + Number(entry.amount), 0)
    return {
      ...this.view(row, Math.round(spent * 100) / 100),
      spendEntries: spendEntries.map(({ recordedBy, amount, spentOn, ...entry }) => ({ ...entry, amount: Number(amount), spentOn: isoDay(spentOn), recordedBy: recordedBy.fullName })),
      events: events.map(({ actor, ...event }) => ({ ...event, actor: actor?.fullName ?? null })),
      broadcasts,
      attribution,
    }
  }

  // Leads recorded against the campaign and how far they got. Revenue needs the revenue permission.
  async attribution(access: AccessContext, campaignId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { orgId: access.orgId, campaignId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, fullName: true, stage: true, source: true, createdAt: true, patientId: true, convertedAt: true },
    })
    const patientIds = [...new Set(leads.flatMap((lead) => (lead.patientId ? [lead.patientId] : [])))]
    const earliest = leads.reduce<Date | null>((min, lead) => (lead.convertedAt && (!min || lead.convertedAt < min) ? lead.convertedAt : min), null)
    const [appointments, invoices] = patientIds.length && earliest
      ? await Promise.all([
        this.prisma.appointment.findMany({ where: { orgId: access.orgId, patientId: { in: patientIds }, startsAt: { gte: earliest } }, select: { patientId: true, startsAt: true, status: true } }),
        access.permissions.has('accounting.revenue')
          ? this.prisma.invoice.findMany({ where: { orgId: access.orgId, patientId: { in: patientIds }, invoiceDate: { gte: asDate(localDate(earliest, this.env.CLINIC_TIMEZONE)) } }, select: { patientId: true, invoiceDate: true, total: true } })
          : Promise.resolve(null),
      ])
      : [[], access.permissions.has('accounting.revenue') ? [] : null]
    const zone = this.env.CLINIC_TIMEZONE
    const stages = funnel(leads, appointments)
    const revenue = invoices === null
      ? null
      : attributedRevenue(leads.map((lead) => ({ ...lead, convertedOn: lead.convertedAt ? localDate(lead.convertedAt, zone) : null })), invoices.map((invoice) => ({ patientId: invoice.patientId, invoiceDate: isoDay(invoice.invoiceDate), total: Number(invoice.total) })))
    return {
      leads: leads.length,
      ...stages,
      revenue,
      recent: leads.slice(0, 50).map(({ patientId: _patientId, convertedAt, ...lead }) => ({ ...lead, convertedAt })),
    }
  }

  async owners(access: AccessContext) {
    return growthMembers(this.prisma, access.orgId)
  }

  // ─── Changes ──────────────────────────────────────────────────────────────

  async create(access: AccessContext, input: CampaignInput, actorUserId: string, client: ClientInfo) {
    await this.assertReferences(access, input)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('CMP-', await this.counters.next(tx, access.orgId, 'campaign'), 4)
      const created = await tx.campaign.create({ data: { orgId: access.orgId, code, ...this.fields(input), createdById: actorUserId }, select: { id: true } })
      await this.event(tx, created.id, 'created', `Campaign created as ${CAMPAIGN_STATUS_LABELS[input.status]} with a budget of ₹${input.budget.toLocaleString('en-IN')}.`, actorUserId)
      await this.audit.record({ action: 'campaign.created', entityType: 'campaign', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return this.get(access, id)
  }

  async update(access: AccessContext, id: string, input: UpdateCampaignInput, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    await this.assertReferences(access, input)
    const [branch, owner, audience] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { id: input.branchId }, select: { name: true } }),
      this.prisma.membership.findUniqueOrThrow({ where: { id: input.ownerMembershipId }, select: { user: { select: { fullName: true } } } }),
      input.audienceId ? this.prisma.audience.findUniqueOrThrow({ where: { id: input.audienceId }, select: { name: true } }) : Promise.resolve(null),
    ])
    const money = (value: number) => `₹${value.toLocaleString('en-IN')}`
    const before = {
      name: current.name, objective: current.objective, channel: CAMPAIGN_CHANNEL_LABELS[current.channel], status: CAMPAIGN_STATUS_LABELS[current.status], branch: current.branch.name, owner: current.owner.user.fullName,
      audience: current.audience?.name ?? null, budget: money(Number(current.budget)), dates: `${isoDay(current.startDate)} – ${isoDay(current.endDate)}`, cta: current.cta, landingUrl: current.landingUrl,
    }
    const after = {
      name: input.name, objective: input.objective, channel: CAMPAIGN_CHANNEL_LABELS[input.channel], status: CAMPAIGN_STATUS_LABELS[input.status], branch: branch.name, owner: owner.user.fullName,
      audience: audience?.name ?? null, budget: money(input.budget), dates: `${input.startDate} – ${input.endDate}`, cta: input.cta, landingUrl: input.landingUrl,
    }
    const labels = { name: 'Name', objective: 'Objective', channel: 'Channel', status: 'Status', branch: 'Branch', owner: 'Owner', audience: 'Audience', budget: 'Budget', dates: 'Dates', cta: 'Call to action', landingUrl: 'Landing page' }
    const { changed, text } = describeChanges(before, after, labels)
    if ((changed.includes('budget') || changed.includes('status')) && !input.changeNote) throw unprocessable('CHANGE_NOTE_REQUIRED', 'Give a reason for changing the budget or status.')

    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.campaign.updateMany({ where: { id, orgId: access.orgId, version: input.version }, data: { ...this.fields(input), version: { increment: 1 } } })
      if (count === 0) throw conflict('CAMPAIGN_CHANGED', 'Someone else changed this campaign. Reload it and try again.')
      if (changed.length) await this.event(tx, id, 'updated', `${text}.${input.changeNote ? ` Reason: ${input.changeNote}` : ''}`, actorUserId, { changed })
      await this.audit.record({ action: 'campaign.updated', entityType: 'campaign', entityId: id, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
    })
    return this.get(access, id)
  }

  async addSpend(access: AccessContext, id: string, input: SpendInput, actorUserId: string, client: ClientInfo) {
    await this.find(access, id)
    await this.prisma.transaction(async (tx) => {
      await tx.campaignSpend.create({ data: { campaignId: id, spentOn: asDate(input.spentOn), amount: input.amount, note: input.note, recordedById: actorUserId } })
      await this.event(tx, id, 'spend', `${input.amount < 0 ? 'Spend corrected' : 'Spend recorded'}: ₹${input.amount.toLocaleString('en-IN')} on ${input.spentOn}. ${input.note}`, actorUserId)
      await this.audit.record({ action: 'campaign.spend_recorded', entityType: 'campaign', entityId: id, orgId: access.orgId, actorUserId, details: { amount: input.amount } }, client, tx)
    })
    return this.get(access, id)
  }

  // ─── Broadcasts ───────────────────────────────────────────────────────────

  // Who a broadcast of this template would reach now, who it would skip and why, and the message they would get.
  async previewBroadcast(access: AccessContext, id: string, input: BroadcastPreviewInput, weeklyCap = 2) {
    const { campaign, audience, template } = await this.broadcastParts(access, id, input.templateId)
    const variables = await this.fixedVariables(access.orgId, input.variables)
    const members = await this.audiences.members(access.orgId, audience.rules as unknown as AudienceRules, audience.branchId)
    const { recipients, noAddress } = await this.audiences.recipients(access.orgId, members, template, variables, weeklyCap)
    const skipped: Partial<Record<AutomatedSkip, number>> = {}
    for (const entry of recipients) if (entry.skip) skipped[entry.skip] = (skipped[entry.skip] ?? 0) + 1
    const reachable = recipients.filter((entry) => !entry.skip)
    return {
      campaign: { id: campaign.id, code: campaign.code, name: campaign.name },
      audience: { id: audience.id, code: audience.code, name: audience.name, version: audience.version, description: describeRules(audience.rules as unknown as AudienceRules) },
      template: { id: template.id, code: template.code, name: template.name, version: template.version, channel: template.channel },
      members: members.length,
      addresses: recipients.length,
      noAddress,
      reachable: reachable.length,
      skipped: Object.entries(skipped).map(([reason, count]) => ({ reason, label: SKIP_LABELS[reason as AutomatedSkip], count })),
      missingVariables: unfilledVariables(templateVariables(template.body), input.variables),
      sample: this.audiences.sample(template, variables, reachable[0]?.member),
      channelConnected: await this.channels.connected(access.orgId, template.channel),
      quietHoursNow: inQuietHours(localMinute(new Date(), this.env.CLINIC_TIMEZONE)),
    }
  }

  async launchBroadcast(access: AccessContext, id: string, input: LaunchBroadcastInput, actorUserId: string, client: ClientInfo) {
    const preview = await this.previewBroadcast(access, id, input, input.weeklyCap)
    const campaign = await this.find(access, id)
    if (campaign.status !== 'scheduled' && campaign.status !== 'active') throw unprocessable('CAMPAIGN_NOT_RUNNING', 'Set the campaign to Scheduled or Active before sending a broadcast.')
    if (!preview.channelConnected) throw unprocessable('CHANNEL_NOT_CONNECTED', 'This channel is not connected. An administrator can connect it on the Channels screen.')
    if (preview.missingVariables.length) throw unprocessable('TEMPLATE_VARIABLES_MISSING', `Fill in ${preview.missingVariables.map((name) => `{{${name}}}`).join(', ')} before sending.`)
    if (preview.reachable !== input.expectedRecipients) throw conflict('AUDIENCE_CHANGED', `The audience now reaches ${preview.reachable}, not ${input.expectedRecipients}. Check the new numbers and confirm again.`)
    const now = new Date()
    if (input.sendAt && input.sendAt.getTime() < now.getTime() - 60_000) throw unprocessable('SEND_TIME_PAST', 'Choose a send time in the future, or send now.')
    const scheduledAt = input.sendAt ?? now

    const broadcastId = await this.prisma.transaction(async (tx) => {
      const created = await tx.campaignBroadcast.create({
        data: {
          orgId: access.orgId, campaignId: id, audienceId: preview.audience.id, audienceVersion: preview.audience.version, templateId: preview.template.id, templateVersion: preview.template.version,
          channel: preview.template.channel, variables: input.variables, scheduledAt, weeklyCap: input.weeklyCap, expectedRecipients: input.expectedRecipients, createdById: actorUserId,
        },
        select: { id: true },
      })
      await this.event(tx, id, 'broadcast_scheduled', `Broadcast of ${preview.template.code} “${preview.template.name}” to ${preview.audience.code} confirmed for ${input.expectedRecipients} people${input.sendAt ? `, from ${scheduledAt.toISOString()}` : ''}.`, actorUserId, { broadcastId: created.id })
      await this.audit.record({ action: 'campaign.broadcast_scheduled', entityType: 'campaign_broadcast', entityId: created.id, orgId: access.orgId, actorUserId, details: { campaignId: id, recipients: input.expectedRecipients } }, client, tx)
      return created.id
    })
    return (await this.broadcasts(id)).find((entry) => entry.id === broadcastId)!
  }

  async cancelBroadcast(access: AccessContext, id: string, broadcastId: string, actorUserId: string, client: ClientInfo) {
    await this.find(access, id)
    const { count } = await this.prisma.campaignBroadcast.updateMany({ where: { id: broadcastId, campaignId: id, status: { in: ['scheduled', 'sending'] } }, data: { status: 'cancelled', cancelledById: actorUserId, completedAt: new Date() } })
    if (count === 0) throw conflict('BROADCAST_FINISHED', 'This broadcast has already finished or been cancelled.')
    await this.prisma.transaction(async (tx) => {
      await this.event(tx, id, 'broadcast_cancelled', 'Broadcast cancelled. Messages already queued are still sent.', actorUserId, { broadcastId })
      await this.audit.record({ action: 'campaign.broadcast_cancelled', entityType: 'campaign_broadcast', entityId: broadcastId, orgId: access.orgId, actorUserId }, client, tx)
    })
    return (await this.broadcasts(id)).find((entry) => entry.id === broadcastId)!
  }

  // A campaign's broadcasts with what happened to their messages.
  private async broadcasts(campaignId: string) {
    const rows = await this.prisma.campaignBroadcast.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, channel: true, status: true, scheduledAt: true, startedAt: true, completedAt: true, expectedRecipients: true, queuedCount: true, skippedCount: true, weeklyCap: true, createdAt: true, templateVersion: true, audienceVersion: true,
        template: { select: { id: true, code: true, name: true } }, audience: { select: { id: true, code: true, name: true } }, createdBy: { select: { fullName: true } },
      },
    })
    if (!rows.length) return []
    const ids = rows.map((row) => row.id)
    const [statuses, skips] = await Promise.all([
      this.prisma.$queryRaw<Array<{ broadcastId: string; status: string; n: number }>>`
        select r.broadcast_id as "broadcastId", m.status::text as status, count(*)::int as n
        from broadcast_recipients r join messages m on m.id = r.message_id where r.broadcast_id = any(${ids}::uuid[]) group by 1, 2`,
      this.prisma.$queryRaw<Array<{ broadcastId: string; reason: string; n: number }>>`
        select broadcast_id as "broadcastId", skip_reason as reason, count(*)::int as n
        from broadcast_recipients where broadcast_id = any(${ids}::uuid[]) and skip_reason is not null group by 1, 2`,
    ])
    return rows.map(({ createdBy, ...row }) => ({
      ...row,
      createdBy: createdBy.fullName,
      messages: Object.fromEntries(statuses.filter((entry) => entry.broadcastId === row.id).map((entry) => [entry.status, entry.n])),
      skipped: skips.filter((entry) => entry.broadcastId === row.id).map((entry) => ({ reason: entry.reason, label: SKIP_LABELS[entry.reason as AutomatedSkip] ?? entry.reason, count: entry.n })),
    }))
  }

  // Claims the next broadcast that is due (or was abandoned by a stopped worker). Returns its id, or null.
  async claimBroadcast(): Promise<string | null> {
    const stale = new Date(Date.now() - STALE_CLAIM_MS)
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      update campaign_broadcasts set status = 'sending', claimed_at = now(), started_at = coalesce(started_at, now())
      where id = (
        select b.id from campaign_broadcasts b join campaigns c on c.id = b.campaign_id
        where c.status in ('scheduled', 'active')
          and ((b.status = 'scheduled' and b.scheduled_at <= now()) or (b.status = 'sending' and b.claimed_at < ${stale}))
        order by b.scheduled_at limit 1 for update of b skip locked
      )
      returning id`
    return rows[0]?.id ?? null
  }

  // Works through a claimed broadcast: every address in the audience now gets the message or a recorded reason it
  // did not. Safe to run again after an interruption, because each address is recorded once.
  async processBroadcast(broadcastId: string, isQuiet: () => boolean) {
    const broadcast = await this.prisma.campaignBroadcast.findUniqueOrThrow({
      where: { id: broadcastId },
      select: {
        id: true, orgId: true, campaignId: true, status: true, audienceVersion: true, templateVersion: true, variables: true, weeklyCap: true, createdById: true,
        audience: { select: { id: true, status: true, branchId: true, rules: true } },
        template: { select: templateSelect },
      },
    })
    if (broadcast.status !== 'sending') return
    const stop = (text: string) => this.finish(broadcast.id, broadcast.campaignId, 'cancelled', text)
    const rulesChanged = await this.prisma.audienceVersion.count({ where: { audienceId: broadcast.audience.id, version: { gt: broadcast.audienceVersion } } })
    if (rulesChanged || broadcast.audience.status !== 'ready') return stop('Broadcast stopped: the audience changed after it was confirmed. Confirm a new broadcast to send to the current audience.')
    const template = broadcast.template
    if (template.version !== broadcast.templateVersion || template.status !== 'approved') return stop('Broadcast stopped: the template changed or is no longer approved since the broadcast was confirmed.')
    if (!(await this.channels.connected(broadcast.orgId, template.channel))) return stop('Broadcast stopped: the channel was disconnected.')

    const variables = await this.fixedVariables(broadcast.orgId, broadcast.variables as Record<string, string>)
    const members = await this.audiences.members(broadcast.orgId, broadcast.audience.rules as unknown as AudienceRules, broadcast.audience.branchId)
    // Patients come first, so someone who is both a converted lead and a patient is reached as the patient.
    const done = new Set((await this.prisma.broadcastRecipient.findMany({ where: { broadcastId }, select: { leadId: true, patientId: true } })).map((entry) => entry.patientId ?? entry.leadId))

    let processed = 0
    for (const member of members) {
      if (done.has(member.id)) continue
      if (processed % CHECK_EVERY === 0 && processed > 0) {
        const current = await this.prisma.campaignBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, select: { status: true } })
        if (current.status !== 'sending') return
        if (isQuiet()) {
          // Picked up again at 9 am, where it left off.
          await this.prisma.campaignBroadcast.update({ where: { id: broadcastId }, data: { status: 'scheduled', claimedAt: null } })
          return
        }
        await this.prisma.campaignBroadcast.update({ where: { id: broadcastId }, data: { claimedAt: new Date() } })
      }
      processed += 1
      await this.sendOne(broadcast, template, member, variables)
    }

    const [queued, skipped] = await Promise.all([
      this.prisma.broadcastRecipient.count({ where: { broadcastId, messageId: { not: null } } }),
      this.prisma.broadcastRecipient.count({ where: { broadcastId, skipReason: { not: null } } }),
    ])
    await this.prisma.campaignBroadcast.update({ where: { id: broadcastId }, data: { queuedCount: queued, skippedCount: skipped } })
    await this.finish(broadcastId, broadcast.campaignId, 'completed', `Broadcast finished: ${queued} queued, ${skipped} skipped.`)
  }

  private async sendOne(broadcast: { id: string; orgId: string; weeklyCap: number; createdById: string }, template: AutomatedTemplate, member: { kind: string; id: string; branchId: string | null; preferredName: string; mobile: string | null; email: string | null; notify: { whatsapp: boolean; sms: boolean } | null }, variables: Record<string, string>) {
    const contact = { leadId: member.kind === 'lead' ? member.id : null, patientId: member.kind === 'patient' ? member.id : null, branchId: member.branchId, preferredName: member.preferredName, mobile: member.mobile, email: member.email, notify: member.notify }
    try {
      const result = await this.prisma.transaction(async (tx) => {
        const sent = await this.automated.queue(tx, { orgId: broadcast.orgId, template, contact, variables, origin: 'broadcast', weeklyCap: broadcast.weeklyCap, actorUserId: broadcast.createdById })
        // A second member with the same address (a lead who is also a patient) is recorded once.
        const address = sent.address ?? `none:${member.id}`
        if (await tx.broadcastRecipient.count({ where: { broadcastId: broadcast.id, address } })) throw new AlreadyRecorded()
        await tx.broadcastRecipient.create({
          data: { broadcastId: broadcast.id, address, leadId: contact.leadId, patientId: contact.patientId, ...(sent.queued ? { messageId: sent.messageId } : { skipReason: sent.reason }) },
        })
        return sent
      })
      if (result.queued) await this.realtime.publish({ orgId: broadcast.orgId, branchId: result.branchId, type: 'message', conversationId: result.conversationId, messageId: result.messageId })
    } catch (error) {
      if (error instanceof AlreadyRecorded || isUniqueViolation(error)) return
      throw error
    }
  }

  private async finish(broadcastId: string, campaignId: string, status: 'completed' | 'cancelled', text: string) {
    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.campaignBroadcast.updateMany({ where: { id: broadcastId, status: 'sending' }, data: { status, completedAt: new Date(), claimedAt: null } })
      if (count) await this.event(tx, campaignId, status === 'completed' ? 'broadcast_completed' : 'broadcast_cancelled', text, null, { broadcastId })
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async broadcastParts(access: AccessContext, id: string, templateId: string) {
    const campaign = await this.find(access, id)
    if (!BROADCAST_CHANNELS.includes(campaign.channel)) throw unprocessable('CHANNEL_NOT_MESSAGING', 'Only WhatsApp, SMS and email campaigns can send broadcasts.')
    if (!campaign.audience) throw unprocessable('AUDIENCE_REQUIRED', 'Choose an audience for this campaign first.')
    const audience = await this.audiences.find(access, campaign.audience.id)
    if (audience.status !== 'ready') throw unprocessable('AUDIENCE_NOT_READY', 'Mark the audience Ready before sending to it.')
    this.audiences.assertBranchScope(access, audience.branch?.id ?? null)
    const template = await this.prisma.messageTemplate.findFirst({ where: { id: templateId, orgId: access.orgId }, select: templateSelect })
    if (!template) throw notFound('Template not found.')
    if (template.channel !== campaign.channel) throw unprocessable('TEMPLATE_CHANNEL', `This template is for ${template.channel}, but the campaign uses ${campaign.channel}.`)
    if (template.status !== 'approved' || (template.channel !== 'email' && !template.providerRef)) throw unprocessable('TEMPLATE_NOT_APPROVED', 'This template is not approved for sending, or has no provider template reference.')
    return { campaign, audience: { ...audience, branchId: audience.branch?.id ?? null }, template }
  }

  private async fixedVariables(orgId: string, values: Record<string, string>) {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: orgId }, select: { displayName: true } })
    return { ...Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim())), clinic_name: organisation.displayName }
  }

  private fields(input: CampaignInput) {
    return {
      name: input.name, objective: input.objective, channel: input.channel, status: input.status, branchId: input.branchId, ownerMembershipId: input.ownerMembershipId, audienceId: input.audienceId,
      budget: input.budget, startDate: asDate(input.startDate), endDate: asDate(input.endDate), cta: input.cta, landingUrl: input.landingUrl,
    }
  }

  private async assertReferences(access: AccessContext, input: CampaignInput) {
    this.audiences.assertBranchScope(access, input.branchId)
    const [branch, owners, audience] = await Promise.all([
      this.prisma.branch.count({ where: { id: input.branchId, orgId: access.orgId, status: 'active' } }),
      growthMembers(this.prisma, access.orgId),
      input.audienceId ? this.prisma.audience.findFirst({ where: { AND: [this.audiences.scopeWhere(access), { id: input.audienceId }] }, select: { status: true } }) : Promise.resolve(undefined),
    ])
    if (!branch) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch of this organisation.')
    if (!owners.some((owner) => owner.membershipId === input.ownerMembershipId)) throw unprocessable('OWNER_NOT_ELIGIBLE', 'Choose an owner who can run campaigns.')
    if (input.audienceId && (!audience || audience.status === 'archived')) throw unprocessable('AUDIENCE_UNKNOWN', 'Choose an audience that is not archived.')
  }

  private async spendByCampaign(ids: string[]) {
    if (!ids.length) return new Map<string, number>()
    const rows = await this.prisma.campaignSpend.groupBy({ by: ['campaignId'], where: { campaignId: { in: ids } }, _sum: { amount: true } })
    return new Map(rows.map((row) => [row.campaignId, Number(row._sum.amount ?? 0)]))
  }

  private async convertedByCampaign(ids: string[]) {
    if (!ids.length) return new Map<string, number>()
    const rows = await this.prisma.lead.groupBy({ by: ['campaignId'], where: { campaignId: { in: ids }, stage: 'converted' }, _count: { _all: true } })
    return new Map(rows.map((row) => [row.campaignId!, row._count._all]))
  }

  // Branch-limited roles see campaigns at their branches.
  private scopeWhere(access: AccessContext, branchId?: string): Prisma.CampaignWhereInput {
    if (branchId) this.audiences.assertBranchScope(access, branchId)
    return { orgId: access.orgId, ...(branchId ? { branchId } : access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prisma.campaign.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: campaignSelect })
    if (!row) throw notFound('Campaign not found.')
    return row
  }

  private event(tx: Tx, campaignId: string, kind: string, text: string, actorId: string | null, details?: Prisma.InputJsonObject) {
    return tx.campaignEvent.create({ data: { campaignId, kind, text: text.slice(0, 1000), details, actorId } })
  }
}

class AlreadyRecorded extends Error {}

