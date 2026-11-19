import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays, localDate } from '../../src/modules/scheduling/clinic-time'
import { Browser, createOwner, PASSWORD, resetState, signIn, startApp, stopApp, TestContext } from './helpers'

let ctx: TestContext

beforeAll(async () => {
  ctx = await startApp()
})
afterAll(async () => {
  await stopApp(ctx)
})
beforeEach(async () => {
  await resetState(ctx)
})

const today = () => localDate(new Date(), 'Asia/Kolkata')
const PATIENT = { title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', city: 'Hyderabad', state: 'Telangana' }

async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const owners = (await owner.get('/v1/leads/owners').expect(200)).body.data as Array<{ membershipId: string; name: string; branches: unknown }>
  return { owner, orgId, branchId, ownerId: owners[0]!.membershipId, owners, as }
}

async function invite(c: Awaited<ReturnType<typeof clinic>>, email: string, roleName: string) {
  const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.owner.post('/v1/invitations').send({ email, roleIds: [roles.find((role) => role.name === roleName)!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: roleName, password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, email)
  return c.as(browser)
}

const lead = (c: Awaited<ReturnType<typeof clinic>>, extra: Record<string, unknown> = {}) => ({
  fullName: 'Nisha Menon', mobile: '98480 22110', interest: 'Knee pain', source: 'phone', branchId: c.branchId, ownerMembershipId: c.ownerId, ...extra,
})

describe('leads', () => {
  it('records a lead, its follow-ups and edits, with an append-only history', async () => {
    const c = await clinic()
    expect(c.owners).toEqual([expect.objectContaining({ name: 'Siddharth Verma', branches: 'all' })])

    await c.owner.post('/v1/leads').send(lead(c, { nextDueDate: today() })).expect(400)
    const created = (await c.owner.post('/v1/leads').send(lead(c, { nextAction: 'Call back about slots', nextDueDate: addDays(today(), 1) })).expect(201)).body.data
    expect(created).toMatchObject({ number: 'LD-000001', fullName: 'Nisha Menon', mobile: '9848022110', stage: 'new', source: 'phone', dueState: 'upcoming', patient: null, owner: { membershipId: c.ownerId }, branch: { id: c.branchId } })
    expect(created.activities).toEqual([expect.objectContaining({ kind: 'created', title: 'Phone inquiry recorded', text: 'New enquiry about Knee pain.', actor: 'Siddharth Verma' })])

    // A second lead with the same mobile needs an explicit decision.
    const duplicate = await c.owner.post('/v1/leads').send(lead(c, { fullName: 'N. Menon' })).expect(409)
    expect(duplicate.body.error).toMatchObject({ code: 'POSSIBLE_DUPLICATE', details: [{ field: 'mobile', issue: 'Nisha Menon (LD-000001)' }] })
    expect((await c.owner.get('/v1/leads/duplicates?mobile=9848022110').expect(200)).body.data.map((row: { id: string }) => row.id)).toEqual([created.id])
    await c.owner.post('/v1/leads').send(lead(c, { fullName: 'Rohan Mehta', mobile: '9000000002', source: 'walk_in', stage: 'qualified' })).expect(201)

    const list = (await c.owner.get('/v1/leads?stage=new').expect(200)).body
    expect(list.data.map((row: { number: string }) => row.number)).toEqual(['LD-000001'])
    expect(list.meta).toMatchObject({ total: 1, summary: { byStage: { new: 1, qualified: 1, converted: 0 }, overdue: 0, dueToday: 0, followUpsDue: 0 } })
    expect((await c.owner.get('/v1/leads?q=rohan').expect(200)).body.data).toHaveLength(1)
    expect((await c.owner.get('/v1/leads?due=open').expect(200)).body.data).toHaveLength(1)

    // Logging a call keeps the follow-up open unless told otherwise; rescheduling moves it and says why.
    const interaction = { type: 'phone_call', occurredDate: today(), occurredTime: '00:01', outcome: 'connected', notes: 'Discussed the knee assessment.', ownerMembershipId: c.ownerId }
    const kept = (await c.owner.post(`/v1/leads/${created.id}/interactions`).send({ ...interaction, decision: 'keep', version: created.version }).expect(201)).body.data
    expect(kept.nextDueAt).toBe(created.nextDueAt)
    // The timeline runs by when things happened: the call logged for 00:01 sits below the lead's creation.
    expect(kept.activities.map((entry: { kind: string }) => entry.kind)).toEqual(['created', 'interaction'])
    expect(kept.activities[1]).toMatchObject({ kind: 'interaction', title: 'Phone call · Connected', text: 'Discussed the knee assessment. Open follow-up kept open.' })
    await c.owner.post(`/v1/leads/${created.id}/interactions`).send({ ...interaction, decision: 'keep', version: created.version }).expect(409)
    await c.owner.post(`/v1/leads/${created.id}/interactions`).send({ ...interaction, occurredDate: addDays(today(), 1), decision: 'keep', version: kept.version }).expect(422)

    const moved = (await c.owner.post(`/v1/leads/${created.id}/interactions`).send({ ...interaction, outcome: 'no_answer', notes: 'No answer.', decision: 'reschedule', nextAction: 'Try again', nextDueDate: addDays(today(), 2), nextDueTime: '15:00', reason: 'Asked to call later', version: kept.version }).expect(201)).body.data
    expect(moved).toMatchObject({ nextAction: 'Try again', dueState: 'upcoming' })
    expect(moved.activities[1].text).toMatch(/^No answer\. Follow-up rescheduled .+ → .+\. Reason: Asked to call later$/)

    const edited = (await c.owner.patch(`/v1/leads/${created.id}`).send({ ...lead(c), email: 'nisha@example.in', stage: 'qualified', version: moved.version }).expect(200)).body.data
    expect(edited.activities[0]).toMatchObject({ kind: 'updated', text: 'Email: — → nisha@example.in; Stage: New → Qualified' })
    await c.owner.patch(`/v1/leads/${created.id}`).send({ ...lead(c), stage: 'converted', version: edited.version }).expect(422)

    // Closing a lead ends its follow-up.
    const closed = (await c.owner.patch(`/v1/leads/${created.id}`).send({ ...lead(c), email: 'nisha@example.in', stage: 'closed', version: edited.version }).expect(200)).body.data
    expect(closed).toMatchObject({ stage: 'closed', nextDueAt: null, dueState: 'none' })
    expect(closed.activities.map((entry: { kind: string }) => entry.kind)).toEqual(['updated', 'updated', 'created', 'interaction', 'interaction'])
  }, 300_000)

  it('converts a lead by linking a patient or registering one, and traces later visits', async () => {
    const c = await clinic()
    const patient = (await c.owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId }).expect(201)).body.data
    const first = (await c.owner.post('/v1/leads').send(lead(c, { fullName: 'Ananya Sharma', mobile: PATIENT.mobile, nextAction: 'Call', nextDueDate: today() })).expect(201)).body.data
    const second = (await c.owner.post('/v1/leads').send(lead(c)).expect(201)).body.data

    const linked = (await c.owner.post(`/v1/leads/${first.id}/convert`).send({ patientId: patient.id, version: first.version }).expect(200)).body.data
    expect(linked).toMatchObject({ stage: 'converted', nextDueAt: null, patient: { id: patient.id, mrn: patient.mrn }, journey: { appointment: null, consultation: null } })
    expect(linked.activities[0].text).toBe(`New → Converted. Linked to patient Ananya Sharma (${patient.mrn}). Open follow-up closed. Original source kept; no appointment booked.`)
    expect((await c.owner.post(`/v1/leads/${first.id}/convert`).send({ patientId: patient.id, version: linked.version }).expect(409)).body.error.code).toBe('LEAD_ALREADY_CONVERTED')

    // Registering the new patient and converting the lead happen together: a refused conversion registers nobody.
    const fresh = { ...PATIENT, fullName: 'Nisha Menon', mobile: '9848022110', homeBranchId: c.branchId }
    await c.owner.post(`/v1/leads/${second.id}/convert/new-patient`).send({ ...fresh, leadVersion: second.version + 1 }).expect(409)
    expect((await c.owner.get('/v1/patients?query=nisha').expect(200)).body.data).toHaveLength(0)
    const registered = (await c.owner.post(`/v1/leads/${second.id}/convert/new-patient`).send({ ...fresh, leadVersion: second.version }).expect(201)).body.data
    expect(registered).toMatchObject({ stage: 'converted', patient: { fullName: 'Nisha Menon', mrn: 'PT-000002' } })
    expect(registered.activities[0].text).toMatch(/Registered as new patient Nisha Menon \(PT-000002\) and linked\./)

    // A visit booked after conversion shows up in the lead's journey and the performance funnel.
    const member = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
    const doctor = (await c.owner.post('/v1/practitioners').send({ membershipId: member, displayName: 'Dr. Rahul Mehta', specialty: 'Physiotherapy', department: 'Rehabilitation', slotMinutes: 30 }).expect(201)).body.data
    await c.owner.put(`/v1/practitioners/${doctor.id}/availability`).send({ windows: Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.branchId, weekday, start: '00:00', end: '23:30' })) }).expect(200)
    const visit = (await c.owner.post('/v1/appointments').send({ patientId: registered.patient.id, practitionerId: doctor.id, branchId: c.branchId, date: addDays(today(), 1), time: '10:00', type: 'consultation', reason: 'Knee assessment' }).expect(201)).body.data
    expect((await c.owner.get(`/v1/leads/${second.id}`).expect(200)).body.data.journey).toEqual({ appointment: { id: visit.id, reference: visit.reference, date: addDays(today(), 1), status: visit.status }, consultation: null })

    const performance = (await c.owner.get(`/v1/leads/performance?from=${today()}&to=${today()}`).expect(200)).body.data
    expect(performance).toMatchObject({ total: 2, bySource: { phone: 2, website: 0 }, byStage: { converted: 2 }, converted: 2, booked: 1, consulted: 0 })
    await c.owner.get(`/v1/leads/performance?from=${today()}&to=${addDays(today(), -1)}`).expect(400)
  }, 300_000)

  it('keeps leads to the branches and people allowed to work them', async () => {
    const c = await clinic()
    const created = (await c.owner.post('/v1/leads').send(lead(c, { nextAction: 'Call', nextDueDate: today(), nextDueTime: '00:00' })).expect(201)).body.data
    expect(created.dueState).toBe('overdue')
    expect((await c.owner.get('/v1/alerts').expect(200)).body.data.items).toEqual([{ id: 'lead_follow_ups', count: 1 }])

    // Front desk can work leads at their branch and is offered as an owner there.
    const desk = await invite(c, 'desk@aura.test', 'Front Desk & Reception')
    expect((await desk.get('/v1/leads').expect(200)).body.data).toHaveLength(1)
    const owners = (await c.owner.get(`/v1/leads/owners?branchId=${c.branchId}`).expect(200)).body.data
    expect(owners.map((owner: { name: string }) => owner.name).sort()).toEqual(['Front Desk & Reception', 'Siddharth Verma'])
    const deskOwner = owners.find((owner: { name: string }) => owner.name === 'Front Desk & Reception')
    const reassigned = (await desk.patch(`/v1/leads/${created.id}`).send({ ...lead(c), ownerMembershipId: deskOwner.membershipId, stage: 'contacted', version: created.version }).expect(200)).body.data
    expect(reassigned.owner).toEqual({ membershipId: deskOwner.membershipId, name: 'Front Desk & Reception' })

    // A clinician can neither see leads nor own one.
    const clinician = await invite(c, 'doc@aura.test', 'Clinician')
    await clinician.get('/v1/leads').expect(403)
    const roster = (await c.owner.get('/v1/members').expect(200)).body.data as Array<{ id: string; user: { email: string } }>
    const clinicianMember = roster.find((entry) => entry.user.email === 'doc@aura.test')!.id
    expect((await c.owner.patch(`/v1/leads/${created.id}`).send({ ...lead(c), ownerMembershipId: clinicianMember, stage: 'contacted', version: reassigned.version }).expect(422)).body.error.code).toBe('OWNER_NOT_ELIGIBLE')

    // Leads outside the member's branches do not exist for them.
    // Branches have no create endpoint yet, so the second one is added directly.
    const west = await ctx.prisma.branch.create({ data: { orgId: c.orgId, code: 'KDP', name: 'Kondapur Clinic', city: 'Hyderabad', state: 'Telangana' } })
    const elsewhere = (await c.owner.post('/v1/leads').send(lead(c, { mobile: '9000000003', branchId: west.id })).expect(201)).body.data
    await desk.get(`/v1/leads/${elsewhere.id}`).expect(404)
    expect((await desk.get(`/v1/leads?branchId=${west.id}`).expect(403)).body.error.code).toBe('BRANCH_OUT_OF_SCOPE')
    expect((await desk.post('/v1/leads').send(lead(c, { mobile: '9000000004', branchId: west.id, ownerMembershipId: deskOwner.membershipId })).expect(403)).body.error.code).toBe('BRANCH_OUT_OF_SCOPE')
  }, 300_000)
})
