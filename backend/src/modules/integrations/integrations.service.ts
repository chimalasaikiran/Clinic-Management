import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { IntegrationProvider, Prisma } from '../../generated/prisma/client'
import { openSecret, sealSecret } from '../messaging/channel-secrets'
import { ProviderError, PUBLISHING_TRANSPORT, PublishingTransport } from './providers'

export const PROVIDERS: IntegrationProvider[] = ['meta', 'google']
// Credential fields: encrypted and never returned. Everything else is plain settings.
const SECRET_FIELDS: Record<IntegrationProvider, string[]> = { meta: ['pageAccessToken'], google: ['clientSecret', 'refreshToken'] }

export interface IntegrationCredentials {
  id: string
  config: Record<string, string>
  secrets: Record<string, string>
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PUBLISHING_TRANSPORT) private readonly transport: PublishingTransport,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get key() {
    return this.env.MESSAGING_SECRET_KEY ? Buffer.from(this.env.MESSAGING_SECRET_KEY, 'base64') : null
  }

  async list(orgId: string) {
    const rows = await this.prisma.growthIntegration.findMany({ where: { orgId } })
    return PROVIDERS.map((provider) => {
      const row = rows.find((entry) => entry.provider === provider)
      const secrets = row?.secret && this.key ? this.tryOpen(row.secret) : {}
      return {
        provider,
        status: row?.status ?? 'not_connected',
        config: (row?.config as Record<string, string> | undefined) ?? {},
        saved: Object.fromEntries(SECRET_FIELDS[provider].map((field) => [field, Boolean(secrets[field])])),
        description: row?.description ?? null,
        verifiedAt: row?.verifiedAt ?? null,
        lastError: row?.lastError ?? null,
        encryptionReady: Boolean(this.key),
        // Instagram fetches images from this API, so publishing images needs a public address.
        publicUrlReady: Boolean(this.env.PUBLIC_API_URL),
        version: row?.version ?? 0,
      }
    })
  }

  // Saves the settings (a blank secret keeps the saved one), then checks them with the provider. A failed check is
  // saved too, with the provider's reason, so the administrator can see what to fix.
  async save(access: AccessContext, provider: IntegrationProvider, input: Record<string, string | undefined>, actorUserId: string, client: ClientInfo) {
    const key = this.key
    if (!key) throw unprocessable('MESSAGING_KEY_MISSING', 'Set MESSAGING_SECRET_KEY in backend.env before connecting an account (see README, Messaging).')
    const existing = await this.prisma.growthIntegration.findUnique({ where: { orgId_provider: { orgId: access.orgId, provider } } })
    const previous = existing?.secret ? this.tryOpen(existing.secret) : {}
    const secrets = Object.fromEntries(SECRET_FIELDS[provider].map((field) => [field, input[field] ?? previous[field] ?? '']))
    const missing = SECRET_FIELDS[provider].filter((field) => !secrets[field])
    if (missing.length) throw unprocessable('INTEGRATION_SECRET_MISSING', `Enter ${missing.join(' and ')} to connect.`)
    const config = Object.fromEntries(Object.entries(input).filter(([field, value]) => !SECRET_FIELDS[provider].includes(field) && value)) as Record<string, string>
    // The Google client id is not secret, but the token call needs it with the secrets.
    const all = provider === 'google' ? { ...secrets, clientId: config.clientId ?? '' } : secrets

    let status: 'connected' | 'error' = 'connected'
    let description: string | null = null
    let lastError: string | null = null
    try {
      description = await this.transport[provider].verify(config, all)
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      status = 'error'
      lastError = error.message
    }

    const data = { status, config: config as Prisma.InputJsonObject, secret: sealSecret(key, secrets), description, lastError, verifiedAt: status === 'connected' ? new Date() : null, updatedById: actorUserId }
    if (existing) await this.prisma.growthIntegration.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
    else await this.prisma.growthIntegration.create({ data: { ...data, orgId: access.orgId, provider } })
    await this.audit.record({ action: 'integration.saved', entityType: 'growth_integration', entityId: existing?.id ?? null, orgId: access.orgId, actorUserId, details: { provider, status } }, client)
    return (await this.list(access.orgId)).find((entry) => entry.provider === provider)!
  }

  async disconnect(access: AccessContext, provider: IntegrationProvider, actorUserId: string, client: ClientInfo) {
    const existing = await this.prisma.growthIntegration.findUnique({ where: { orgId_provider: { orgId: access.orgId, provider } } })
    if (existing) {
      await this.prisma.growthIntegration.update({ where: { id: existing.id }, data: { status: 'not_connected', secret: null, verifiedAt: null, lastError: null, description: null, updatedById: actorUserId, version: { increment: 1 } } })
      await this.audit.record({ action: 'integration.disconnected', entityType: 'growth_integration', entityId: existing.id, orgId: access.orgId, actorUserId, details: { provider } }, client)
    }
    return (await this.list(access.orgId)).find((entry) => entry.provider === provider)!
  }

  // What the workers need; null when the account cannot be used.
  async credentials(orgId: string, provider: IntegrationProvider): Promise<IntegrationCredentials | null> {
    const row = await this.prisma.growthIntegration.findUnique({ where: { orgId_provider: { orgId, provider } } })
    if (!row || row.status !== 'connected' || !row.secret || !this.key) return null
    const config = row.config as Record<string, string>
    const secrets = this.tryOpen(row.secret)
    return { id: row.id, config, secrets: provider === 'google' ? { ...secrets, clientId: config.clientId ?? '' } : secrets }
  }

  async connected(orgId: string, provider: IntegrationProvider) {
    return (await this.prisma.growthIntegration.count({ where: { orgId, provider, status: 'connected' } })) > 0
  }

  // The provider refused the saved credentials while working: stop using them until someone reconnects.
  async markFailed(id: string, message: string) {
    await this.prisma.growthIntegration.update({ where: { id }, data: { status: 'error', lastError: message.slice(0, 500) } })
  }

  // Google locations the connected account manages, for linking each branch to one.
  async googleLocations(access: AccessContext) {
    const credentials = await this.credentials(access.orgId, 'google')
    if (!credentials) throw unprocessable('GOOGLE_NOT_CONNECTED', 'Connect Google Business Profile on the Channels screen first.')
    try {
      return await this.transport.google.locations(credentials.config, credentials.secrets)
    } catch (error) {
      if (error instanceof ProviderError) throw unprocessable(`GOOGLE_${error.kind.toUpperCase()}`, error.message)
      throw error
    }
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
