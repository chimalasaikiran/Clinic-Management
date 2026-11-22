import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GrowthWorker } from '../../src/modules/campaigns/growth.worker'
import { ContentWorker } from '../../src/modules/content/content.worker'
import { GoogleClient, GoogleReview, MetaClient, ProviderError, PUBLISHING_TRANSPORT, PublishInput, SpecialHourPeriod } from '../../src/modules/integrations/providers'
import { OutboxWorker } from '../../src/modules/messaging/outbox.worker'
import { ChannelProvider, MESSAGING_TRANSPORT, OutgoingMessage } from '../../src/modules/messaging/providers'
import { ReviewsWorker } from '../../src/modules/reviews/reviews.worker'
import { addDays, localDate } from '../../src/modules/scheduling/clinic-time'
import { Browser, createOwner, PASSWORD, resetState, signIn, startApp, stopApp, TestContext } from './helpers'

// Stands in for Meta: records what would be published and fails on request.
class FakeMeta implements MetaClient {
  published: Array<{ target: 'facebook' | 'instagram'; post: PublishInput }> = []
  failInstagram: ProviderError | null = null
  async verify() {
    return 'Aura Health · Instagram @aurahealth'
  }
  async publishFacebook(_config: Record<string, string>, _secrets: Record<string, string>, post: PublishInput) {
    this.published.push({ target: 'facebook', post })
    return { providerPostId: `fb_${this.published.length}`, permalink: `https://www.facebook.com/fb_${this.published.length}` }
  }
  async publishInstagram(_config: Record<string, string>, _secrets: Record<string, string>, post: PublishInput) {
    if (this.failInstagram) {
      const error = this.failInstagram
      this.failInstagram = null
      throw error
    }
    this.published.push({ target: 'instagram', post })
    return { providerPostId: `ig_${this.published.length}`, permalink: null }
  }
}

// Stands in for Google Business Profile: a location with reviews, and a record of replies and profile updates.
class FakeGoogle implements GoogleClient {
  reviewsByLocation: Record<string, GoogleReview[]> = {}
  replies: Array<{ location: string; reviewId: string; comment: string }> = []
  updates: Array<{ location: string; description: string; specialHours: SpecialHourPeriod[] }> = []
  async verify() {
    return 'Google Business Profile · 1 location'
  }
  async locations() {
    return [{ name: 'locations/1234567890', title: 'Aura Health Main' }]
  }
  async reviews(_config: Record<string, string>, _secrets: Record<string, string>, location: string) {
    return this.reviewsByLocation[location] ?? []
  }
  async reply(_config: Record<string, string>, _secrets: Record<string, string>, location: string, reviewId: string, comment: string) {
    this.replies.push({ location, reviewId, comment })
    return { updatedAt: new Date() }
  }
  async updateLocation(_config: Record<string, string>, _secrets: Record<string, string>, location: string, update: { description: string; specialHours: SpecialHourPeriod[] }) {
    this.updates.push({ location, ...update })
  }
}

class FakeChannel implements ChannelProvider {
  sent: OutgoingMessage[] = []
  async verify() {
    return 'ok'
  }
  async send(_config: Record<string, string>, _secrets: Record<string, string>, message: OutgoingMessage) {
    this.sent.push(message)
    return { providerMessageId: `wamid.${this.sent.length}` }
  }
}

const meta = new FakeMeta()
const google = new FakeGoogle()
const whatsapp = new FakeChannel()
// A 1×1 PNG.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex')
const HOUR = 3_600_000
// Each test makes dozens of requests against the remote test database.
const SLOW = 300_000

let ctx: TestContext

beforeAll(async () => {
  ctx = await startApp([
    { provide: PUBLISHING_TRANSPORT, useValue: { meta, google } },
    { provide: MESSAGING_TRANSPORT, useValue: { whatsapp, sms: new FakeChannel(), email: new FakeChannel() } },
  ])
  vi.spyOn(ctx.app.get(GrowthWorker), 'isQuiet').mockReturnValue(false)
})
afterAll(async () => {
  await stopApp(ctx)
})
beforeEach(async () => {
  await resetState(ctx)
  Object.assign(meta, { published: [], failInstagram: null })
  Object.assign(google, { reviewsByLocation: {}, replies: [], updates: [] })
  whatsapp.sent = []
})

const today = () => localDate(new Date(), 'Asia/Kolkata')

// The owner and a second person who can run growth, so every public post and reply has two people.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const role = (await owner.post('/v1/roles').send({ name: 'Growth Lead', category: 'Operations', scope: 'org', status: 'active', permissions: ['growth.view', 'growth.leads', 'growth.manage'] }).expect(201)).body.data
  await owner.post('/v1/invitations').send({ email: 'priya@aura.test', roleIds: [role.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('priya@aura.test'), fullName: 'Priya Nair', password: PASSWORD }).expect(201)
  const secondBrowser = ctx.browser()
  await signIn(secondBrowser, 'priya@aura.test')
  const second = as(secondBrowser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const owners = (await owner.get('/v1/content/owners').expect(200)).body.data as Array<{ membershipId: string; name: string }>
  return { owner, second, orgId, branchId, ownerId: owners[0]!.membershipId }
}

type Clinic = Awaited<ReturnType<typeof clinic>>

const connectMeta = (c: Clinic) => c.owner.put('/v1/integrations/meta').send({ pageId: '104857600123', instagramAccountId: '17841400000000001', pageAccessToken: 'EAAG-page-token' }).expect(200)
const connectGoogle = (c: Clinic) => c.owner.put('/v1/integrations/google').send({ accountId: '112233445566', clientId: 'client-1234.apps.googleusercontent.com', clientSecret: 'google-secret', refreshToken: 'refresh-token' }).expect(200)

const postBody = (c: Clinic, extra: Record<string, unknown> = {}) => ({
  title: 'Plan your preventive health check', category: 'Prevention', branchId: c.branchId, ownerMembershipId: c.ownerId, caption: 'A preventive health check helps you discuss your health with a clinician.',
  targets: ['facebook', 'instagram'], cta: 'Enquire with the clinic', url: 'https://aura.example/screening', altText: 'Typographic graphic reading “Plan your preventive health check”.',
  date: addDays(today(), 1), time: '10:00', ...extra,
})

describe('content', () => {
  it('needs a second person to approve, then publishes to Facebook and Instagram with a signed image link', async () => {
    const c = await clinic()
    const integration = (await connectMeta(c)).body.data
    expect(integration).toMatchObject({ provider: 'meta', status: 'connected', description: 'Aura Health · Instagram @aurahealth', saved: { pageAccessToken: true } })
    expect(JSON.stringify(integration)).not.toContain('EAAG-page-token')

    await c.owner.post('/v1/media').set('Content-Type', 'image/png').send(Buffer.from('not an image')).expect(422)
    const media = (await c.owner.post('/v1/media').set('Content-Type', 'image/png').set('X-File-Name', encodeURIComponent('screening card.png')).send(PNG).expect(201)).body.data
    expect(media).toMatchObject({ mimeType: 'image/png', size: PNG.length, fileName: 'screening card.png' })

    const draft = (await c.owner.post('/v1/content').send(postBody(c, { mediaId: media.id })).expect(201)).body.data
    expect(draft).toMatchObject({ code: 'CNT-0001', status: 'draft', targets: ['facebook', 'instagram'] })
    const submitted = (await c.owner.post(`/v1/content/${draft.id}/submit`).send({ date: addDays(today(), 1), time: '10:00', rightsReviewed: true, version: 1 }).expect(200)).body.data
    expect(submitted).toMatchObject({ status: 'in_review', submittedBy: 'Siddharth Verma' })
    expect((await c.owner.patch(`/v1/content/${draft.id}`).send({ ...postBody(c), version: 2 }).expect(409)).body.error.code).toBe('CONTENT_LOCKED')

    expect((await c.owner.post(`/v1/content/${draft.id}/decision`).send({ decision: 'approve', version: 2 }).expect(403)).body.error.code).toBe('SECOND_PERSON_REQUIRED')
    const approved = (await c.second.post(`/v1/content/${draft.id}/decision`).send({ decision: 'approve', version: 2 }).expect(200)).body.data
    expect(approved).toMatchObject({ status: 'scheduled', approvedBy: 'Priya Nair', publications: [{ target: 'facebook', status: 'pending' }, { target: 'instagram', status: 'pending' }] })

    // Not due yet: nothing is published.
    expect(await ctx.app.get(ContentWorker).runOnce()).toBe(0)
    await ctx.prisma.contentPost.update({ where: { id: draft.id }, data: { scheduledAt: new Date(Date.now() - 60_000) } })
    expect(await ctx.app.get(ContentWorker).runOnce()).toBe(1)

    expect(meta.published.map((entry) => entry.target)).toEqual(['facebook', 'instagram'])
    const post = meta.published[0]!.post
    expect(post.caption).toBe('A preventive health check helps you discuss your health with a clinician.\n\nEnquire with the clinic: https://aura.example/screening')
    expect(post.imageUrl).toMatch(/^https:\/\/api\.clinic\.test\/v1\/media\/public\/[\w-]+\?expires=\d+&signature=[\w-]+$/)
    const path = post.imageUrl!.replace('https://api.clinic.test', '')
    const image = await ctx.browser().get(path).expect(200)
    expect(image.headers['content-type']).toBe('image/png')
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin')
    expect(Buffer.from(image.body).equals(PNG)).toBe(true)
    await ctx.browser().get(path.replace(/signature=[\w-]+/, 'signature=tampered-signature')).expect(404)

    const published = (await c.owner.get(`/v1/content/${draft.id}`).expect(200)).body.data
    expect(published).toMatchObject({ status: 'published', publications: [{ target: 'facebook', status: 'published', providerPostId: 'fb_1' }, { target: 'instagram', status: 'published', providerPostId: 'ig_2' }] })
    expect(published.events.map((event: { kind: string }) => event.kind)).toEqual(['published', 'approved', 'submitted', 'created'])
  }, SLOW)

  it('retries only the network that failed, and sends a rejected post back to draft with the reason', async () => {
    const c = await clinic()
    await connectMeta(c)
    const media = (await c.owner.post('/v1/media').set('Content-Type', 'image/png').send(PNG).expect(201)).body.data
    const draft = (await c.owner.post('/v1/content').send(postBody(c, { mediaId: media.id })).expect(201)).body.data
    await c.owner.post(`/v1/content/${draft.id}/submit`).send({ date: addDays(today(), 1), time: '10:00', rightsReviewed: true, version: 1 }).expect(200)
    expect((await c.second.post(`/v1/content/${draft.id}/decision`).send({ decision: 'reject', version: 2 }).expect(400)).body.error.code).toBe('VALIDATION_FAILED')
    const rejected = (await c.second.post(`/v1/content/${draft.id}/decision`).send({ decision: 'reject', note: 'Remove the word “guarantee”.', version: 2 }).expect(200)).body.data
    expect(rejected).toMatchObject({ status: 'draft', reviewNote: 'Remove the word “guarantee”.' })

    await c.owner.post(`/v1/content/${draft.id}/submit`).send({ date: addDays(today(), 1), time: '11:00', rightsReviewed: true, version: 3 }).expect(200)
    await c.second.post(`/v1/content/${draft.id}/decision`).send({ decision: 'approve', version: 4 }).expect(200)
    await ctx.prisma.contentPost.update({ where: { id: draft.id }, data: { scheduledAt: new Date(Date.now() - 60_000) } })
    meta.failInstagram = new ProviderError('rejected', 'META_9004', 'The image could not be downloaded.')
    await ctx.app.get(ContentWorker).runOnce()

    const failed = (await c.owner.get(`/v1/content/${draft.id}`).expect(200)).body.data
    expect(failed).toMatchObject({ status: 'failed', publications: [{ target: 'facebook', status: 'published' }, { target: 'instagram', status: 'failed', errorMessage: 'The image could not be downloaded.' }] })
    // Facebook is already out, so the post cannot quietly go back to draft.
    expect((await c.owner.post(`/v1/content/${draft.id}/withdraw`).send({ version: failed.version }).expect(409)).body.error.code).toBe('CONTENT_PARTLY_PUBLISHED')

    await c.owner.post(`/v1/content/${draft.id}/retry`).send({ version: failed.version }).expect(200)
    await ctx.app.get(ContentWorker).runOnce()
    expect(meta.published.map((entry) => entry.target)).toEqual(['facebook', 'instagram'])
    expect((await c.owner.get(`/v1/content/${draft.id}`).expect(200)).body.data.status).toBe('published')
  }, SLOW)

  it('refuses Instagram without an image and approval without a connected Page', async () => {
    const c = await clinic()
    const draft = (await c.owner.post('/v1/content').send(postBody(c)).expect(201)).body.data
    expect((await c.owner.post(`/v1/content/${draft.id}/submit`).send({ date: addDays(today(), 1), time: '10:00', rightsReviewed: true, version: 1 }).expect(422)).body.error.code).toBe('INSTAGRAM_IMAGE')
    const facebook = (await c.owner.patch(`/v1/content/${draft.id}`).send({ ...postBody(c), targets: ['facebook'], version: 1 }).expect(200)).body.data
    await c.owner.post(`/v1/content/${draft.id}/submit`).send({ date: addDays(today(), 1), time: '10:00', rightsReviewed: true, version: facebook.version }).expect(200)
    expect((await c.second.post(`/v1/content/${draft.id}/decision`).send({ decision: 'approve', version: facebook.version + 1 }).expect(422)).body.error.code).toBe('META_NOT_CONNECTED')

    const template = (await c.owner.post('/v1/content/templates').send({ title: 'Opening hours update', category: 'Clinic announcements', body: 'Our hours are changing.', cta: 'See hours', targets: ['facebook'] }).expect(201)).body.data
    expect(template).toMatchObject({ code: 'TPL-0001', version: 1 })
    const changed = (await c.owner.patch(`/v1/content/templates/${template.id}`).send({ title: 'Opening hours update', category: 'Clinic announcements', body: 'Our festive hours.', cta: 'See hours', targets: ['facebook'], version: 1 }).expect(200)).body.data
    expect(changed.version).toBe(2)
    const fromTemplate = (await c.owner.post('/v1/content').send(postBody(c, { targets: ['facebook'], templateId: template.id })).expect(201)).body.data
    expect(fromTemplate).toMatchObject({ template: { code: 'TPL-0001' }, templateVersion: 2 })
  }, SLOW)
})

describe('reviews', () => {
  const review = (id: string, rating: number, comment: string, hoursAgo: number): GoogleReview => ({
    providerReviewId: id, reviewerName: `Visitor ${id}`, rating, comment, postedAt: new Date(Date.now() - hoursAgo * HOUR), updatedAt: new Date(Date.now() - hoursAgo * HOUR), reply: null,
  })

  it('syncs the profile and reviews with Google, and posts a privacy-checked reply only after a second person approves', async () => {
    const c = await clinic()
    await connectGoogle(c)
    expect((await c.owner.get('/v1/integrations/google/locations').expect(200)).body.data).toEqual([{ name: 'locations/1234567890', title: 'Aura Health Main' }])

    const blank = (await c.owner.get(`/v1/branch-profiles/${c.branchId}`).expect(200)).body.data
    expect(blank).toMatchObject({ saved: false, googleConnected: true, profile: { version: 0 } })
    const special = addDays(today(), 3)
    const profile = {
      businessName: 'Aura Health — Main', street: 'Plot 42, Road 36', city: 'Hyderabad', state: 'Telangana', postalCode: '500033', description: 'Consultations and preventive screening.', primaryCategory: 'Medical clinic',
      reviewUrl: 'https://g.page/r/aura-main/review', googleLocation: 'locations/1234567890', specialHours: [{ date: special, opensAt: '10:00', closesAt: '14:00' }],
    }
    await c.owner.put(`/v1/branch-profiles/${c.branchId}`).send({ ...profile, specialHours: [{ date: special, opensAt: '14:00', closesAt: '10:00' }] }).expect(400)
    const saved = (await c.owner.put(`/v1/branch-profiles/${c.branchId}`).send(profile).expect(200)).body.data
    expect(saved).toMatchObject({ saved: true, profile: { version: 1, specialHours: [{ date: special, closed: false, opensAt: '10:00', closesAt: '14:00' }] } })
    await c.owner.post(`/v1/branch-profiles/${c.branchId}/sync`).send({ confirm: true, version: 1 }).expect(200)
    expect(google.updates).toEqual([{ location: 'locations/1234567890', description: 'Consultations and preventive screening.', specialHours: [{ date: special, closed: false, opensAt: '10:00', closesAt: '14:00' }] }])

    google.reviewsByLocation['locations/1234567890'] = [review('r1', 2, 'Holiday hours were unclear on the listing.', 30), review('r2', 5, 'Friendly staff and a short wait.', 5)]
    expect(await ctx.app.get(ReviewsWorker).runOnce()).toEqual({ replies: 0, fetched: 2 })
    // Fetched again only after 30 minutes.
    expect((await ctx.app.get(ReviewsWorker).runOnce()).fetched).toBe(0)
    const list = (await c.owner.get('/v1/reviews?rating=2').expect(200)).body
    expect(list.data).toHaveLength(1)
    expect(list.meta.sync).toMatchObject({ googleConnected: true, linkedBranches: 1 })
    const low = list.data[0]
    expect(low).toMatchObject({ reviewerName: 'Visitor r1', rating: 2, responseState: 'none' })

    await c.owner.put(`/v1/reviews/${low.id}/response`).send({ text: 'Sorry about that. Call us on 98480 22110 to discuss.' }).expect(200)
    expect((await c.owner.post(`/v1/reviews/${low.id}/response/submit`).send({ version: 1 }).expect(422)).body.error.code).toBe('PRIVACY_CHECK')
    await c.owner.put(`/v1/reviews/${low.id}/response`).send({ text: 'Thank you for telling us. We have updated our holiday hours on the listing.', version: 1 }).expect(200)
    await c.owner.post(`/v1/reviews/${low.id}/response/submit`).send({ version: 2 }).expect(200)
    expect((await c.owner.post(`/v1/reviews/${low.id}/response/decision`).send({ decision: 'approve', version: 3 }).expect(403)).body.error.code).toBe('SECOND_PERSON_REQUIRED')
    expect((await c.second.post(`/v1/reviews/${low.id}/response/decision`).send({ decision: 'approve', version: 3 }).expect(200)).body.data.responseState).toBe('posting')

    expect((await ctx.app.get(ReviewsWorker).runOnce()).replies).toBe(1)
    expect(google.replies).toEqual([{ location: 'locations/1234567890', reviewId: 'r1', comment: 'Thank you for telling us. We have updated our holiday hours on the listing.' }])
    const replied = (await c.owner.get(`/v1/reviews/${low.id}`).expect(200)).body.data
    expect(replied).toMatchObject({ responseState: 'replied', publicReply: 'Thank you for telling us. We have updated our holiday hours on the listing.', response: { status: 'posted', approvedBy: 'Priya Nair' } })

    await c.second.post(`/v1/reviews/${low.id}/notes`).send({ text: 'Check the holiday listing every December.' }).expect(201)
    const owners = (await c.owner.get('/v1/reviews/escalations/owners').expect(200)).body.data
    const escalation = (await c.owner.post('/v1/reviews/escalations').send({ reviewId: low.id, topic: 'Holiday hours unclear', severity: 'medium', ownerMembershipId: owners[0].membershipId, dueDate: today(), dueTime: '00:01' }).expect(201)).body.data
    expect(escalation).toMatchObject({ code: 'ESC-0001', status: 'open', overdue: true })
    const resolved = (await c.second.patch(`/v1/reviews/escalations/${escalation.id}`).send({ topic: 'Holiday hours unclear', severity: 'medium', ownerMembershipId: owners[0].membershipId, dueDate: today(), dueTime: '00:01', status: 'resolved', note: 'Listing corrected.', version: 1 }).expect(200)).body.data
    expect(resolved).toMatchObject({ status: 'resolved', overdue: false })
    expect(resolved.resolvedAt).not.toBeNull()

    const report = (await c.owner.get(`/v1/reviews/report?from=${addDays(today(), -7)}&to=${today()}`).expect(200)).body.data
    expect(report).toMatchObject({ total: 2, average: 3.5, replied: 1, escalations: { total: 1, open: 0, overdue: 0 } })
    expect(report.distribution).toEqual([{ star: 5, count: 1 }, { star: 4, count: 0 }, { star: 3, count: 0 }, { star: 2, count: 1 }, { star: 1, count: 0 }])
  }, SLOW)

  it('asks every completed visit for a review with the branch link, and skips branches without one', async () => {
    const c = await clinic()
    await c.owner.put('/v1/messaging/channels/whatsapp').send({ phoneNumberId: '109876543210', accessToken: 'EAAG-live-token', appSecret: 'meta-app-secret' }).expect(200)
    const body = 'Hello {{preferred_name}}, thank you for visiting. If you would like to, you can share honest feedback here: {{review_link}}'
    const draft = (await c.owner.post('/v1/messaging/templates').send({ name: 'Honest feedback request', category: 'Review request', channel: 'whatsapp', locale: 'en', body }).expect(201)).body.data
    const template = (await c.owner.patch(`/v1/messaging/templates/${draft.id}`).send({ name: 'Honest feedback request', category: 'Review request', channel: 'whatsapp', locale: 'en', body, status: 'approved', providerRef: 'feedback_v1', changeNote: 'Approved by Meta', version: 1 }).expect(200)).body.data

    const owner = await ctx.prisma.user.findFirstOrThrow({ where: { email: 'owner@aura.test' }, select: { id: true } })
    const members = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data
    const doctor = (await c.owner.post('/v1/practitioners').send({ membershipId: members[0].membershipId, displayName: 'Dr. Rahul Mehta', credentials: 'MD', specialty: 'Physiotherapy', department: 'Rehab', room: '104', slotMinutes: 30 }).expect(201)).body.data
    const patient = (await c.owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: c.branchId }).expect(201)).body.data
    await c.owner.post('/v1/messaging/consents').send({ channel: 'whatsapp', address: '9845211029', status: 'granted', source: 'written_form' }).expect(201)
    await ctx.prisma.appointment.create({
      data: { orgId: c.orgId, reference: 'APT-900010', patientId: patient.id, practitionerId: doctor.id, branchId: c.branchId, startsAt: new Date(Date.now() - 5 * HOUR), endsAt: new Date(Date.now() - 4.5 * HOUR), type: 'consultation', status: 'completed', channel: 'reception', reason: 'Review', bookedById: owner.id },
    })

    const flow = (await c.owner.post('/v1/workflows').send({ name: 'Feedback request', trigger: 'review_request', delayHours: 2, branchId: c.branchId, templateId: template.id, ownerMembershipId: c.ownerId }).expect(201)).body.data
    expect(flow.eventVariables).toEqual(['appointment_date', 'appointment_time', 'review_link'])
    await c.owner.post(`/v1/workflows/${flow.id}/activate`).send({ version: 1, confirm: true }).expect(200)
    await ctx.prisma.workflow.update({ where: { id: flow.id }, data: { activatedAt: new Date(Date.now() - 6 * HOUR) } })

    // No review link yet: the visit is recorded as skipped, with the reason.
    await ctx.app.get(GrowthWorker).runOnce()
    const skipped = (await c.owner.get(`/v1/workflows/runs?workflowId=${flow.id}`).expect(200)).body.data
    expect(skipped).toEqual([expect.objectContaining({ outcome: 'skipped', skipReason: 'NO_REVIEW_LINK', skipLabel: 'Branch has no review link' })])

    await c.owner.put(`/v1/branch-profiles/${c.branchId}`).send({ businessName: 'Aura Health', street: 'Plot 42', city: 'Hyderabad', state: 'Telangana', postalCode: '500033', primaryCategory: 'Medical clinic', reviewUrl: 'https://g.page/r/aura-main/review' }).expect(200)
    await ctx.prisma.workflowRun.deleteMany({ where: { workflowId: flow.id } })
    await ctx.app.get(GrowthWorker).runOnce()
    await ctx.app.get(OutboxWorker).runOnce()
    expect(whatsapp.sent).toHaveLength(1)
    expect(whatsapp.sent[0]!.template).toMatchObject({ ref: 'feedback_v1', parameters: ['Ananya', 'https://g.page/r/aura-main/review'] })
    expect(whatsapp.sent[0]!.body).toBe('Hello Ananya, thank you for visiting. If you would like to, you can share honest feedback here: https://g.page/r/aura-main/review')
  }, SLOW)
})
