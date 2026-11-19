import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GrowthWorker } from '../../src/modules/campaigns/growth.worker'
import { OutboxWorker } from '../../src/modules/messaging/outbox.worker'
import { ChannelProvider, MESSAGING_TRANSPORT, OutgoingMessage } from '../../src/modules/messaging/providers'
import { addDays, localDate } from '../../src/modules/scheduling/clinic-time'
import { Browser, createOwner, resetState, startApp, stopApp, TestContext } from './helpers'

// Stands in for Meta, MSG91 and the mail server.
class FakeProvider implements ChannelProvider {
  sent: OutgoingMessage[] = []
  async verify() {
    return 'Aura Health'
  }
  async send(_config: Record<string, string>, _secrets: Record<string, string>, message: OutgoingMessage) {
    this.sent.push(message)
    return { providerMessageId: `wamid.${this.sent.length}` }
  }
}

const transport = { whatsapp: new FakeProvider(), sms: new FakeProvider(), email: new FakeProvider() }
const HOUR = 3_600_000
// Each test makes dozens of requests against the remote test database.
const SLOW = 300_000

let ctx: TestContext
let growth: GrowthWorker
let outbox: OutboxWorker

beforeAll(async () => {
  ctx = await startApp([{ provide: MESSAGING_TRANSPORT, useValue: transport }])
  growth = ctx.app.get(GrowthWorker)
  outbox = ctx.app.get(OutboxWorker)
  // Quiet hours are tested in the unit tests; here the worker runs whatever the time of day.
  vi.spyOn(growth, 'isQuiet').mockReturnValue(false)
})
afterAll(async () => {
  await stopApp(ctx)
})
beforeEach(async () => {
  await resetState(ctx)
  for (const provider of Object.values(transport)) provider.sent = []
})

const PATIENT = { title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', city: 'Hyderabad', state: 'Telangana' }
const today = () => localDate(new Date(), 'Asia/Kolkata')

async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const ownerId = (await owner.get('/v1/campaigns/owners').expect(200)).body.data[0].membershipId as string
  const lead = (fields: Record<string, unknown>) => owner.post('/v1/leads').send({ source: 'website', branchId, ownerMembershipId: ownerId, confirmedNotDuplicate: true, ...fields }).expect(201).then((res) => res.body.data)
  const consent = (address: string, status: 'granted' | 'withdrawn', channel = 'whatsapp') => owner.post('/v1/messaging/consents').send({ channel, address, status, source: 'written_form' }).expect(201)
  return { owner, orgId, branchId, ownerId, lead, consent }
}

type Clinic = Awaited<ReturnType<typeof clinic>>

async function whatsappReady(c: Clinic, body = 'Hello {{preferred_name}}, our {{service_name}} camp runs this week at {{clinic_name}}.', category = 'Follow-up') {
  await c.owner.put('/v1/messaging/channels/whatsapp').send({ phoneNumberId: '109876543210', accessToken: 'EAAG-live-token', appSecret: 'meta-app-secret' }).expect(200)
  const draft = (await c.owner.post('/v1/messaging/templates').send({ name: 'Camp invite', category, channel: 'whatsapp', locale: 'en', body }).expect(201)).body.data
  return (await c.owner.patch(`/v1/messaging/templates/${draft.id}`).send({ name: 'Camp invite', category, channel: 'whatsapp', locale: 'en', body, status: 'approved', providerRef: 'camp_invite_v1', changeNote: 'Approved by Meta', version: 1 }).expect(200)).body.data
}

const campaignBody = (c: Clinic, extra: Record<string, unknown> = {}) => ({
  name: 'Knee care camp', objective: 'Knee pain enquiries', channel: 'whatsapp', status: 'active', branchId: c.branchId, ownerMembershipId: c.ownerId, budget: 20000,
  startDate: today(), endDate: addDays(today(), 30), cta: 'Book a screening', landingUrl: 'https://aura.example/knee', ...extra,
})

const leadRules = { include: 'leads', leadStages: ['new', 'contacted', 'qualified'] }

describe('audiences', () => {
  it('counts leads and patients live and shows who each channel can reach after consent', async () => {
    const c = await clinic()
    await c.lead({ fullName: 'Nisha Menon', mobile: '9848022110', email: 'nisha@example.in', interest: 'Knee pain' })
    await c.lead({ fullName: 'Rohan Mehta', mobile: '9000000002', interest: 'Knee pain', source: 'phone' })
    await c.lead({ fullName: 'Kiran Rao', mobile: '9000000003', interest: 'Back pain' })
    await c.owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId }).expect(201)
    await c.consent('9848022110', 'granted')
    await c.consent('9000000002', 'granted')
    await c.consent('9000000002', 'withdrawn')

    const knee = (await c.owner.post('/v1/audiences/count').send({ branchId: c.branchId, rules: { ...leadRules, leadInterest: 'knee' } }).expect(200)).body.data
    expect(knee).toMatchObject({ leads: 2, patients: 0 })
    expect(knee.channels.whatsapp).toEqual({ addresses: 2, reachable: 1, optedOut: 1, noConsent: 0, noAddress: 0 })
    expect(knee.channels.email).toEqual({ addresses: 1, reachable: 0, optedOut: 0, noConsent: 1, noAddress: 1 })

    const both = (await c.owner.post('/v1/audiences/count').send({ branchId: null, rules: { include: 'both', leadStages: ['new'], patientMinAge: 30, patientGender: 'female' } }).expect(200)).body.data
    expect(both).toMatchObject({ leads: 3, patients: 1 })
    const young = (await c.owner.post('/v1/audiences/count').send({ branchId: null, rules: { include: 'patients', patientMaxAge: 25 } }).expect(200)).body.data
    expect(young.patients).toBe(0)

    const bad = await c.owner.post('/v1/audiences/count').send({ rules: { include: 'leads', leadStages: [] } }).expect(400)
    expect(bad.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'rules.leadStages' })]))
  }, SLOW)

  it('keeps an append-only history of rule changes, each with a reason', async () => {
    const c = await clinic()
    const created = (await c.owner.post('/v1/audiences').send({ name: 'Knee enquiries', purpose: 'Knee camp invitations', branchId: c.branchId, rules: leadRules }).expect(201)).body.data
    expect(created).toMatchObject({ code: 'AU-0001', status: 'draft', version: 1 })
    expect(created.description).toEqual(['Leads at New, Contacted, Qualified'])

    const update = { name: 'Knee enquiries', purpose: 'Knee camp invitations', branchId: c.branchId, status: 'ready', rules: { ...leadRules, leadInterest: 'knee' }, version: 1 }
    expect((await c.owner.patch(`/v1/audiences/${created.id}`).send(update).expect(422)).body.error.code).toBe('CHANGE_NOTE_REQUIRED')
    const changed = (await c.owner.patch(`/v1/audiences/${created.id}`).send({ ...update, changeNote: 'Only knee interest' }).expect(200)).body.data
    expect(changed.versions.map((entry: { version: number; changeNote: string }) => [entry.version, entry.changeNote])).toEqual([[2, 'Only knee interest'], [1, 'Audience created.']])
    // Renaming without touching the rules adds no history entry.
    const renamed = (await c.owner.patch(`/v1/audiences/${created.id}`).send({ ...update, name: 'Knee camp', version: 2 }).expect(200)).body.data
    expect(renamed).toMatchObject({ name: 'Knee camp', version: 3 })
    expect(renamed.versions).toHaveLength(2)
    await c.owner.patch(`/v1/audiences/${created.id}`).send({ ...update, version: 1 }).expect(409)
  }, SLOW)
})

describe('campaigns', () => {
  it('records budget and status changes with reasons, spend entries, and attributes tagged leads', async () => {
    const c = await clinic()
    const campaign = (await c.owner.post('/v1/campaigns').send(campaignBody(c, { status: 'draft' })).expect(201)).body.data
    expect(campaign).toMatchObject({ code: 'CMP-0001', budget: 20000, spent: 0, leadCount: 0 })

    const change = { ...campaignBody(c), budget: 25000, version: 1 }
    expect((await c.owner.patch(`/v1/campaigns/${campaign.id}`).send(change).expect(422)).body.error.code).toBe('CHANGE_NOTE_REQUIRED')
    const updated = (await c.owner.patch(`/v1/campaigns/${campaign.id}`).send({ ...change, changeNote: 'Extra week of ads' }).expect(200)).body.data
    expect(updated.events[0].text).toBe('Status: Draft → Active; Budget: ₹20,000 → ₹25,000. Reason: Extra week of ads')

    const spent = (await c.owner.post(`/v1/campaigns/${campaign.id}/spend`).send({ spentOn: today(), amount: 4200.5, note: 'Meta invoice 1182' }).expect(201)).body.data
    await c.owner.post(`/v1/campaigns/${campaign.id}/spend`).send({ spentOn: today(), amount: 0, note: 'x' }).expect(400)
    expect(spent.spent).toBe(4200.5)

    const tagged = await c.lead({ fullName: 'Nisha Menon', mobile: '9848022110', campaignId: campaign.id })
    expect(tagged.campaign).toMatchObject({ code: 'CMP-0001' })
    expect(tagged.activities[0].text).toContain('Recorded against campaign CMP-0001')
    await c.lead({ fullName: 'Rohan Mehta', mobile: '9000000002' })

    // The tag is part of the original source: it cannot be moved to another campaign.
    const other = (await c.owner.post('/v1/campaigns').send(campaignBody(c, { name: 'Back care' })).expect(201)).body.data
    const edit = { fullName: tagged.fullName, mobile: tagged.mobile, email: null, interest: null, branchId: c.branchId, ownerMembershipId: c.ownerId, stage: 'contacted', version: tagged.version }
    expect((await c.owner.patch(`/v1/leads/${tagged.id}`).send({ ...edit, campaignId: other.id }).expect(422)).body.error.code).toBe('CAMPAIGN_LOCKED')
    expect((await c.owner.patch(`/v1/leads/${tagged.id}`).send({ ...edit, campaignId: null }).expect(200)).body.data.campaign.code).toBe('CMP-0001')

    const patient = (await c.owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId }).expect(201)).body.data
    const current = (await c.owner.get(`/v1/leads/${tagged.id}`).expect(200)).body.data
    await c.owner.post(`/v1/leads/${tagged.id}/convert`).send({ patientId: patient.id, version: current.version }).expect(200)

    const detail = (await c.owner.get(`/v1/campaigns/${campaign.id}`).expect(200)).body.data
    expect(detail.attribution).toMatchObject({ leads: 1, converted: 1, booked: 0, consulted: 0, revenue: 0 })
    const list = (await c.owner.get('/v1/campaigns').expect(200)).body.data
    expect(list.find((entry: { id: string }) => entry.id === campaign.id)).toMatchObject({ leadCount: 1, converted: 1, spent: 4200.5 })

    const performance = (await c.owner.get(`/v1/leads/performance?from=${today()}&to=${today()}`).expect(200)).body.data
    expect(performance.byCampaign).toEqual([expect.objectContaining({ code: 'CMP-0001', total: 1, converted: 1 })])
    expect(performance.untagged).toBe(1)
  }, SLOW)

  it('broadcasts an approved template to the reachable audience once, skipping opt-outs and people without permission', async () => {
    const c = await clinic()
    const template = await whatsappReady(c)
    await c.lead({ fullName: 'Nisha Menon', mobile: '9848022110' })
    await c.lead({ fullName: 'Rohan Mehta', mobile: '9000000002' })
    await c.lead({ fullName: 'Kiran Rao', mobile: '9000000003' })
    await c.consent('9848022110', 'granted')
    await c.consent('9000000002', 'granted')
    await c.consent('9000000002', 'withdrawn')
    const audience = (await c.owner.post('/v1/audiences').send({ name: 'All new leads', purpose: 'Camp invitations', branchId: c.branchId, status: 'ready', rules: { include: 'leads', leadStages: ['new'] } }).expect(201)).body.data
    const campaign = (await c.owner.post('/v1/campaigns').send(campaignBody(c, { audienceId: audience.id })).expect(201)).body.data

    const preview = (await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts/preview`).send({ templateId: template.id, variables: { service_name: 'knee screening' } }).expect(200)).body.data
    expect(preview).toMatchObject({ members: 3, addresses: 3, reachable: 1, missingVariables: [], channelConnected: true })
    expect(preview.skipped).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'CONSENT_WITHDRAWN', count: 1 }), expect.objectContaining({ reason: 'CONSENT_REQUIRED', count: 1 })]))
    expect(preview.sample).toBe('Hello Nisha, our knee screening camp runs this week at Aura Health.')

    const launch = { templateId: template.id, variables: { service_name: 'knee screening' }, confirm: true }
    expect((await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts`).send({ ...launch, variables: {}, expectedRecipients: 1 }).expect(422)).body.error.code).toBe('TEMPLATE_VARIABLES_MISSING')
    // Someone gave permission after the preview: the confirmed number no longer matches.
    await c.consent('9000000003', 'granted')
    expect((await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts`).send({ ...launch, expectedRecipients: 1 }).expect(409)).body.error.code).toBe('AUDIENCE_CHANGED')
    const broadcast = (await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts`).send({ ...launch, expectedRecipients: 2 }).expect(201)).body.data
    expect(broadcast).toMatchObject({ status: 'scheduled', expectedRecipients: 2 })

    expect(await growth.runOnce()).toMatchObject({ broadcasts: 1 })
    expect(await growth.runOnce()).toMatchObject({ broadcasts: 0 })
    await outbox.runOnce()
    expect(transport.whatsapp.sent.map((message) => message.to).sort()).toEqual(['919000000003', '919848022110'])
    expect(transport.whatsapp.sent[0]!.template).toMatchObject({ ref: 'camp_invite_v1' })

    const after = (await c.owner.get(`/v1/campaigns/${campaign.id}`).expect(200)).body.data
    expect(after.broadcasts[0]).toMatchObject({ status: 'completed', queuedCount: 2, skippedCount: 1, messages: { sent: 2 } })
    expect(after.broadcasts[0].skipped).toEqual([expect.objectContaining({ reason: 'CONSENT_WITHDRAWN', count: 1 })])
    expect(after.events[0].text).toBe('Broadcast finished: 2 queued, 1 skipped.')
    const messages = await ctx.prisma.message.findMany({ select: { origin: true } })
    expect(messages.map((message) => message.origin)).toEqual(['broadcast', 'broadcast'])

    // Both have had one automated message this week: a limit of 2 still reaches them, a limit of 1 reaches nobody.
    const capped = (await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts/preview`).send({ templateId: template.id, variables: { service_name: 'knee screening' } }).expect(200)).body.data
    expect(capped.reachable).toBe(2)
    await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts`).send({ ...launch, expectedRecipients: 2, weeklyCap: 1 }).expect(409)
  }, SLOW)

  it('stops a confirmed broadcast when the audience rules change before it runs', async () => {
    const c = await clinic()
    const template = await whatsappReady(c)
    await c.lead({ fullName: 'Nisha Menon', mobile: '9848022110' })
    await c.consent('9848022110', 'granted')
    const rules = { include: 'leads', leadStages: ['new'] }
    const audience = (await c.owner.post('/v1/audiences').send({ name: 'New leads', purpose: 'Invites', branchId: c.branchId, status: 'ready', rules }).expect(201)).body.data
    const campaign = (await c.owner.post('/v1/campaigns').send(campaignBody(c, { audienceId: audience.id })).expect(201)).body.data
    await c.owner.post(`/v1/campaigns/${campaign.id}/broadcasts`).send({ templateId: template.id, variables: { service_name: 'knee' }, expectedRecipients: 1, confirm: true }).expect(201)
    await c.owner.patch(`/v1/audiences/${audience.id}`).send({ name: 'New leads', purpose: 'Invites', branchId: c.branchId, status: 'ready', rules: { ...rules, leadStages: ['new', 'contacted'] }, changeNote: 'Wider', version: 1 }).expect(200)

    await growth.runOnce()
    const after = (await c.owner.get(`/v1/campaigns/${campaign.id}`).expect(200)).body.data
    expect(after.broadcasts[0]).toMatchObject({ status: 'cancelled', queuedCount: 0 })
    expect(after.events[0].text).toContain('the audience changed after it was confirmed')
    expect(await ctx.prisma.message.count()).toBe(0)
  }, SLOW)
})

describe('workflows', () => {
  async function workflow(c: Clinic, templateId: string | null, extra: Record<string, unknown> = {}) {
    return (await c.owner.post('/v1/workflows').send({ name: 'Enquiry nudge', trigger: 'lead_not_booked', delayHours: 48, branchId: c.branchId, templateId, ownerMembershipId: c.ownerId, ...extra }).expect(201)).body.data
  }

  it('switches on only when ready, acts once per lead due after it was switched on, and skips closed leads', async () => {
    const c = await clinic()
    const draft = await workflow(c, null)
    expect(draft.problems).toEqual(['Choose a message template.'])
    expect((await c.owner.post(`/v1/workflows/${draft.id}/activate`).send({ version: 1, confirm: true }).expect(422)).body.error.code).toBe('WORKFLOW_NOT_READY')

    const template = await whatsappReady(c)
    const ready = (await c.owner.patch(`/v1/workflows/${draft.id}`).send({ name: 'Enquiry nudge', trigger: 'lead_not_booked', delayHours: 48, branchId: c.branchId, templateId: template.id, ownerMembershipId: c.ownerId, version: 1 }).expect(200)).body.data
    expect(ready.problems).toEqual([])
    const active = (await c.owner.post(`/v1/workflows/${draft.id}/activate`).send({ version: 2, confirm: true }).expect(200)).body.data
    expect(active.status).toBe('active')
    expect((await c.owner.patch(`/v1/workflows/${draft.id}`).send({ name: 'Changed', trigger: 'lead_not_booked', delayHours: 24, branchId: c.branchId, templateId: template.id, ownerMembershipId: c.ownerId, version: 3 }).expect(409)).body.error.code).toBe('WORKFLOW_ACTIVE')

    const due = await c.lead({ fullName: 'Nisha Menon', mobile: '9848022110', interest: 'knee physiotherapy' })
    const old = await c.lead({ fullName: 'Rohan Mehta', mobile: '9000000002', interest: 'back pain' })
    const closed = await c.lead({ fullName: 'Kiran Rao', mobile: '9000000003', interest: 'shoulder' })
    // Recorded just now: not due for another 48 hours.
    await c.lead({ fullName: 'Asha Pillai', mobile: '9000000004', interest: 'shoulder' })
    for (const address of ['9848022110', '9000000002', '9000000003']) await c.consent(address, 'granted')
    // Switched on 10 hours ago: Nisha's 48 hours ran out 2 hours ago (after switching on); Rohan's ran out before it.
    const now = Date.now()
    await ctx.prisma.workflow.update({ where: { id: draft.id }, data: { activatedAt: new Date(now - 10 * HOUR) } })
    await ctx.prisma.lead.update({ where: { id: due.id }, data: { createdAt: new Date(now - 50 * HOUR) } })
    await ctx.prisma.lead.update({ where: { id: old.id }, data: { createdAt: new Date(now - 60 * HOUR) } })
    await ctx.prisma.lead.update({ where: { id: closed.id }, data: { createdAt: new Date(now - 49 * HOUR), stage: 'closed' } })

    expect(await growth.runOnce()).toMatchObject({ workflowEvents: 2 })
    expect(await growth.runOnce()).toMatchObject({ workflowEvents: 0 })
    await outbox.runOnce()
    expect(transport.whatsapp.sent).toEqual([expect.objectContaining({ to: '919848022110', body: 'Hello Nisha, our knee physiotherapy camp runs this week at Aura Health.' })])

    const runs = (await c.owner.get(`/v1/workflows/runs?workflowId=${draft.id}`).expect(200)).body.data
    expect(runs.map((run: { lead: { fullName: string }; outcome: string; skipReason: string | null }) => [run.lead.fullName, run.outcome, run.skipReason]).sort()).toEqual([['Kiran Rao', 'skipped', 'LEAD_CLOSED'], ['Nisha Menon', 'queued', null]])
    const problems = (await c.owner.get('/v1/workflows/runs?problem=true').expect(200)).body.data
    expect(problems).toHaveLength(1)
    expect((await c.owner.get('/v1/workflows').expect(200)).body.data[0].lastWeek).toEqual({ queued: 1, skipped: 1 })
  }, SLOW)

  it('sends a no-show message with the missed appointment’s date, unless the patient has booked again', async () => {
    const c = await clinic()
    const body = 'Hello {{preferred_name}}, we missed you on {{appointment_date}} at {{appointment_time}}. Reply to rebook.'
    const template = await whatsappReady(c, body, 'Reminder')
    const owner = await ctx.prisma.user.findFirstOrThrow({ select: { id: true } })
    const members = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data
    const doctor = (await c.owner.post('/v1/practitioners').send({ membershipId: members[0].membershipId, displayName: 'Dr. Rahul Mehta', credentials: 'MD', specialty: 'Physiotherapy', department: 'Rehab', room: '104', slotMinutes: 30 }).expect(201)).body.data
    const ananya = (await c.owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId }).expect(201)).body.data
    const rajesh = (await c.owner.post('/v1/patients').send({ ...PATIENT, fullName: 'Rajesh Sundaram', mobile: '9444082910', gender: 'male', homeBranchId: c.branchId, confirmedNotDuplicate: true }).expect(201)).body.data

    // Appointments yesterday that were marked no-show 3 hours ago; Rajesh has booked again since.
    const now = Date.now()
    const missed = async (patientId: string, reference: string, hoursAgo: number) => {
      const appointment = await ctx.prisma.appointment.create({
        data: { orgId: c.orgId, reference, patientId, practitionerId: doctor.id, branchId: c.branchId, startsAt: new Date(now - hoursAgo * HOUR), endsAt: new Date(now - (hoursAgo - 0.5) * HOUR), type: 'consultation', status: 'no_show', channel: 'reception', reason: 'Review', bookedById: owner.id },
      })
      await ctx.prisma.appointmentEvent.create({ data: { appointmentId: appointment.id, action: 'no_show', fromStatus: 'confirmed', toStatus: 'no_show', actorUserId: owner.id, createdAt: new Date(now - 3 * HOUR) } })
      return appointment
    }
    await missed(ananya.id, 'APT-900001', 24)
    await missed(rajesh.id, 'APT-900002', 26)
    await ctx.prisma.appointment.create({ data: { orgId: c.orgId, reference: 'APT-900003', patientId: rajesh.id, practitionerId: doctor.id, branchId: c.branchId, startsAt: new Date(now + 48 * HOUR), endsAt: new Date(now + 48.5 * HOUR), type: 'consultation', status: 'confirmed', channel: 'phone', reason: 'Rebooked', bookedById: owner.id, createdAt: new Date(now - HOUR) } })

    const flow = await workflow(c, template.id, { name: 'No-show recovery', trigger: 'no_show', delayHours: 2 })
    expect(flow.eventVariables).toEqual(['appointment_date', 'appointment_time'])
    await c.owner.post(`/v1/workflows/${flow.id}/activate`).send({ version: 1, confirm: true }).expect(200)
    await ctx.prisma.workflow.update({ where: { id: flow.id }, data: { activatedAt: new Date(now - 4 * HOUR) } })

    // A Reminder to a patient may rely on their WhatsApp notification setting instead of a recorded opt-in.
    expect(await growth.runOnce()).toMatchObject({ workflowEvents: 2 })
    await outbox.runOnce()
    expect(transport.whatsapp.sent).toHaveLength(1)
    expect(transport.whatsapp.sent[0]!.to).toBe('919845211029')
    expect(transport.whatsapp.sent[0]!.body).toMatch(/^Hello Ananya, we missed you on \d{1,2} \w{3} 20\d\d at \d{1,2}:\d{2} (am|pm)\. Reply to rebook\.$/)
    const runs = (await c.owner.get('/v1/workflows/runs').expect(200)).body.data
    expect(runs.map((run: { skipReason: string | null }) => run.skipReason).sort()).toEqual(['ALREADY_BOOKED', null])
  }, SLOW)
})
