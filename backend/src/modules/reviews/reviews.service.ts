import { Inject, Injectable, Logger } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { privacyFindings } from '../content/content.logic'
import { IntegrationsService } from '../integrations/integrations.service'
import { ProviderError, PUBLISHING_TRANSPORT, PublishingTransport } from '../integrations/providers'
import { cohortWindow } from '../leads/leads.logic'
import { localDate } from '../scheduling/clinic-time'
import { byDay, reputationMetrics } from './reviews.logic'
import type { ListReviewsQuery, ReportQuery } from './reviews.schemas'

// How often each linked location's reviews are fetched again.
const SYNC_EVERY_MS = 30 * 60_000

const reviewSelect = {
  id: true, source: true, providerReviewId: true, reviewerName: true, rating: true, comment: true, postedAt: true, publicReply: true, publicReplyAt: true, syncedAt: true,
  branch: { select: { id: true, name: true } },
  response: { select: { id: true, text: true, status: true, submittedAt: true, approvedAt: true, postedAt: true, reviewNote: true, errorMessage: true, version: true, updatedAt: true, submittedBy: { select: { id: true, fullName: true } }, approvedBy: { select: { fullName: true } } } },
  escalations: { orderBy: { createdAt: 'desc' }, select: { id: true, code: true, status: true, severity: true, dueAt: true } },
} as const satisfies Prisma.ReviewSelect

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger('Reviews')

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly audit: AuditService,
    @Inject(PUBLISHING_TRANSPORT) private readonly transport: PublishingTransport,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view(row: ReviewRow) {
    const { response, ...rest } = row
    return {
      ...rest,
      response: response ? { ...response, submittedBy: response.submittedBy?.fullName ?? null, submittedById: response.submittedBy?.id ?? null, approvedBy: response.approvedBy?.fullName ?? null } : null,
      // What the register shows: our reply's progress, or "replied" when Google already shows a reply.
      responseState: response && response.status !== 'posted' ? response.status : row.publicReply ? 'replied' : 'none',
    }
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  async list(access: AccessContext, query: ListReviewsQuery) {
    const text = query.q?.trim()
    const response: Prisma.ReviewWhereInput | null = !query.response ? null
      : query.response === 'none' ? { publicReply: null, OR: [{ response: null }, { response: { status: 'posted' } }] }
      : query.response === 'replied' ? { publicReply: { not: null }, OR: [{ response: null }, { response: { status: 'posted' } }] }
      : { response: { status: query.response } }
    const where: Prisma.ReviewWhereInput = {
      AND: [
        this.scopeWhere(access, query.branchId),
        query.rating ? { rating: query.rating } : {},
        response ?? {},
        query.escalated ? (query.escalated === 'true' ? { escalations: { some: {} } } : { escalations: { none: {} } }) : {},
        query.from || query.to ? { postedAt: cohortWindow(query.from ?? '1970-01-01', query.to ?? '9999-12-30', this.env.CLINIC_TIMEZONE) } : {},
        text ? { OR: [{ comment: { contains: text, mode: 'insensitive' } }, { reviewerName: { contains: text, mode: 'insensitive' } }] } : {},
      ],
    }
    const [total, rows, profiles] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({ where, orderBy: [{ postedAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: reviewSelect }),
      this.prisma.branchProfile.findMany({ where: { orgId: access.orgId, googleLocation: { not: null } }, select: { branchId: true, reviewsSyncedAt: true } }),
    ])
    return {
      items: rows.map((row) => this.view(row)),
      page: query.page, pageSize: query.pageSize, total,
      // Whether reviews can arrive at all, so an empty register is not mistaken for "no reviews".
      sync: { googleConnected: await this.integrations.connected(access.orgId, 'google'), linkedBranches: profiles.length, lastSyncedAt: profiles.reduce<Date | null>((latest, entry) => (entry.reviewsSyncedAt && (!latest || entry.reviewsSyncedAt > latest) ? entry.reviewsSyncedAt : latest), null) },
    }
  }

  async get(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const notes = await this.prisma.reviewNote.findMany({ where: { reviewId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, text: true, createdAt: true, author: { select: { fullName: true } } } })
    return { ...this.view(row), notes: notes.map(({ author, ...note }) => ({ ...note, author: author.fullName })) }
  }

  // ─── Reply: draft, submit, second-person approval ─────────────────────────

  async saveResponse(access: AccessContext, id: string, input: { text: string; version?: number }, actorUserId: string, client: ClientInfo) {
    const review = await this.find(access, id)
    const response = review.response
    if (response && !['draft', 'failed'].includes(response.status)) throw conflict('RESPONSE_LOCKED', 'This reply is in review or posted. Send it back to draft to change it.')
    if (response && input.version !== response.version) throw this.changed()
    if (response) await this.prisma.reviewResponse.update({ where: { id: response.id }, data: { text: input.text, status: 'draft', errorMessage: null, version: { increment: 1 } } })
    else await this.prisma.reviewResponse.create({ data: { reviewId: id, text: input.text } })
    await this.audit.record({ action: 'review.reply_saved', entityType: 'review', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  async submitResponse(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    const review = await this.find(access, id)
    const response = review.response
    if (!response || response.status !== 'draft') throw conflict('RESPONSE_NOT_DRAFT', 'Save a draft reply before submitting it.')
    const findings = privacyFindings(response.text)
    if (findings.length) throw unprocessable('PRIVACY_CHECK', `Remove ${findings.join(' and ')} from the public reply.`)
    const { count } = await this.prisma.reviewResponse.updateMany({ where: { id: response.id, version, status: 'draft' }, data: { status: 'in_review', submittedById: actorUserId, submittedAt: new Date(), approvedById: null, approvedAt: null, reviewNote: null, version: { increment: 1 } } })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'review.reply_submitted', entityType: 'review', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  // A different person approves (the reply is then posted to Google) or sends it back with a reason.
  async decideResponse(access: AccessContext, id: string, input: { decision: 'approve' | 'reject'; note: string | null; version: number }, actorUserId: string, client: ClientInfo) {
    const review = await this.find(access, id)
    const response = review.response
    if (!response || response.status !== 'in_review') throw conflict('RESPONSE_NOT_IN_REVIEW', 'This reply is not waiting for review.')
    if (response.submittedBy?.id === actorUserId) throw forbidden('SECOND_PERSON_REQUIRED', 'Someone other than the person who submitted it must review this reply.')
    if (input.decision === 'approve') {
      if (!(await this.integrations.connected(access.orgId, 'google'))) throw unprocessable('GOOGLE_NOT_CONNECTED', 'Connect Google Business Profile on the Channels screen before approving replies.')
      if (privacyFindings(response.text).length) throw unprocessable('PRIVACY_CHECK', 'The reply contains personal or clinical detail.')
    }
    const approve = input.decision === 'approve'
    const { count } = await this.prisma.reviewResponse.updateMany({
      where: { id: response.id, version: input.version, status: 'in_review' },
      data: approve ? { status: 'posting', approvedById: actorUserId, approvedAt: new Date(), reviewNote: input.note, version: { increment: 1 } } : { status: 'draft', reviewNote: input.note, version: { increment: 1 } },
    })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: approve ? 'review.reply_approved' : 'review.reply_rejected', entityType: 'review', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  async addNote(access: AccessContext, id: string, text: string, actorUserId: string) {
    await this.find(access, id)
    await this.prisma.reviewNote.create({ data: { reviewId: id, text, authorId: actorUserId } })
    return this.get(access, id)
  }

  // ─── Google (the worker) ──────────────────────────────────────────────────

  // Posts approved replies. Google's reply call replaces the reply, so a second attempt cannot post it twice.
  async postApproved() {
    const pending = await this.prisma.reviewResponse.findMany({
      where: { status: 'posting' },
      take: 20,
      select: { id: true, text: true, version: true, review: { select: { id: true, orgId: true, providerReviewId: true, branch: { select: { profile: { select: { googleLocation: true } } } } } } },
    })
    for (const response of pending) {
      const { review } = response
      const location = review.branch.profile?.googleLocation
      const credentials = await this.integrations.credentials(review.orgId, 'google')
      let failure: string | null = null
      let postedAt = new Date()
      if (!credentials) failure = 'Google Business Profile was disconnected before the reply was posted.'
      else if (!location) failure = 'The branch is no longer linked to a Google location.'
      else {
        try {
          postedAt = (await this.transport.google.reply(credentials.config, credentials.secrets, location, review.providerReviewId, response.text)).updatedAt
        } catch (error) {
          if (!(error instanceof ProviderError)) throw error
          // A temporary problem stays "posting" and is tried again on the next run.
          if (error.kind === 'retryable') continue
          failure = error.message
          if (error.kind === 'auth') await this.integrations.markFailed(credentials.id, error.message)
        }
      }
      await this.prisma.transaction(async (tx) => {
        const { count } = await tx.reviewResponse.updateMany({ where: { id: response.id, status: 'posting' }, data: failure ? { status: 'failed', errorMessage: failure.slice(0, 500) } : { status: 'posted', postedAt, errorMessage: null } })
        if (count && !failure) await tx.review.update({ where: { id: review.id }, data: { publicReply: response.text, publicReplyAt: postedAt } })
      })
    }
    return pending.length
  }

  // Fetches the reviews of every linked location not fetched in the last 30 minutes (or of one branch, now).
  async syncDue(now = new Date(), branchId?: string) {
    const profiles = await this.prisma.branchProfile.findMany({
      where: { googleLocation: { not: null }, ...(branchId ? { branchId } : { OR: [{ reviewsSyncedAt: null }, { reviewsSyncedAt: { lt: new Date(now.getTime() - SYNC_EVERY_MS) } }] }) },
      select: { id: true, orgId: true, branchId: true, googleLocation: true },
      take: 20,
    })
    let fetched = 0
    for (const profile of profiles) {
      const credentials = await this.integrations.credentials(profile.orgId, 'google')
      if (!credentials) continue
      try {
        const reviews = await this.transport.google.reviews(credentials.config, credentials.secrets, profile.googleLocation!)
        for (const review of reviews) {
          const data = {
            branchId: profile.branchId, reviewerName: review.reviewerName, rating: review.rating, comment: review.comment, postedAt: review.postedAt, providerUpdatedAt: review.updatedAt,
            publicReply: review.reply?.comment ?? null, publicReplyAt: review.reply?.updatedAt ?? null, syncedAt: now,
          }
          await this.prisma.review.upsert({ where: { orgId_providerReviewId: { orgId: profile.orgId, providerReviewId: review.providerReviewId } }, create: { orgId: profile.orgId, providerReviewId: review.providerReviewId, ...data }, update: data })
        }
        fetched += reviews.length
        await this.prisma.branchProfile.update({ where: { id: profile.id }, data: { reviewsSyncedAt: now, syncError: null } })
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error
        this.logger.warn({ branchId: profile.branchId, code: error.code }, 'Fetching Google reviews failed')
        await this.prisma.branchProfile.update({ where: { id: profile.id }, data: { reviewsSyncedAt: now, syncError: `Reviews: ${error.message}`.slice(0, 500) } })
        if (error.kind === 'auth') await this.integrations.markFailed(credentials.id, error.message)
      }
    }
    return fetched
  }

  async syncBranch(access: AccessContext, branchId: string) {
    if (access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    const profile = await this.prisma.branchProfile.findFirst({ where: { orgId: access.orgId, branchId }, select: { googleLocation: true } })
    if (!profile?.googleLocation) throw unprocessable('GOOGLE_LOCATION_MISSING', 'Link this branch to its Google location on the Business Profile screen first.')
    if (!(await this.integrations.connected(access.orgId, 'google'))) throw unprocessable('GOOGLE_NOT_CONNECTED', 'Connect Google Business Profile on the Channels screen first.')
    return { fetched: await this.syncDue(new Date(), branchId) }
  }

  // ─── Reputation report ────────────────────────────────────────────────────

  async report(access: AccessContext, query: ReportQuery) {
    const zone = this.env.CLINIC_TIMEZONE
    const where: Prisma.ReviewWhereInput = { AND: [this.scopeWhere(access, query.branchId), { postedAt: cohortWindow(query.from, query.to, zone) }, query.rating ? { rating: query.rating } : {}] }
    const reviews = await this.prisma.review.findMany({ where, orderBy: { postedAt: 'asc' }, select: { id: true, rating: true, postedAt: true, publicReplyAt: true } })
    const escalations = reviews.length ? await this.prisma.escalation.findMany({ where: { reviewId: { in: reviews.map((review) => review.id) } }, select: { status: true, dueAt: true } }) : []
    const now = new Date()
    return {
      from: query.from, to: query.to, branchId: query.branchId ?? null,
      ...reputationMetrics(reviews),
      byDay: byDay(reviews, (instant) => localDate(instant, zone)),
      escalations: { total: escalations.length, open: escalations.filter((entry) => entry.status !== 'resolved').length, overdue: escalations.filter((entry) => entry.status !== 'resolved' && entry.dueAt < now).length },
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  scopeWhere(access: AccessContext, branchId?: string): Prisma.ReviewWhereInput {
    if (branchId && access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    return { orgId: access.orgId, ...(branchId ? { branchId } : access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  async find(access: AccessContext, id: string) {
    const row = await this.prisma.review.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: reviewSelect })
    if (!row) throw notFound('Review not found.')
    return row
  }

  private changed() {
    return conflict('RESPONSE_CHANGED', 'Someone else changed this reply. Reload it and try again.')
  }
}
