import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { unprocessable } from '../../common/errors/app-error'
import { generateToken } from '../../common/utils/crypto'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { MessageChannel, Prisma } from '../../generated/prisma/client'
import { openSecret, sealSecret } from './channel-secrets'
import { CHANNELS, EmailChannelInput, SmsChannelInput, WhatsAppChannelInput } from './messaging.schemas'
import { MESSAGING_TRANSPORT, ProviderError, Transport } from './providers'

// The credential fields of each channel; they are encrypted and never returned.
const SECRET_FIELDS: Record<MessageChannel, string[]> = { whatsapp: ['accessToken', 'appSecret'], sms: ['authKey'], email: ['password'] }
const WEBHOOK_PATH: Partial<Record<MessageChannel, string>> = { whatsapp: 'whatsapp', sms: 'msg91' }

type ChannelInput = WhatsAppChannelInput | SmsChannelInput | EmailChannelInput

export interface ChannelCredentials {
  id: string
  config: Record<string, string>
  secrets: Record<string, string>
}

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MESSAGING_TRANSPORT) private readonly transport: Transport,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get key() {
    return this.env.MESSAGING_SECRET_KEY ? Buffer.from(this.env.MESSAGING_SECRET_KEY, 'base64') : null
  }

  async list(orgId: string) {
    const rows = await this.prisma.messagingChannel.findMany({ where: { orgId } })
    return CHANNELS.map((channel) => {
      const row = rows.find((entry) => entry.channel === channel)
      const secrets = row?.secret && this.key ? this.tryOpen(row.secret) : {}
      const path = WEBHOOK_PATH[channel]
      return {
        channel,
        status: row?.status ?? 'not_connected',
        config: (row?.config as Record<string, string> | undefined) ?? {},
        // Which credentials are saved, never their values.
        saved: Object.fromEntries(SECRET_FIELDS[channel].map((field) => [field, Boolean(secrets[field])])),
        verifiedAt: row?.verifiedAt ?? null,
        lastError: row?.lastError ?? null,
        webhook: row && path ? { url: this.env.PUBLIC_API_URL ? `${this.env.PUBLIC_API_URL.replace(/\/$/, '')}/v1/webhooks/${path}/${row.webhookToken}` : null, verifyToken: channel === 'whatsapp' ? row.webhookToken : null } : null,
        encryptionReady: Boolean(this.key),
        version: row?.version ?? 0,
      }
    })
  }

  // Saves the settings, keeps any secret left blank, then checks the credentials with the provider. A failed check
  // is saved too (status "error" with the provider's reason) so the administrator can see what to fix.
  async save(access: AccessContext, channel: MessageChannel, input: ChannelInput, actorUserId: string, client: ClientInfo) {
    const key = this.key
    if (!key) throw unprocessable('MESSAGING_KEY_MISSING', 'Set MESSAGING_SECRET_KEY in backend.env before connecting a channel (see README, Messaging).')
    const existing = await this.prisma.messagingChannel.findUnique({ where: { orgId_channel: { orgId: access.orgId, channel } } })
    const previous = existing?.secret ? this.tryOpen(existing.secret) : {}
    const fields = input as Record<string, unknown>
    const secrets = Object.fromEntries(SECRET_FIELDS[channel].map((field) => [field, (fields[field] as string | undefined) ?? previous[field] ?? '']))
    const missing = SECRET_FIELDS[channel].filter((field) => !secrets[field])
    if (missing.length) throw unprocessable('CHANNEL_SECRET_MISSING', `Enter ${missing.join(' and ')} to connect.`)
    const config = Object.fromEntries(Object.entries(fields).filter(([field, value]) => !SECRET_FIELDS[channel].includes(field) && value !== undefined && value !== null).map(([field, value]) => [field, String(value)]))

    let status: 'connected' | 'error' = 'connected'
    let lastError: string | null = null
    try {
      await this.transport[channel].verify(config, secrets)
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      status = 'error'
      lastError = error.message
    }

    const data = { status, config: config as Prisma.InputJsonObject, secret: sealSecret(key, secrets), lastError, verifiedAt: status === 'connected' ? new Date() : null, updatedById: actorUserId }
    if (existing) await this.prisma.messagingChannel.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
    else await this.prisma.messagingChannel.create({ data: { ...data, orgId: access.orgId, channel, webhookToken: generateToken() } })
    await this.audit.record({ action: 'messaging.channel_saved', entityType: 'messaging_channel', entityId: existing?.id ?? null, orgId: access.orgId, actorUserId, details: { channel, status } }, client)
    return (await this.list(access.orgId)).find((entry) => entry.channel === channel)!
  }

  async disconnect(access: AccessContext, channel: MessageChannel, actorUserId: string, client: ClientInfo) {
    const existing = await this.prisma.messagingChannel.findUnique({ where: { orgId_channel: { orgId: access.orgId, channel } } })
    if (existing) {
      await this.prisma.messagingChannel.update({ where: { id: existing.id }, data: { status: 'not_connected', secret: null, verifiedAt: null, lastError: null, updatedById: actorUserId, version: { increment: 1 } } })
      await this.audit.record({ action: 'messaging.channel_disconnected', entityType: 'messaging_channel', entityId: existing.id, orgId: access.orgId, actorUserId, details: { channel } }, client)
    }
    return (await this.list(access.orgId)).find((entry) => entry.channel === channel)!
  }

  // What the sending worker and webhooks need; null when the channel cannot be used.
  async credentials(orgId: string, channel: MessageChannel): Promise<ChannelCredentials | null> {
    const row = await this.prisma.messagingChannel.findUnique({ where: { orgId_channel: { orgId, channel } } })
    if (!row || row.status !== 'connected' || !row.secret || !this.key) return null
    return { id: row.id, config: row.config as Record<string, string>, secrets: this.tryOpen(row.secret) }
  }

  async byWebhookToken(token: string) {
    const row = await this.prisma.messagingChannel.findUnique({ where: { webhookToken: token } })
    if (!row || !row.secret || !this.key) return null
    return { ...row, secrets: this.tryOpen(row.secret) }
  }

  async connected(orgId: string, channel: MessageChannel) {
    return (await this.prisma.messagingChannel.count({ where: { orgId, channel, status: 'connected' } })) > 0
  }

  // The provider refused the credentials while sending: stop using the channel until someone reconnects it.
  async markFailed(channelId: string, message: string) {
    await this.prisma.messagingChannel.update({ where: { id: channelId }, data: { status: 'error', lastError: message.slice(0, 500) } })
  }

  private tryOpen(sealed: string): Record<string, string> {
    try {
      return openSecret(this.key!, sealed)
    } catch {
      // A changed MESSAGING_SECRET_KEY makes saved credentials unreadable; they must be entered again.
      return {}
    }
  }
}
