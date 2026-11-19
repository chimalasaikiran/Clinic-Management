import { createHmac } from 'node:crypto'
import { firstValueFrom, take, toArray } from 'rxjs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { OutboxWorker } from '../../src/modules/messaging/outbox.worker'
import { ChannelProvider, MESSAGING_TRANSPORT, OutgoingMessage, ProviderError } from '../../src/modules/messaging/providers'
import { RealtimeEvent, RealtimeService } from '../../src/modules/messaging/realtime.service'
import { Browser, createOwner, PASSWORD, resetState, signIn, startApp, stopApp, TestContext } from './helpers'

// Stands in for Meta, MSG91 and the mail server: records what would be sent and fails on request.
class FakeProvider implements ChannelProvider {
  sent: OutgoingMessage[] = []
  next: ProviderError | null = null
  rejectVerify = false
  private count = 0

  constructor(private readonly prefix: string) {}

  async verify(_config: Record<string, string>, secrets: Record<string, string>) {
    if (this.rejectVerify || Object.values(secrets).includes('bad')) throw new ProviderError('auth', 'AUTH', 'Invalid OAuth access token.')
    return 'Aura Health · +91 40 1234 5678'
  }

  async send(_config: Record<string, string>, _secrets: Record<string, string>, message: OutgoingMessage) {
    if (this.next) {
      const error = this.next
      this.next = null
      throw error
    }
    this.sent.push(message)
    this.count += 1
    return { providerMessageId: `${this.prefix}.${this.count}` }
  }
}

const transport = { whatsapp: new FakeProvider('wamid'), sms: new FakeProvider('msg91'), email: new FakeProvider('smtp') }
const APP_SECRET = 'meta-app-secret'

let ctx: TestContext
let worker: OutboxWorker

beforeAll(async () => {
  ctx = await startApp([{ provide: MESSAGING_TRANSPORT, useValue: transport }])
  worker = ctx.app.get(OutboxWorker)
})
afterAll(async () => {
  await stopApp(ctx)
})
beforeEach(async () => {
  await resetState(ctx)
  for (const provider of Object.values(transport)) Object.assign(provider, { sent: [], next: null, rejectVerify: false })
})

async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
    delete: (url: string) => b.delete(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const ownerId = (await owner.get('/v1/leads/owners').expect(200)).body.data[0].membershipId as string
  const lead = (await owner.post('/v1/leads').send({ fullName: 'Nisha Menon', mobile: '9848022110', email: 'nisha@example.in', source: 'phone', branchId, ownerMembershipId: ownerId }).expect(201)).body.data
  return { owner, orgId, branchId, lead, as }
}

async function connectWhatsApp(c: Awaited<ReturnType<typeof clinic>>) {
  return (await c.owner.put('/v1/messaging/channels/whatsapp').send({ phoneNumberId: '109876543210', accessToken: 'EAAG-live-token', appSecret: APP_SECRET }).expect(200)).body.data
}

const template = (extra: Record<string, unknown> = {}) => ({ name: 'Follow-up check-in', category: 'Follow-up', channel: 'whatsapp', locale: 'en', body: 'Hello {{preferred_name}}, are you still looking for help with {{service_name}}?', ...extra })

// A WhatsApp webhook call signed the way Meta signs it.
function whatsappHook(token: string, payload: unknown, secret = APP_SECRET) {
  const body = JSON.stringify(payload)
  return ctx.browser().post(`/v1/webhooks/whatsapp/${token}`).set('Content-Type', 'application/json').set('X-Hub-Signature-256', `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`).send(body)
}
const statusHook = (id: string, status: string, timestamp: number) => ({ entry: [{ changes: [{ value: { statuses: [{ id, status, timestamp: String(timestamp) }] } }] }] })
const messageHook = (id: string, from: string, text: string) => ({ entry: [{ changes: [{ value: { messages: [{ id, from, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }] })

describe('messaging', () => {
  it('connects a channel with encrypted credentials that are never shown again', async () => {
    const c = await clinic()
    expect((await c.owner.get('/v1/messaging/channels').expect(200)).body.data.map((entry: { status: string }) => entry.status)).toEqual(['not_connected', 'not_connected', 'not_connected'])

    const failed = (await c.owner.put('/v1/messaging/channels/whatsapp').send({ phoneNumberId: '109876543210', accessToken: 'bad', appSecret: APP_SECRET }).expect(200)).body.data
    expect(failed).toMatchObject({ status: 'error', lastError: 'Invalid OAuth access token.' })

    // A blank secret keeps the one already saved.
    const res = await c.owner.put('/v1/messaging/channels/whatsapp').send({ phoneNumberId: '109876543210', accessToken: 'EAAG-live-token' }).expect(200)
    expect(res.body.data).toMatchObject({ status: 'connected', config: { phoneNumberId: '109876543210' }, saved: { accessToken: true, appSecret: true }, webhook: { url: expect.stringMatching(/^https:\/\/api\.clinic\.test\/v1\/webhooks\/whatsapp\//) } })
    expect(JSON.stringify(res.body)).not.toContain('EAAG-live-token')
    expect(JSON.stringify(res.body)).not.toContain(APP_SECRET)
    const stored = await ctx.prisma.messagingChannel.findFirstOrThrow({ where: { channel: 'whatsapp' } })
    expect(stored.secret).not.toContain('EAAG')

    // Meta's subscription check echoes the challenge only for the right verify token.
    const token = res.body.data.webhook.verifyToken
    expect((await ctx.browser().get(`/v1/webhooks/whatsapp/${token}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=4242`).expect(200)).text).toBe('4242')
    await ctx.browser().get(`/v1/webhooks/whatsapp/${token}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=4242`).expect(403)

    // Only organisation administrators manage channels.
    const desk = await invite(c, 'desk@aura.test', 'Front Desk & Reception')
    await desk.get('/v1/messaging/channels').expect(403)
  }, 300_000)

  it('sends an approved template only with consent, then follows provider receipts', async () => {
    const c = await clinic()
    const channel = await connectWhatsApp(c)
    const events: RealtimeEvent[] = []
    const subscription = ctx.app.get(RealtimeService).stream().subscribe((event) => events.push(event))

    await c.owner.post('/v1/messaging/templates').send(template({ body: 'Hi {{nickname}}' })).expect(422)
    const draft = (await c.owner.post('/v1/messaging/templates').send(template()).expect(201)).body.data
    expect(draft).toMatchObject({ code: 'MT-0001', status: 'draft', variables: ['preferred_name', 'service_name'] })
    expect((await c.owner.patch(`/v1/messaging/templates/${draft.id}`).send({ ...template(), status: 'approved', changeNote: 'Approved', version: 1 }).expect(422)).body.error.code).toBe('PROVIDER_REF_REQUIRED')
    const approved = (await c.owner.patch(`/v1/messaging/templates/${draft.id}`).send({ ...template(), status: 'approved', providerRef: 'follow_up_v1', changeNote: 'Approved by Meta', version: 1 }).expect(200)).body.data
    expect(approved).toMatchObject({ status: 'approved', version: 2 })

    const conversation = (await c.owner.post('/v1/conversations').send({ channel: 'whatsapp', leadId: c.lead.id }).expect(201)).body.data
    expect(conversation).toMatchObject({ number: 'CV-000001', address: '9848022110', lead: { id: c.lead.id }, consent: null, channelConnected: true })
    // Starting again reuses the same conversation.
    expect((await c.owner.post('/v1/conversations').send({ channel: 'whatsapp', leadId: c.lead.id }).expect(201)).body.data.id).toBe(conversation.id)

    const send = { templateId: draft.id, variables: { service_name: 'knee physiotherapy' } }
    expect((await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send(send).expect(422)).body.error.code).toBe('CONSENT_REQUIRED')
    await c.owner.post('/v1/messaging/consents').send({ channel: 'whatsapp', address: '+91 98480 22110', status: 'granted', source: 'verbal', note: 'Agreed on the phone', leadId: c.lead.id }).expect(201)
    expect((await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send({ templateId: draft.id }).expect(422)).body.error.code).toBe('TEMPLATE_VARIABLES_MISSING')
    expect((await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send({ body: 'Hi there' }).expect(422)).body.error.code).toBe('TEMPLATE_REQUIRED')

    const queued = (await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send(send).expect(201)).body.data
    expect(queued.messages.at(-1)).toMatchObject({ direction: 'outbound', status: 'queued', body: 'Hello Nisha, are you still looking for help with knee physiotherapy?', templateVersion: 2 })

    expect(await worker.runOnce()).toBe(1)
    expect(transport.whatsapp.sent).toEqual([{ to: '919848022110', body: 'Hello Nisha, are you still looking for help with knee physiotherapy?', subject: null, template: { ref: 'follow_up_v1', locale: 'en', parameters: ['Nisha', 'knee physiotherapy'] } }])
    const messageId = queued.messages.at(-1).id
    const status = async () => (await ctx.prisma.message.findUniqueOrThrow({ where: { id: messageId } })).status
    expect(await status()).toBe('sent')

    const now = Math.floor(Date.now() / 1000)
    await whatsappHook(channel.webhook.verifyToken, statusHook('wamid.1', 'read', now), 'wrong-secret').expect(401)
    await whatsappHook(channel.webhook.verifyToken, statusHook('wamid.1', 'read', now)).expect(200)
    // A late "delivered" does not move a read message back.
    await whatsappHook(channel.webhook.verifyToken, statusHook('wamid.1', 'delivered', now - 5)).expect(200)
    expect(await status()).toBe('read')
    expect(events.filter((event) => event.messageId === messageId).length).toBeGreaterThanOrEqual(3)
    subscription.unsubscribe()
  }, 300_000)

  it('takes in replies, allows a free-text answer for 24 hours, and honours STOP', async () => {
    const c = await clinic()
    const channel = await connectWhatsApp(c)
    const realtime = ctx.app.get(RealtimeService)
    const next = firstValueFrom(realtime.stream().pipe(take(1), toArray()))

    await whatsappHook(channel.webhook.verifyToken, messageHook('wamid.in1', '919000000002', 'Do you treat frozen shoulder?')).expect(200)
    // Meta retries webhooks; the same message is stored once.
    await whatsappHook(channel.webhook.verifyToken, messageHook('wamid.in1', '919000000002', 'Do you treat frozen shoulder?')).expect(200)
    expect((await next)[0]).toMatchObject({ type: 'conversation', branchId: null })

    const inbox = (await c.owner.get('/v1/conversations?unread=true').expect(200)).body
    expect(inbox.meta).toMatchObject({ total: 1, unread: 1, channels: { whatsapp: 'connected', sms: 'not_connected' } })
    const thread = inbox.data[0]
    expect(thread).toMatchObject({ address: '9000000002', lead: null, patient: null, unread: true, replyWindowOpen: true, preview: 'Do you treat frozen shoulder?' })

    const replied = (await c.owner.post(`/v1/conversations/${thread.id}/messages`).send({ body: 'Yes, we do. Would you like a call back?' }).expect(201)).body.data
    expect(replied.messages.map((entry: { direction: string }) => entry.direction)).toEqual(['inbound', 'outbound'])
    expect(replied.unread).toBe(false)

    // Staff link the enquiry to the right lead after checking who it is.
    const rohan = (await c.owner.post('/v1/leads').send({ fullName: 'Rohan Mehta', mobile: '9000000002', source: 'phone', branchId: c.branchId, ownerMembershipId: c.lead.owner.membershipId }).expect(201)).body.data
    const linked = (await c.owner.post(`/v1/conversations/${thread.id}/link`).send({ leadId: rohan.id, version: replied.version }).expect(200)).body.data
    expect(linked).toMatchObject({ lead: { id: rohan.id }, branch: { id: c.branchId } })
    const noted = (await c.owner.post(`/v1/conversations/${thread.id}/notes`).send({ text: 'Asked for a call after 6 pm.' }).expect(201)).body.data
    expect(noted.notes[0]).toMatchObject({ text: 'Asked for a call after 6 pm.', author: 'Siddharth Verma' })

    await whatsappHook(channel.webhook.verifyToken, messageHook('wamid.in2', '919000000002', 'STOP')).expect(200)
    const history = (await c.owner.get('/v1/messaging/consents?channel=whatsapp&address=9000000002').expect(200)).body.data
    expect(history).toMatchObject({ current: 'withdrawn', entries: [{ status: 'withdrawn', source: 'stop_reply' }] })
    expect((await c.owner.post(`/v1/conversations/${thread.id}/messages`).send({ body: 'Sorry to see you go' }).expect(422)).body.error.code).toBe('CONSENT_WITHDRAWN')
  }, 300_000)

  it('retries temporary failures, never resends an unknown outcome, and stops a channel whose credentials fail', async () => {
    const c = await clinic()
    await connectWhatsApp(c)
    const draft = (await c.owner.post('/v1/messaging/templates').send(template()).expect(201)).body.data
    await c.owner.patch(`/v1/messaging/templates/${draft.id}`).send({ ...template(), status: 'approved', providerRef: 'follow_up_v1', changeNote: 'Approved', version: 1 }).expect(200)
    await c.owner.post('/v1/messaging/consents').send({ channel: 'whatsapp', address: '9848022110', status: 'granted', source: 'written_form' }).expect(201)
    const conversation = (await c.owner.post('/v1/conversations').send({ channel: 'whatsapp', leadId: c.lead.id }).expect(201)).body.data
    const send = async () => (await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send({ templateId: draft.id, variables: { service_name: 'back pain' } }).expect(201)).body.data.messages.at(-1).id as string
    const load = (id: string) => ctx.prisma.message.findUniqueOrThrow({ where: { id } })

    const temporary = await send()
    transport.whatsapp.next = new ProviderError('retryable', 'WHATSAPP_131000', 'Service temporarily unavailable.')
    await worker.runOnce()
    expect(await load(temporary)).toMatchObject({ status: 'queued', attempts: 1, errorCode: 'WHATSAPP_131000' })
    expect((await load(temporary)).nextAttemptAt!.getTime()).toBeGreaterThan(Date.now())

    const timedOut = await send()
    await ctx.prisma.message.update({ where: { id: temporary }, data: { nextAttemptAt: new Date(Date.now() + 3_600_000) } })
    transport.whatsapp.next = new ProviderError('unknown', 'TIMEOUT', 'The provider did not answer in time.')
    await worker.runOnce()
    expect(await load(timedOut)).toMatchObject({ status: 'unknown' })
    const problems = (await c.owner.get('/v1/messaging/messages').expect(200)).body
    expect(problems.data.map((entry: { id: string }) => entry.id)).toEqual([timedOut])
    expect((await c.owner.post(`/v1/messaging/messages/${timedOut}/retry`).expect(409)).body.error.code).toBe('OUTCOME_UNKNOWN')
    await c.owner.post(`/v1/messaging/messages/${timedOut}/resolve`).send({ outcome: 'failed', note: 'Not listed in WhatsApp Manager' }).expect(200)
    expect((await c.owner.post(`/v1/messaging/messages/${timedOut}/retry`).expect(200)).body.data.status).toBe('queued')

    transport.whatsapp.next = new ProviderError('auth', 'WHATSAPP_190', 'Error validating access token.')
    await worker.runOnce()
    expect(await load(timedOut)).toMatchObject({ status: 'failed', errorCode: 'WHATSAPP_190' })
    expect((await c.owner.get('/v1/messaging/channels').expect(200)).body.data[0]).toMatchObject({ status: 'error', lastError: 'Error validating access token.' })
    expect((await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send({ templateId: draft.id, variables: { service_name: 'x' } }).expect(422)).body.error.code).toBe('CHANNEL_NOT_CONNECTED')
  }, 300_000)

  it('sends SMS through a DLT template and applies MSG91 delivery reports', async () => {
    const c = await clinic()
    const sms = (await c.owner.put('/v1/messaging/channels/sms').send({ senderId: 'AURAHC', authKey: 'msg91-key' }).expect(200)).body.data
    expect(sms).toMatchObject({ status: 'connected', webhook: { url: expect.stringContaining('/v1/webhooks/msg91/'), verifyToken: null } })
    const smsTemplate = { name: 'Appointment reminder', category: 'Reminder', channel: 'sms', locale: 'en', body: 'Dear {{preferred_name}}, your appointment is on {{appointment_date}}.' }
    const created = (await c.owner.post('/v1/messaging/templates').send(smsTemplate).expect(201)).body.data
    await c.owner.patch(`/v1/messaging/templates/${created.id}`).send({ ...smsTemplate, status: 'approved', providerRef: '1107161234567890123', changeNote: 'DLT approved', version: 1 }).expect(200)
    await c.owner.post('/v1/messaging/consents').send({ channel: 'sms', address: '9848022110', status: 'granted', source: 'web_form' }).expect(201)
    const conversation = (await c.owner.post('/v1/conversations').send({ channel: 'sms', leadId: c.lead.id }).expect(201)).body.data
    const sent = (await c.owner.post(`/v1/conversations/${conversation.id}/messages`).send({ templateId: created.id, variables: { appointment_date: '22 Nov 2026' } }).expect(201)).body.data
    await worker.runOnce()
    expect(transport.sms.sent[0]).toMatchObject({ to: '919848022110', template: { ref: '1107161234567890123', parameters: ['Nisha', '22 Nov 2026'] } })

    const token = sms.webhook.url.split('/').at(-1)
    await ctx.browser().post('/v1/webhooks/msg91/not-a-token').send([{ requestId: 'msg91.1', status: '1' }]).expect(404)
    expect((await ctx.browser().post(`/v1/webhooks/msg91/${token}`).send([{ requestId: 'msg91.1', status: '1', number: '919848022110' }]).expect(200)).body.data).toEqual({ received: 1 })
    expect((await ctx.prisma.message.findUniqueOrThrow({ where: { id: sent.messages.at(-1).id } })).status).toBe('delivered')
  }, 300_000)

  it('limits conversations to what each role may see and do', async () => {
    const c = await clinic()
    const channel = await connectWhatsApp(c)
    const linked = (await c.owner.post('/v1/conversations').send({ channel: 'whatsapp', leadId: c.lead.id }).expect(201)).body.data
    await whatsappHook(channel.webhook.verifyToken, messageHook('wamid.in9', '919000000009', 'Hello')).expect(200)

    // Front desk can triage conversations at their branch but not send; one not tied to a branch is not theirs.
    const desk = await invite(c, 'desk@aura.test', 'Front Desk & Reception')
    const seen = (await desk.get('/v1/conversations').expect(200)).body.data
    expect(seen.map((entry: { id: string }) => entry.id)).toEqual([linked.id])
    await desk.post(`/v1/conversations/${linked.id}/messages`).send({ body: 'Hi' }).expect(403)
    expect((await desk.patch(`/v1/conversations/${linked.id}`).send({ status: 'resolved', version: linked.version }).expect(200)).body.data.status).toBe('resolved')

    const clinician = await invite(c, 'doc@aura.test', 'Clinician')
    await clinician.get('/v1/conversations').expect(403)
    // The stream needs the same permission; EventSource passes the organisation in the address.
    await clinician.get(`/v1/messaging/stream?orgId=${c.orgId}`).expect(403)
  }, 300_000)
})

async function invite(c: Awaited<ReturnType<typeof clinic>>, email: string, roleName: string) {
  const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.owner.post('/v1/invitations').send({ email, roleIds: [roles.find((role) => role.name === roleName)!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: roleName, password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, email)
  return c.as(browser)
}
