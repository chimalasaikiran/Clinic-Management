import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { MessageChannel, Prisma } from '../../generated/prisma/client'
import { CareScopeService } from '../scheduling/care-scope.service'
import { ChannelsService } from './channels.service'
import { ConsentService } from './consent.service'
import { BLOCK_MESSAGES, missingVariables, normaliseAddress, preview, renderTemplate, sendBlock, templateVariables, whatsappWindowOpen } from './messaging.logic'
import type { ListConversationsQuery, ListMessagesQuery, SendMessageInput, UpdateConversationInput } from './messaging.schemas'
import { RealtimeService } from './realtime.service'

const conversationSelect = {
  id: true, number: true, channel: true, address: true, status: true, unread: true, lastMessageAt: true, lastInboundAt: true, preview: true, version: true, createdAt: true,
  branch: { select: { id: true, name: true } },
  lead: { select: { id: true, number: true, fullName: true } },
  patient: { select: { id: true, mrn: true, fullName: true, alias: true, notifyWhatsapp: true, notifySms: true } },
  owner: { select: { id: true, user: { select: { fullName: true } } } },
} as const satisfies Prisma.ConversationSelect

type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>

const messageSelect = {
  id: true, conversationId: true, direction: true, status: true, body: true, subject: true, templateVersion: true, errorCode: true, errorMessage: true, attempts: true,
  nextAttemptAt: true, sentAt: true, deliveredAt: true, readAt: true, failedAt: true, createdAt: true,
  template: { select: { id: true, code: true, name: true } },
  sentBy: { select: { fullName: true } },
} as const satisfies Prisma.MessageSelect

type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly channels: ChannelsService,
    private readonly consent: ConsentService,
    private readonly careScope: CareScopeService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  // Names and MRNs of linked patients are shown only to people who may see patients.
  view(row: ConversationRow, access: AccessContext, now = new Date()) {
    const { owner, patient, ...rest } = row
    return {
      ...rest,
      patient: patient && access.permissions.has('patients.view') ? { id: patient.id, mrn: patient.mrn, fullName: patient.fullName } : patient ? { id: patient.id, mrn: null, fullName: null } : null,
      owner: owner ? { membershipId: owner.id, name: owner.user.fullName } : null,
      replyWindowOpen: row.channel === 'whatsapp' && whatsappWindowOpen(row.lastInboundAt, now),
    }
  }

  messageView({ sentBy, ...row }: MessageRow) {
    return { ...row, sentBy: sentBy?.fullName ?? null }
  }

  // ─── Inbox ────────────────────────────────────────────────────────────────

  async list(access: AccessContext, query: ListConversationsQuery) {
    const scope = this.scopeWhere(access, query.branchId)
    const filters: Prisma.ConversationWhereInput[] = [scope]
    const text = query.q?.trim()
    if (text) {
      const digits = text.replace(/\D/g, '')
      filters.push({
        OR: [
          { number: { contains: text, mode: 'insensitive' } },
          { preview: { contains: text, mode: 'insensitive' } },
          { lead: { fullName: { contains: text, mode: 'insensitive' } } },
          ...(access.permissions.has('patients.view') ? [{ patient: { fullName: { contains: text, mode: 'insensitive' as const } } }] : []),
          ...(digits.length >= 4 ? [{ address: { contains: digits } }] : []),
        ],
      })
    }
    if (query.channel) filters.push({ channel: query.channel })
    if (query.status) filters.push({ status: query.status })
    if (query.ownerId) filters.push({ ownerMembershipId: query.ownerId })
    if (query.unread) filters.push({ unread: query.unread === 'true' })
    if (query.linked) filters.push(query.linked === 'true' ? { OR: [{ leadId: { not: null } }, { patientId: { not: null } }] } : { leadId: null, patientId: null })

    const where = { AND: filters }
    const [total, rows, unread, connected] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({ where, orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: conversationSelect }),
      this.prisma.conversation.count({ where: { AND: [scope, { unread: true }] } }),
      this.prisma.messagingChannel.findMany({ where: { orgId: access.orgId }, select: { channel: true, status: true } }),
    ])
    const now = new Date()
    return {
      items: rows.map((row) => this.view(row, access, now)),
      page: query.page, pageSize: query.pageSize, total, unread,
      channels: Object.fromEntries((['whatsapp', 'sms', 'email'] as const).map((channel) => [channel, connected.find((entry) => entry.channel === channel)?.status ?? 'not_connected'])),
    }
  }

  async get(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const [messages, notes, consent, connected] = await Promise.all([
      this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' }, select: messageSelect }),
      this.prisma.conversationNote.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, text: true, createdAt: true, author: { select: { fullName: true } } } }),
      this.consent.current(access.orgId, row.channel, row.address),
      this.channels.connected(access.orgId, row.channel),
    ])
    return {
      ...this.view(row, access),
      messages: messages.map((message) => this.messageView(message)),
      notes: notes.map(({ author, ...note }) => ({ ...note, author: author.fullName })),
      consent,
      channelConnected: connected,
    }
  }

  // Opens (or reuses) the conversation with a lead's or patient's mobile number or email on one channel.
  async start(access: AccessContext, input: { channel: MessageChannel; leadId?: string; patientId?: string }, actorUserId: string, client: ClientInfo) {
    const contact = input.leadId ? await this.leadContact(access, input.leadId) : await this.patientContact(access, input.patientId!)
    const raw = input.channel === 'email' ? contact.email : contact.mobile
    const address = raw ? normaliseAddress(input.channel, raw) : null
    if (!address) throw unprocessable('ADDRESS_MISSING', input.channel === 'email' ? 'This contact has no email address on record.' : 'This contact has no valid mobile number on record.')
    const link = input.leadId ? { leadId: input.leadId } : { patientId: input.patientId }

    const id = await this.prisma.transaction(async (tx) => {
      const existing = await tx.conversation.findUnique({ where: { orgId_channel_address: { orgId: access.orgId, channel: input.channel, address } }, select: { id: true, leadId: true, patientId: true } })
      if (existing) {
        // An unlinked conversation with this address is linked now; an existing link is never replaced silently.
        if (!existing.leadId && !existing.patientId) await tx.conversation.update({ where: { id: existing.id }, data: { ...link, branchId: contact.branchId, version: { increment: 1 } } })
        return existing.id
      }
      const number = formatNumber('CV-', await this.counters.next(tx, access.orgId, 'conversation'))
      const created = await tx.conversation.create({ data: { orgId: access.orgId, number, channel: input.channel, address, branchId: contact.branchId, ...link }, select: { id: true } })
      await this.audit.record({ action: 'messaging.conversation_started', entityType: 'conversation', entityId: created.id, orgId: access.orgId, actorUserId, details: { channel: input.channel } }, client, tx)
      return created.id
    })
    return this.get(access, id)
  }

  async update(access: AccessContext, id: string, input: UpdateConversationInput, actorUserId: string, client: ClientInfo) {
    const row = await this.find(access, id)
    if (input.ownerMembershipId) await this.assertMember(access.orgId, input.ownerMembershipId)
    const { version, ...fields } = input
    const { count } = await this.prisma.conversation.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...fields, version: { increment: 1 } } })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'messaging.conversation_updated', entityType: 'conversation', entityId: id, orgId: access.orgId, actorUserId, details: { ...fields } }, client)
    await this.realtime.publish({ orgId: access.orgId, branchId: row.branch?.id ?? null, type: 'conversation', conversationId: id })
    return this.get(access, id)
  }

  // Ties a conversation from an unknown address to a lead or patient once staff have checked who it is.
  async link(access: AccessContext, id: string, input: { leadId?: string; patientId?: string; version: number }, actorUserId: string, client: ClientInfo) {
    const row = await this.find(access, id)
    if (row.lead || row.patient) throw conflict('CONVERSATION_LINKED', 'This conversation is already linked.')
    const contact = input.leadId ? await this.leadContact(access, input.leadId) : await this.patientContact(access, input.patientId!)
    const { count } = await this.prisma.conversation.updateMany({
      where: { id, orgId: access.orgId, version: input.version },
      data: { leadId: input.leadId ?? null, patientId: input.patientId ?? null, branchId: contact.branchId, version: { increment: 1 } },
    })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'messaging.conversation_linked', entityType: 'conversation', entityId: id, orgId: access.orgId, actorUserId, details: { leadId: input.leadId ?? null, patientId: input.patientId ?? null } }, client)
    return this.get(access, id)
  }

  async addNote(access: AccessContext, id: string, text: string, actorUserId: string) {
    await this.find(access, id)
    await this.prisma.conversationNote.create({ data: { conversationId: id, text, authorId: actorUserId } })
    return this.get(access, id)
  }

  // ─── Sending ──────────────────────────────────────────────────────────────

  // Checks every rule now, then queues the message; the worker sends it and receipts update it.
  async send(access: AccessContext, id: string, input: SendMessageInput, actorUserId: string, client: ClientInfo) {
    const row = await this.find(access, id)
    if (!(await this.channels.connected(access.orgId, row.channel))) throw unprocessable('CHANNEL_NOT_CONNECTED', 'This channel is not connected. An administrator can connect it on the Channels screen.')

    const template = input.templateId
      ? await this.prisma.messageTemplate.findFirst({ where: { id: input.templateId, orgId: access.orgId }, select: { id: true, name: true, category: true, channel: true, locale: true, subject: true, body: true, status: true, providerRef: true, version: true } })
      : null
    if (input.templateId && !template) throw notFound('Template not found.')
    if (template && template.channel !== row.channel) throw unprocessable('TEMPLATE_CHANNEL', `This template is for ${template.channel}, not ${row.channel}.`)

    const consent = await this.consent.current(access.orgId, row.channel, row.address)
    const notifications = row.patient ? (row.channel === 'whatsapp' ? row.patient.notifyWhatsapp : row.channel === 'sms' ? row.patient.notifySms : null) : null
    const block = sendBlock({ channel: row.channel, consent, freeText: !template, template, patientNotifications: notifications, windowOpen: whatsappWindowOpen(row.lastInboundAt) })
    if (block) throw unprocessable(block, BLOCK_MESSAGES[block])

    let body = input.body ?? ''
    let parameters: string[] | null = null
    if (template) {
      const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: access.orgId }, select: { displayName: true } })
      const name = row.patient ? row.patient.alias || firstName(row.patient.fullName) : row.lead ? firstName(row.lead.fullName) : undefined
      const values: Record<string, string> = { ...input.variables, clinic_name: organisation.displayName, ...(name ? { preferred_name: name } : {}) }
      const missing = missingVariables(template.body, values)
      if (missing.length) throw unprocessable('TEMPLATE_VARIABLES_MISSING', `Fill in ${missing.map((entry) => `{{${entry}}}`).join(', ')} before sending.`)
      body = renderTemplate(template.body, values)
      parameters = templateVariables(template.body).map((entry) => values[entry]!)
    }

    const message = await this.prisma.transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          orgId: access.orgId, conversationId: id, direction: 'outbound', status: 'queued', body, subject: template?.subject ?? null, templateId: template?.id ?? null, templateVersion: template?.version ?? null,
          parameters: parameters ?? undefined, nextAttemptAt: new Date(), sentById: actorUserId,
        },
        select: { id: true },
      })
      await tx.conversation.update({ where: { id }, data: { lastMessageAt: new Date(), preview: preview(body), unread: false, status: 'open' } })
      await this.audit.record({ action: 'messaging.message_queued', entityType: 'message', entityId: created.id, orgId: access.orgId, actorUserId, details: { channel: row.channel, templateId: template?.id ?? null } }, client, tx)
      return created
    })
    await this.realtime.publish({ orgId: access.orgId, branchId: row.branch?.id ?? null, type: 'message', conversationId: id, messageId: message.id })
    return this.get(access, id)
  }

  // Delivery problems: failed sends and sends whose outcome is unknown.
  async listMessages(access: AccessContext, query: ListMessagesQuery) {
    const where: Prisma.MessageWhereInput = {
      orgId: access.orgId, direction: 'outbound',
      status: query.status ?? { in: ['failed', 'unknown'] },
      conversation: { AND: [this.scopeWhere(access), query.channel ? { channel: query.channel } : {}] },
    }
    const [total, rows] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: { ...messageSelect, conversation: { select: conversationSelect } } }),
    ])
    return { items: rows.map(({ conversation, ...message }) => ({ ...this.messageView(message), conversation: this.view(conversation, access) })), page: query.page, pageSize: query.pageSize, total }
  }

  // A failed message is queued again after the same checks as a new one. An unknown outcome must be resolved first,
  // because resending could deliver it twice.
  async retry(access: AccessContext, messageId: string, actorUserId: string, client: ClientInfo) {
    const message = await this.findMessage(access, messageId)
    if (message.status === 'unknown') throw conflict('OUTCOME_UNKNOWN', 'Check with the provider whether this message went out, and record the outcome before retrying.')
    if (message.status !== 'failed') throw conflict('NOT_FAILED', 'Only a failed message can be retried.')
    const conversation = message.conversation
    if (!(await this.channels.connected(access.orgId, conversation.channel))) throw unprocessable('CHANNEL_NOT_CONNECTED', 'This channel is not connected.')
    if ((await this.consent.current(access.orgId, conversation.channel, conversation.address)) === 'withdrawn') throw unprocessable('CONSENT_WITHDRAWN', BLOCK_MESSAGES.CONSENT_WITHDRAWN)
    const { count } = await this.prisma.message.updateMany({ where: { id: messageId, status: 'failed' }, data: { status: 'queued', attempts: 0, nextAttemptAt: new Date(), errorCode: null, errorMessage: null, failedAt: null } })
    if (count === 0) throw conflict('NOT_FAILED', 'Only a failed message can be retried.')
    await this.audit.record({ action: 'messaging.message_retried', entityType: 'message', entityId: messageId, orgId: access.orgId, actorUserId }, client)
    await this.realtime.publish({ orgId: access.orgId, branchId: conversation.branchId, type: 'message', conversationId: conversation.id, messageId })
    return this.messageView(await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, select: messageSelect }))
  }

  // Records what the provider's own console shows for a message whose outcome was unknown.
  async resolve(access: AccessContext, messageId: string, input: { outcome: 'sent' | 'failed'; note: string }, actorUserId: string, client: ClientInfo) {
    const message = await this.findMessage(access, messageId)
    if (message.status !== 'unknown') throw conflict('NOT_UNKNOWN', 'Only a message with an unknown outcome needs resolving.')
    const now = new Date()
    await this.prisma.message.update({
      where: { id: messageId },
      data: input.outcome === 'sent' ? { status: 'sent', sentAt: now, errorMessage: `Confirmed sent: ${input.note}` } : { status: 'failed', failedAt: now, errorCode: 'CONFIRMED_NOT_SENT', errorMessage: input.note },
    })
    await this.audit.record({ action: 'messaging.message_resolved', entityType: 'message', entityId: messageId, orgId: access.orgId, actorUserId, details: { outcome: input.outcome } }, client)
    await this.realtime.publish({ orgId: access.orgId, branchId: message.conversation.branchId, type: 'message', conversationId: message.conversation.id, messageId })
    return this.messageView(await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, select: messageSelect }))
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Branch-limited roles see conversations at their branches; ones not tied to a branch yet are for organisation-wide roles.
  private scopeWhere(access: AccessContext, branchId?: string): Prisma.ConversationWhereInput {
    if (branchId) {
      if (access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
      return { orgId: access.orgId, branchId }
    }
    return { orgId: access.orgId, ...(access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prisma.conversation.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: conversationSelect })
    if (!row) throw notFound('Conversation not found.')
    return row
  }

  private async findMessage(access: AccessContext, id: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, orgId: access.orgId, direction: 'outbound', conversation: this.scopeWhere(access) },
      select: { id: true, status: true, conversation: { select: { id: true, channel: true, address: true, branchId: true } } },
    })
    if (!message) throw notFound('Message not found.')
    return message
  }

  private async leadContact(access: AccessContext, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, orgId: access.orgId, ...(access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) },
      select: { mobile: true, email: true, branchId: true },
    })
    if (!lead) throw notFound('Lead not found.')
    return lead
  }

  private async patientContact(access: AccessContext, patientId: string) {
    if (!access.permissions.has('patients.view')) throw forbidden('PERMISSION_DENIED', 'Your role cannot open patient records.')
    const scope = await this.careScope.resolve(access)
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, orgId: access.orgId, ...(scope.patients === 'all' ? {} : { appointments: { some: { practitionerId: scope.patients.practitionerId } } }) },
      select: { mobile: true, email: true, homeBranchId: true },
    })
    if (!patient) throw notFound('Patient not found.')
    return { mobile: patient.mobile, email: patient.email, branchId: patient.homeBranchId }
  }

  private async assertMember(orgId: string, membershipId: string) {
    const member = await this.prisma.membership.count({
      where: { id: membershipId, orgId, status: 'active', roles: { some: { role: { status: 'active', permissions: { some: { permission: 'growth.view' } } } } } },
    })
    if (!member) throw unprocessable('OWNER_NOT_ELIGIBLE', 'Choose a team member who can see conversations.')
  }

  private changed() {
    return conflict('CONVERSATION_CHANGED', 'Someone else changed this conversation. Reload it and try again.')
  }

  // Used by the webhooks: the conversation for an address that wrote in, created unlinked when new.
  async forInbound(tx: Tx, orgId: string, channel: MessageChannel, address: string) {
    const existing = await tx.conversation.findUnique({ where: { orgId_channel_address: { orgId, channel, address } }, select: { id: true, branchId: true } })
    if (existing) return existing
    const number = formatNumber('CV-', await this.counters.next(tx, orgId, 'conversation'))
    return tx.conversation.create({ data: { orgId, number, channel, address }, select: { id: true, branchId: true } })
  }
}
