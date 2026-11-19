import { Injectable, Logger } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { forbidden, notFound, unauthorized } from '../../common/errors/app-error'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import type { MessageChannel, MessageStatus } from '../../generated/prisma/client'
import { ChannelsService } from './channels.service'
import { ConsentService } from './consent.service'
import { ConversationsService } from './conversations.service'
import { advances, normaliseAddress, optKeyword, preview } from './messaging.logic'
import { RealtimeService } from './realtime.service'

interface StatusUpdate {
  providerMessageId: string
  status: MessageStatus
  at: Date
  errorCode?: string
  errorMessage?: string
}

interface Inbound {
  providerMessageId: string
  from: string
  text: string
  at: Date
}

const WHATSAPP_STATUS: Record<string, MessageStatus> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' }
// MSG91 delivery reports, numeric or text.
const MSG91_STATUS: Record<string, MessageStatus> = { '1': 'delivered', delivered: 'delivered', delivrd: 'delivered', '2': 'failed', '16': 'failed', failed: 'failed', rejected: 'failed', undelivered: 'failed', '8': 'sent', submitted: 'sent', sent: 'sent' }

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// Provider callbacks: delivery receipts and, for WhatsApp, messages people send to the clinic. The address of each
// webhook carries the channel's random token, and WhatsApp calls are also checked against Meta's signature.
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('MessagingWebhooks')

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly consent: ConsentService,
    private readonly conversations: ConversationsService,
    private readonly realtime: RealtimeService,
  ) {}

  // Meta's subscription check: echo the challenge when the verify token matches.
  async whatsappChallenge(token: string, query: Record<string, unknown>) {
    const channel = await this.channels.byWebhookToken(token)
    if (!channel || channel.channel !== 'whatsapp') throw notFound()
    if (query['hub.mode'] !== 'subscribe' || typeof query['hub.verify_token'] !== 'string' || !safeEqual(query['hub.verify_token'], channel.webhookToken)) {
      throw forbidden('WEBHOOK_TOKEN_MISMATCH', 'Verify token does not match.')
    }
    return String(query['hub.challenge'] ?? '')
  }

  async whatsapp(token: string, rawBody: Buffer | undefined, signature: string | undefined, payload: unknown) {
    const channel = await this.channels.byWebhookToken(token)
    if (!channel || channel.channel !== 'whatsapp') throw notFound()
    const expected = `sha256=${createHmac('sha256', channel.secrets.appSecret ?? '').update(rawBody ?? Buffer.alloc(0)).digest('hex')}`
    if (!rawBody || !signature || !channel.secrets.appSecret || !safeEqual(signature, expected)) throw unauthorized('WEBHOOK_SIGNATURE_INVALID', 'Signature does not match.')

    const updates: StatusUpdate[] = []
    const inbound: Inbound[] = []
    const entries = (payload as { entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }> })?.entry ?? []
    for (const change of entries.flatMap((entry) => entry.changes ?? [])) {
      const value = change.value ?? {}
      for (const status of (value.statuses as Array<Record<string, unknown>> | undefined) ?? []) {
        const mapped = WHATSAPP_STATUS[String(status.status)]
        if (!mapped || !status.id) continue
        const error = (status.errors as Array<{ code?: number; title?: string; message?: string }> | undefined)?.[0]
        updates.push({ providerMessageId: String(status.id), status: mapped, at: this.time(status.timestamp), errorCode: error ? `WHATSAPP_${error.code}` : undefined, errorMessage: error?.title ?? error?.message })
      }
      for (const message of (value.messages as Array<Record<string, unknown>> | undefined) ?? []) {
        const text = message.type === 'text' ? (message.text as { body?: string } | undefined)?.body : `[${String(message.type)} message]`
        if (!message.id || !message.from || !text) continue
        inbound.push({ providerMessageId: String(message.id), from: String(message.from), text, at: this.time(message.timestamp) })
      }
    }
    for (const update of updates) await this.applyStatus(channel.orgId, update)
    for (const message of inbound) await this.receive(channel.orgId, 'whatsapp', message)
    return { received: updates.length + inbound.length }
  }

  // MSG91 delivery reports. Configure the webhook in MSG91 with this address; it may send one report or a list.
  async msg91(token: string, payload: unknown) {
    const channel = await this.channels.byWebhookToken(token)
    if (!channel || channel.channel !== 'sms') throw notFound()
    const reports = (Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data ?? [payload]) as Array<Record<string, unknown>>
    let applied = 0
    for (const report of reports) {
      const id = report.requestId ?? report.request_id ?? report.requestID
      const raw = String(report.status ?? report.report_status ?? report.desc ?? '').trim().toLowerCase()
      const status = MSG91_STATUS[raw]
      if (!id || !status) continue
      await this.applyStatus(channel.orgId, { providerMessageId: String(id), status, at: this.time(report.date ?? report.timestamp), errorMessage: status === 'failed' ? String(report.failureReason ?? report.desc ?? 'Not delivered') : undefined })
      applied += 1
    }
    return { received: applied }
  }

  private async applyStatus(orgId: string, update: StatusUpdate) {
    const message = await this.prisma.message.findUnique({ where: { orgId_providerMessageId: { orgId, providerMessageId: update.providerMessageId } }, select: { id: true, status: true, conversation: { select: { id: true, branchId: true } } } })
    if (!message) {
      this.logger.warn({ providerMessageId: update.providerMessageId }, 'Receipt for a message this organisation did not send')
      return
    }
    if (!advances(message.status, update.status)) return
    const at = update.at
    const times = { sent: { sentAt: at }, delivered: { deliveredAt: at }, read: { readAt: at }, failed: { failedAt: at, errorCode: update.errorCode ?? 'PROVIDER_FAILED', errorMessage: update.errorMessage?.slice(0, 500) ?? 'The provider could not deliver this message.' } }[update.status as 'sent' | 'delivered' | 'read' | 'failed']
    await this.prisma.message.update({ where: { id: message.id }, data: { status: update.status, ...times } })
    await this.realtime.publish({ orgId, branchId: message.conversation.branchId, type: 'message', conversationId: message.conversation.id, messageId: message.id })
  }

  private async receive(orgId: string, channel: MessageChannel, message: Inbound) {
    const address = normaliseAddress(channel, message.from)
    if (!address) {
      this.logger.warn('Ignored a message from an address outside India')
      return
    }
    const keyword = optKeyword(message.text)
    let conversation: { id: string; branchId: string | null }
    try {
      conversation = await this.prisma.transaction(async (tx) => {
        const found = await this.conversations.forInbound(tx, orgId, channel, address)
        await tx.message.create({ data: { orgId, conversationId: found.id, direction: 'inbound', status: 'received', body: message.text.slice(0, 4000), providerMessageId: message.providerMessageId, createdAt: message.at } })
        await tx.conversation.update({ where: { id: found.id }, data: { unread: true, status: 'open', lastMessageAt: message.at, lastInboundAt: message.at, preview: preview(message.text) } })
        if (keyword) await this.consent.recordReply(tx, orgId, channel, address, keyword === 'stop' ? 'withdrawn' : 'granted', message.text)
        return found
      })
    } catch (error) {
      // Providers retry webhooks; a message already stored is not stored twice.
      if (isUniqueViolation(error)) return
      throw error
    }
    await this.realtime.publish({ orgId, branchId: conversation.branchId, type: 'conversation', conversationId: conversation.id })
  }

  private time(value: unknown) {
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds > 1e9) return new Date(seconds * 1000)
    const parsed = typeof value === 'string' ? new Date(value) : null
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date()
  }
}
