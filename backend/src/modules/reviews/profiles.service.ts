import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { IntegrationsService } from '../integrations/integrations.service'
import { ProviderError, PUBLISHING_TRANSPORT, PublishingTransport } from '../integrations/providers'
import { localDate } from '../scheduling/clinic-time'
import type { ProfileInput } from './reviews.schemas'

const profileSelect = {
  id: true, businessName: true, street: true, city: true, state: true, postalCode: true, country: true, description: true, primaryCategory: true, secondaryCategory: true,
  phone: true, websiteUrl: true, reviewUrl: true, googleLocation: true, syncedAt: true, syncError: true, reviewsSyncedAt: true, version: true, updatedAt: true,
  updatedBy: { select: { fullName: true } },
  specialHours: { orderBy: { date: 'asc' }, select: { date: true, closed: true, opensAt: true, closesAt: true } },
} as const

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

// What the clinic publishes about each branch, and syncing it to the Google location it is linked to.
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly audit: AuditService,
    @Inject(PUBLISHING_TRANSPORT) private readonly transport: PublishingTransport,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // The branch's profile, or a starting point from the branch record when none is saved yet.
  async get(access: AccessContext, branchId: string) {
    const branch = await this.branch(access, branchId)
    const row = await this.prisma.branchProfile.findUnique({ where: { branchId }, select: profileSelect })
    const googleConnected = await this.integrations.connected(access.orgId, 'google')
    if (!row) {
      return {
        branch, saved: false, googleConnected,
        profile: { businessName: branch.name, street: '', city: branch.city, state: branch.state, postalCode: '', country: 'India', description: '', primaryCategory: null, secondaryCategory: null, phone: null, websiteUrl: null, reviewUrl: null, googleLocation: null, syncedAt: null, syncError: null, reviewsSyncedAt: null, version: 0, updatedAt: null, updatedBy: null, specialHours: [] },
      }
    }
    const { updatedBy, specialHours, ...profile } = row
    const today = localDate(new Date(), this.env.CLINIC_TIMEZONE)
    return {
      branch, saved: true, googleConnected,
      profile: { ...profile, updatedBy: updatedBy?.fullName ?? null, specialHours: specialHours.map((entry) => ({ ...entry, date: isoDay(entry.date) })).filter((entry) => entry.date >= today) },
    }
  }

  // Saves the ClinicOS values. Nothing goes to Google until someone syncs.
  async save(access: AccessContext, branchId: string, input: ProfileInput, actorUserId: string, client: ClientInfo) {
    await this.branch(access, branchId)
    const { specialHours, version, ...fields } = input
    const existing = await this.prisma.branchProfile.findUnique({ where: { branchId }, select: { id: true, version: true } })
    if (existing && version !== existing.version) throw conflict('PROFILE_CHANGED', 'Someone else changed this profile. Reload it and try again.')
    if (!existing && version) throw conflict('PROFILE_CHANGED', 'This profile was removed. Reload it and try again.')
    await this.prisma.transaction(async (tx) => {
      const profile = existing
        ? await tx.branchProfile.update({ where: { id: existing.id }, data: { ...fields, updatedById: actorUserId, version: { increment: 1 } }, select: { id: true } })
        : await tx.branchProfile.create({ data: { ...fields, orgId: access.orgId, branchId, updatedById: actorUserId }, select: { id: true } })
      await tx.specialHours.deleteMany({ where: { profileId: profile.id } })
      if (specialHours.length) {
        await tx.specialHours.createMany({ data: specialHours.map((entry) => ({ profileId: profile.id, date: new Date(`${entry.date}T00:00:00Z`), closed: entry.closed, opensAt: entry.closed ? null : entry.opensAt, closesAt: entry.closed ? null : entry.closesAt })) })
      }
      await this.audit.record({ action: 'profile.saved', entityType: 'branch_profile', entityId: profile.id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.get(access, branchId)
  }

  // Publishes the description and the special hours to the linked Google location.
  async sync(access: AccessContext, branchId: string, version: number, actorUserId: string, client: ClientInfo) {
    const current = await this.get(access, branchId)
    if (!current.saved) throw unprocessable('PROFILE_NOT_SAVED', 'Save the profile before syncing it.')
    if (current.profile.version !== version) throw conflict('PROFILE_CHANGED', 'Someone else changed this profile. Reload it and try again.')
    if (!current.profile.googleLocation) throw unprocessable('GOOGLE_LOCATION_MISSING', 'Choose the Google location for this branch first.')
    const credentials = await this.integrations.credentials(access.orgId, 'google')
    if (!credentials) throw unprocessable('GOOGLE_NOT_CONNECTED', 'Connect Google Business Profile on the Channels screen first.')
    const update = { description: current.profile.description, specialHours: current.profile.specialHours.map((entry) => ({ date: entry.date, closed: entry.closed, opensAt: entry.opensAt, closesAt: entry.closesAt })) }
    let syncError: string | null = null
    try {
      await this.transport.google.updateLocation(credentials.config, credentials.secrets, current.profile.googleLocation, update)
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error
      syncError = error.message
      if (error.kind === 'auth') await this.integrations.markFailed(credentials.id, error.message)
    }
    await this.prisma.branchProfile.update({ where: { branchId }, data: syncError ? { syncError } : { syncedAt: new Date(), syncError: null } })
    await this.audit.record({ action: 'profile.synced', entityType: 'branch_profile', entityId: current.profile.id ?? null, orgId: access.orgId, actorUserId, details: { ok: !syncError } }, client)
    if (syncError) throw unprocessable('GOOGLE_SYNC_FAILED', `Google did not accept the update: ${syncError}`)
    return this.get(access, branchId)
  }

  private async branch(access: AccessContext, branchId: string) {
    if (access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, orgId: access.orgId }, select: { id: true, code: true, name: true, city: true, state: true } })
    if (!branch) throw notFound('Branch not found.')
    return branch
  }
}
