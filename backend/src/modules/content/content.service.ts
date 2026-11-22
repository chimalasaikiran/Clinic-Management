import { Inject, Injectable, Logger } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { ContentStatus, ContentTarget, Prisma } from '../../generated/prisma/client'
import { growthMembers } from '../campaigns/growth-members'
import { IntegrationsService } from '../integrations/integrations.service'
import { ProviderError, PUBLISHING_TRANSPORT, PublishingTransport } from '../integrations/providers'
import { clinicInstant, cohortWindow } from '../leads/leads.logic'
import { publishedCaption } from './content.logic'
import type { ContentInput, ContentTemplateInput, DecideContentInput, ListContentQuery, SubmitContentInput, UpdateContentInput, UpdateContentTemplateInput } from './content.schemas'
import { MediaService } from './media.service'

const TARGET_LABELS: Record<ContentTarget, string> = { facebook: 'Facebook', instagram: 'Instagram' }
// A post left "publishing" this long belonged to a worker that stopped mid-publish: its outcome is unknown.
const STALE_MS = 10 * 60_000
// Submitting a time a little in the past (clock drift, a slow form) means "as soon as approved".
const SLACK_MS = 5 * 60_000

const postSelect = {
  id: true, code: true, title: true, category: true, caption: true, targets: true, cta: true, url: true, altText: true, templateVersion: true, scheduledAt: true, status: true,
  rightsReviewed: true, submittedAt: true, approvedAt: true, reviewNote: true, publishedAt: true, version: true, createdAt: true, updatedAt: true,
  branch: { select: { id: true, name: true } },
  media: { select: { id: true, fileName: true, mimeType: true, size: true } },
  template: { select: { id: true, code: true, title: true } },
  owner: { select: { id: true, user: { select: { fullName: true } } } },
  submittedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  publications: { orderBy: { target: 'asc' }, select: { target: true, status: true, providerPostId: true, permalink: true, errorCode: true, errorMessage: true, attempts: true, publishedAt: true } },
} as const satisfies Prisma.ContentPostSelect

type PostRow = Prisma.ContentPostGetPayload<{ select: typeof postSelect }>

const templateSelect = { id: true, code: true, title: true, category: true, body: true, cta: true, targets: true, archived: true, version: true, updatedAt: true, updatedBy: { select: { fullName: true } } } as const

@Injectable()
export class ContentService {
  private readonly logger = new Logger('Content')

  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly integrations: IntegrationsService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    @Inject(PUBLISHING_TRANSPORT) private readonly transport: PublishingTransport,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view(row: PostRow) {
    const { owner, submittedBy, approvedBy, ...rest } = row
    return { ...rest, owner: { membershipId: owner.id, name: owner.user.fullName }, submittedBy: submittedBy?.fullName ?? null, submittedById: submittedBy?.id ?? null, approvedBy: approvedBy?.fullName ?? null }
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async templates(orgId: string) {
    const rows = await this.prisma.contentTemplate.findMany({ where: { orgId }, orderBy: [{ archived: 'asc' }, { title: 'asc' }], select: templateSelect })
    return rows.map(({ updatedBy, ...row }) => ({ ...row, updatedBy: updatedBy?.fullName ?? null }))
  }

  async createTemplate(access: AccessContext, input: ContentTemplateInput, actorUserId: string, client: ClientInfo) {
    const created = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('TPL-', await this.counters.next(tx, access.orgId, 'content_template'), 4)
      const row = await tx.contentTemplate.create({ data: { orgId: access.orgId, code, ...input, updatedById: actorUserId }, select: { id: true } })
      await this.audit.record({ action: 'content.template_created', entityType: 'content_template', entityId: row.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return row
    })
    return (await this.templates(access.orgId)).find((entry) => entry.id === created.id)!
  }

  async updateTemplate(access: AccessContext, id: string, input: UpdateContentTemplateInput, actorUserId: string, client: ClientInfo) {
    const { version, ...fields } = input
    const { count } = await this.prisma.contentTemplate.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...fields, updatedById: actorUserId, version: { increment: 1 } } })
    if (count === 0) {
      if (!(await this.prisma.contentTemplate.count({ where: { id, orgId: access.orgId } }))) throw notFound('Template not found.')
      throw conflict('TEMPLATE_CHANGED', 'Someone else changed this template. Reload it and try again.')
    }
    await this.audit.record({ action: 'content.template_updated', entityType: 'content_template', entityId: id, orgId: access.orgId, actorUserId }, client)
    return (await this.templates(access.orgId)).find((entry) => entry.id === id)!
  }

  // ─── Posts: reading ───────────────────────────────────────────────────────

  async list(access: AccessContext, query: ListContentQuery) {
    const text = query.q?.trim()
    const where: Prisma.ContentPostWhereInput = {
      AND: [
        this.scopeWhere(access, query.branchId),
        query.from || query.to ? { scheduledAt: cohortWindow(query.from ?? '1970-01-01', query.to ?? '9999-12-30', this.env.CLINIC_TIMEZONE) } : {},
        query.status ? { status: query.status } : {},
        query.target ? { targets: { has: query.target } } : {},
        text ? { OR: [{ title: { contains: text, mode: 'insensitive' } }, { code: { contains: text, mode: 'insensitive' } }, { caption: { contains: text, mode: 'insensitive' } }] } : {},
      ],
    }
    const [total, rows] = await Promise.all([
      this.prisma.contentPost.count({ where }),
      this.prisma.contentPost.findMany({ where, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: postSelect }),
    ])
    return { items: rows.map((row) => this.view(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async get(access: AccessContext, id: string) {
    const row = await this.find(access, id)
    const events = await this.prisma.contentEvent.findMany({ where: { postId: id }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, kind: true, text: true, createdAt: true, actor: { select: { fullName: true } } } })
    const [meta, publicUrl] = [await this.integrations.connected(access.orgId, 'meta'), Boolean(this.env.PUBLIC_API_URL)]
    return {
      ...this.view(row),
      events: events.map(({ actor, ...event }) => ({ ...event, actor: actor?.fullName ?? null })),
      readiness: { metaConnected: meta, publicUrlReady: publicUrl },
    }
  }

  async owners(access: AccessContext) {
    return growthMembers(this.prisma, access.orgId)
  }

  // ─── Posts: changes ───────────────────────────────────────────────────────

  async create(access: AccessContext, input: ContentInput, actorUserId: string, client: ClientInfo) {
    const references = await this.references(access, input)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('CNT-', await this.counters.next(tx, access.orgId, 'content_post'), 4)
      const created = await tx.contentPost.create({ data: { orgId: access.orgId, code, ...this.fields(input), templateVersion: references.templateVersion, createdById: actorUserId }, select: { id: true } })
      await this.event(tx, created.id, 'created', `Draft created${references.templateCode ? ` from template ${references.templateCode} v${references.templateVersion}` : ''}.`, actorUserId)
      await this.audit.record({ action: 'content.created', entityType: 'content_post', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return this.get(access, id)
  }

  // Only a draft is edited. Anything in review or scheduled goes back to draft first, so an approval always covers
  // exactly what is published.
  async update(access: AccessContext, id: string, input: UpdateContentInput, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (current.status !== 'draft') throw conflict('CONTENT_LOCKED', 'Only a draft can be edited. Send it back to draft first.')
    await this.references(access, input)
    await this.prisma.transaction(async (tx) => {
      const { templateId: _templateId, ...fields } = this.fields(input)
      const { count } = await tx.contentPost.updateMany({ where: { id, orgId: access.orgId, version: input.version, status: 'draft' }, data: { ...fields, version: { increment: 1 } } })
      if (count === 0) throw this.changed()
      await this.event(tx, id, 'updated', 'Draft saved.', actorUserId)
      await this.audit.record({ action: 'content.updated', entityType: 'content_post', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.get(access, id)
  }

  async submit(access: AccessContext, id: string, input: SubmitContentInput, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (current.status !== 'draft') throw conflict('CONTENT_NOT_DRAFT', 'Only a draft can be submitted for review.')
    if (current.targets.includes('instagram') && !current.media) throw unprocessable('INSTAGRAM_IMAGE', 'Instagram posts need an image. Add one, or post to Facebook only.')
    const scheduledAt = clinicInstant(input.date, input.time, this.env.CLINIC_TIMEZONE)
    if (scheduledAt.getTime() < Date.now() - SLACK_MS) throw unprocessable('SCHEDULE_IN_PAST', 'Choose a publishing time from now on.')
    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.contentPost.updateMany({
        where: { id, orgId: access.orgId, version: input.version, status: 'draft' },
        data: { status: 'in_review', scheduledAt, rightsReviewed: true, submittedById: actorUserId, submittedAt: new Date(), approvedById: null, approvedAt: null, reviewNote: null, version: { increment: 1 } },
      })
      if (count === 0) throw this.changed()
      await this.event(tx, id, 'submitted', `Submitted for review, to publish ${this.stamp(scheduledAt)} on ${current.targets.map((target) => TARGET_LABELS[target]).join(' and ')}.`, actorUserId)
      await this.audit.record({ action: 'content.submitted', entityType: 'content_post', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.get(access, id)
  }

  // A second person approves (it is then published at its time) or sends it back with a reason.
  async decide(access: AccessContext, id: string, input: DecideContentInput, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (current.status !== 'in_review') throw conflict('CONTENT_NOT_IN_REVIEW', 'This post is not waiting for review.')
    if (current.submittedBy?.id === actorUserId) throw forbidden('SECOND_PERSON_REQUIRED', 'Someone other than the person who submitted it must review this post.')
    if (input.decision === 'approve') {
      if (!(await this.integrations.connected(access.orgId, 'meta'))) throw unprocessable('META_NOT_CONNECTED', 'Connect the Facebook Page on the Channels screen before approving posts.')
      if (current.media && !this.env.PUBLIC_API_URL) throw unprocessable('PUBLIC_URL_MISSING', 'Set PUBLIC_API_URL in backend.env so Meta can fetch the image.')
    }
    await this.prisma.transaction(async (tx) => {
      const approve = input.decision === 'approve'
      const { count } = await tx.contentPost.updateMany({
        where: { id, orgId: access.orgId, version: input.version, status: 'in_review' },
        data: approve ? { status: 'scheduled', approvedById: actorUserId, approvedAt: new Date(), reviewNote: input.note, version: { increment: 1 } } : { status: 'draft', reviewNote: input.note, version: { increment: 1 } },
      })
      if (count === 0) throw this.changed()
      if (approve) {
        await tx.contentPublication.deleteMany({ where: { postId: id, status: { in: ['pending', 'failed'] } } })
        await tx.contentPublication.createMany({ data: current.targets.map((target) => ({ postId: id, target })), skipDuplicates: true })
      }
      await this.event(tx, id, approve ? 'approved' : 'rejected', approve ? `Approved; publishes ${this.stamp(current.scheduledAt!)}.${input.note ? ` Note: ${input.note}` : ''}` : `Sent back to draft: ${input.note}`, actorUserId)
      await this.audit.record({ action: approve ? 'content.approved' : 'content.rejected', entityType: 'content_post', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.get(access, id)
  }

  // Back to draft before it is published: to change it, or because it should not go out.
  async withdraw(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (!['in_review', 'scheduled', 'failed'].includes(current.status)) throw conflict('CONTENT_NOT_WITHDRAWABLE', 'Only a post in review, scheduled or failed can go back to draft.')
    if (current.publications.some((entry) => entry.status === 'published' || entry.status === 'unknown')) {
      throw conflict('CONTENT_PARTLY_PUBLISHED', 'Part of this post is already published (or its outcome is unknown). Retry the rest or record the outcome instead.')
    }
    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.contentPost.updateMany({ where: { id, orgId: access.orgId, version, status: current.status }, data: { status: 'draft', approvedById: null, approvedAt: null, version: { increment: 1 } } })
      if (count === 0) throw this.changed()
      await tx.contentPublication.deleteMany({ where: { postId: id } })
      await this.event(tx, id, 'withdrawn', 'Returned to draft. It needs submitting and approving again.', actorUserId)
      await this.audit.record({ action: 'content.withdrawn', entityType: 'content_post', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.get(access, id)
  }

  // Publishes again only the networks that failed; ones already published are left alone.
  async retry(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    const current = await this.find(access, id)
    if (current.status !== 'failed') throw conflict('CONTENT_NOT_FAILED', 'Only a failed post can be retried.')
    if (current.publications.some((entry) => entry.status === 'unknown')) throw conflict('OUTCOME_UNKNOWN', 'Check the Page or account and record what was published before retrying.')
    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.contentPost.updateMany({ where: { id, orgId: access.orgId, version, status: 'failed' }, data: { status: 'scheduled', scheduledAt: new Date(), version: { increment: 1 } } })
      if (count === 0) throw this.changed()
      await tx.contentPublication.updateMany({ where: { postId: id, status: 'failed' }, data: { status: 'pending', errorCode: null, errorMessage: null } })
      await this.event(tx, id, 'retried', 'Publishing retried for the networks that failed.', actorUserId)
      await this.audit.record({ action: 'content.retried', entityType: 'content_post', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.get(access, id)
  }

  // Records what the Page or account shows for a network whose outcome was unknown.
  async resolve(access: AccessContext, id: string, target: ContentTarget, input: { outcome: 'published' | 'failed'; note: string }, actorUserId: string, client: ClientInfo) {
    await this.find(access, id)
    const { count } = await this.prisma.contentPublication.updateMany({
      where: { postId: id, target, status: 'unknown' },
      data: input.outcome === 'published' ? { status: 'published', publishedAt: new Date(), errorMessage: `Confirmed published: ${input.note}` } : { status: 'failed', errorCode: 'CONFIRMED_NOT_PUBLISHED', errorMessage: input.note },
    })
    if (count === 0) throw conflict('NOT_UNKNOWN', 'Only a network with an unknown outcome needs recording.')
    await this.prisma.transaction(async (tx) => {
      await this.settle(tx, id)
      await this.event(tx, id, 'resolved', `${TARGET_LABELS[target]}: recorded as ${input.outcome}. ${input.note}`, actorUserId)
      await this.audit.record({ action: 'content.publication_resolved', entityType: 'content_post', entityId: id, orgId: access.orgId, actorUserId, details: { target, outcome: input.outcome } }, client, tx)
    })
    return this.get(access, id)
  }

  // ─── Publishing (the worker) ──────────────────────────────────────────────

  // Posts whose time has come, claimed so two workers never publish one twice.
  async claimDue(): Promise<string[]> {
    // A worker that stopped mid-publish leaves "publishing" behind: those networks' outcome is unknown.
    const stale = new Date(Date.now() - STALE_MS)
    const abandoned = await this.prisma.contentPost.findMany({ where: { status: 'publishing', claimedAt: { lt: stale } }, select: { id: true } })
    for (const { id } of abandoned) {
      await this.prisma.transaction(async (tx) => {
        await tx.contentPublication.updateMany({ where: { postId: id, status: 'publishing' }, data: { status: 'unknown', errorCode: 'INTERRUPTED', errorMessage: 'Publishing was interrupted; check the Page or account before retrying.' } })
        await this.settle(tx, id)
      })
    }
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      update content_posts set status = 'publishing', claimed_at = now()
      where id in (select id from content_posts where status = 'scheduled' and scheduled_at <= now() order by scheduled_at limit 5 for update skip locked)
      returning id`
    return rows.map((row) => row.id)
  }

  async publish(id: string) {
    const post = await this.prisma.contentPost.findUniqueOrThrow({
      where: { id },
      select: { id: true, orgId: true, caption: true, cta: true, url: true, altText: true, mediaId: true, publications: { where: { status: 'pending' }, select: { id: true, target: true } } },
    })
    const credentials = await this.integrations.credentials(post.orgId, 'meta')
    const input = { caption: publishedCaption(post.caption, post.cta, post.url), link: post.url, imageUrl: post.mediaId ? this.media.publicUrl(post.mediaId) : null, altText: post.altText }
    for (const publication of post.publications) {
      await this.prisma.contentPublication.update({ where: { id: publication.id }, data: { status: 'publishing', attempts: { increment: 1 } } })
      let data: Prisma.ContentPublicationUpdateInput
      if (!credentials) {
        data = { status: 'failed', errorCode: 'META_NOT_CONNECTED', errorMessage: 'The Facebook Page was disconnected before this was published.' }
      } else {
        try {
          const result = publication.target === 'facebook' ? await this.transport.meta.publishFacebook(credentials.config, credentials.secrets, input) : await this.transport.meta.publishInstagram(credentials.config, credentials.secrets, input)
          data = { status: 'published', providerPostId: result.providerPostId, permalink: result.permalink, publishedAt: new Date(), errorCode: null, errorMessage: null }
        } catch (error) {
          if (!(error instanceof ProviderError)) throw error
          data = { status: error.kind === 'unknown' ? 'unknown' : 'failed', errorCode: error.code, errorMessage: error.message }
          if (error.kind === 'auth') await this.integrations.markFailed(credentials.id, error.message)
        }
      }
      await this.prisma.contentPublication.update({ where: { id: publication.id }, data })
    }
    await this.prisma.transaction(async (tx) => {
      const status = await this.settle(tx, id)
      await this.event(tx, id, status === 'published' ? 'published' : 'failed', status === 'published' ? 'Published.' : 'Publishing did not complete on every network. See the network results.', null)
    })
    this.logger.log({ postId: id }, 'Post publishing finished')
  }

  // The post's status from its networks: published when all are, failed when any failed or is unknown.
  private async settle(tx: Tx, id: string): Promise<ContentStatus> {
    const publications = await tx.contentPublication.findMany({ where: { postId: id }, select: { status: true, publishedAt: true } })
    const status: ContentStatus = publications.every((entry) => entry.status === 'published') ? 'published' : publications.some((entry) => entry.status === 'pending' || entry.status === 'publishing') ? 'publishing' : 'failed'
    const publishedAt = status === 'published' ? publications.reduce<Date | null>((latest, entry) => (entry.publishedAt && (!latest || entry.publishedAt > latest) ? entry.publishedAt : latest), null) : null
    await tx.contentPost.update({ where: { id }, data: { status, publishedAt, claimedAt: null } })
    return status
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private fields(input: ContentInput) {
    return {
      title: input.title, category: input.category, branchId: input.branchId, ownerMembershipId: input.ownerMembershipId, caption: input.caption, targets: input.targets, cta: input.cta, url: input.url,
      altText: input.altText, mediaId: input.mediaId, templateId: input.templateId, scheduledAt: clinicInstant(input.date, input.time, this.env.CLINIC_TIMEZONE), rightsReviewed: input.rightsReviewed,
    }
  }

  private async references(access: AccessContext, input: ContentInput) {
    if (access.branchScope !== 'all' && !access.branchScope.includes(input.branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    const [branch, owners, media, template] = await Promise.all([
      this.prisma.branch.count({ where: { id: input.branchId, orgId: access.orgId, status: 'active' } }),
      growthMembers(this.prisma, access.orgId),
      input.mediaId ? this.prisma.mediaAsset.count({ where: { id: input.mediaId, orgId: access.orgId } }) : Promise.resolve(1),
      input.templateId ? this.prisma.contentTemplate.findFirst({ where: { id: input.templateId, orgId: access.orgId }, select: { code: true, version: true } }) : Promise.resolve(null),
    ])
    if (!branch) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch of this organisation.')
    if (!owners.some((owner) => owner.membershipId === input.ownerMembershipId)) throw unprocessable('OWNER_NOT_ELIGIBLE', 'Choose an owner who can run campaigns and content.')
    if (!media) throw unprocessable('MEDIA_UNKNOWN', 'Upload the image again.')
    if (input.templateId && !template) throw unprocessable('TEMPLATE_UNKNOWN', 'Choose a template of this organisation.')
    return { templateCode: template?.code ?? null, templateVersion: template?.version ?? null }
  }

  private scopeWhere(access: AccessContext, branchId?: string): Prisma.ContentPostWhereInput {
    if (branchId && access.branchScope !== 'all' && !access.branchScope.includes(branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    return { orgId: access.orgId, ...(branchId ? { branchId } : access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }) }
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.prisma.contentPost.findFirst({ where: { AND: [this.scopeWhere(access), { id }] }, select: postSelect })
    if (!row) throw notFound('Content not found.')
    return row
  }

  private stamp(instant: Date) {
    return new Intl.DateTimeFormat('en-IN', { timeZone: this.env.CLINIC_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  }

  private event(tx: Tx, postId: string, kind: string, text: string, actorId: string | null) {
    return tx.contentEvent.create({ data: { postId, kind, text: text.slice(0, 1000), actorId } })
  }

  private changed() {
    return conflict('CONTENT_CHANGED', 'Someone else changed this post. Reload it and try again.')
  }
}
