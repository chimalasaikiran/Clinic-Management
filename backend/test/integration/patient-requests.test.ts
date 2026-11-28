import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SmsSender } from '../../src/common/sms/sms.service'
import { createOwner, PASSWORD, resetState, signIn, startApp, stopApp, TestContext } from './helpers'

class CaptureSmsSender extends SmsSender {
  private readonly codes = new Map<string, string>()

  async sendCode(mobile: string, code: string) {
    this.codes.set(mobile, code)
  }

  code(mobile: string) {
    const code = this.codes.get(mobile)
    if (!code) throw new Error(`No code sent to ${mobile}`)
    return code
  }
}

const sms = new CaptureSmsSender()
let ctx: TestContext

beforeAll(async () => {
  ctx = await startApp([{ provide: SmsSender, useValue: sms }])
})
beforeEach(() => resetState(ctx))
afterAll(() => stopApp(ctx))

const MOBILE = '9876543210'
const BIRTH = '1992-04-18'
const PARACETAMOL = { medicineCode: 'paracetamol', name: 'Paracetamol', strength: '500 mg', form: 'Tablet', route: 'Oral', drugClass: null, dose: 1, frequency: 'Thrice daily (1-1-1)', frequencyPerDay: 3, food: 'After food', durationDays: 5, indication: 'Fever' }

function phone(token: string) {
  const call = (method: 'get' | 'post', url: string) => request(ctx.app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`)
  return { get: (url: string) => call('get', url), post: (url: string) => call('post', url) }
}

async function signUp(mobile: string, dateOfBirth: string, fullName = 'Ananya Sharma') {
  const anon = request(ctx.app.getHttpServer())
  await anon.post('/v1/patient/auth/otp/request').send({ mobile }).expect(202)
  const verified = await anon.post('/v1/patient/auth/otp/verify').send({ mobile, code: sms.code(mobile), deviceName: 'Test phone' }).expect(200)
  const res = await anon.post('/v1/patient/auth/register').send({ registrationToken: verified.body.data.registrationToken, fullName, email: 'ananya@example.com', password: 'Patient#2026' }).expect(201)
  const token = res.body.data.token as string
  await request(ctx.app.getHttpServer()).patch('/v1/patient/me').set('Authorization', `Bearer ${token}`).send({ dateOfBirth }).expect(200)
  return token
}

// A listed clinic, a patient record the app account on MOBILE / BIRTH connects to, and an active prescription.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: typeof browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
  })
  const staff = as(browser)
  const branchId = (await staff.get('/v1/branches').expect(200)).body.data[0].id as string
  await ctx.prisma.branch.update({ where: { id: branchId }, data: { listedInPatientApp: true } })
  const patient = (await staff.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: MOBILE, pinCode: '500084', dateOfBirth: BIRTH, gender: 'female', homeBranchId: branchId }).expect(201)).body.data
  const rx = (await staff.post(`/v1/patients/${patient.id}/prescriptions`).send({ branchId, indication: 'Fever', items: [PARACETAMOL] }).expect(201)).body.data
  // A member who can only see patients: the front desk without pharmacy or clinical rights.
  const member = async (email: string, role: string) => {
    const roles = (await staff.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    await staff.post('/v1/invitations').send({ email, roleIds: [roles.find((entry) => entry.name === role)!.id] }).expect(201)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: 'Ravi Kumar', password: PASSWORD }).expect(201)
    const other = ctx.browser()
    await signIn(other, email)
    return as(other)
  }
  return { staff, orgId, branchId, patient, rx, member }
}

describe('refill requests', () => {
  it('goes from the app to the pharmacy queue and back with the decision', async () => {
    const c = await clinic()
    const token = await signUp(MOBILE, BIRTH)

    const asked = (await phone(token).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({ note: 'Running out on Friday.' }).expect(201)).body.data
    expect(asked).toMatchObject({ status: 'requested', note: 'Running out on Friday.' })
    expect((await phone(token).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({}).expect(409)).body.error.code).toBe('REFILL_PENDING')
    expect((await phone(token).get(`/v1/patient/prescriptions/${c.rx.id}`).expect(200)).body.data).toMatchObject({ refill: { status: 'requested' }, canRequestRefill: false })

    const queue = (await c.staff.get('/v1/refill-requests').expect(200)).body
    expect(queue.meta.waiting).toBe(1)
    expect(queue.data[0]).toMatchObject({ id: asked.id, patient: { fullName: 'Ananya Sharma' }, prescription: { reference: c.rx.reference }, note: 'Running out on Friday.' })
    expect((await c.staff.get('/v1/notifications').expect(200)).body.data[0]).toMatchObject({ title: 'New refill request', entityType: 'refill_request', entityId: asked.id })

    expect((await c.staff.post(`/v1/refill-requests/${asked.id}/decision`).send({ decision: 'decline', version: 1 }).expect(400)).body.error.code).toBe('VALIDATION_FAILED')
    const declined = (await c.staff.post(`/v1/refill-requests/${asked.id}/decision`).send({ decision: 'decline', note: 'Please book a review before more is given.', version: 1 }).expect(200)).body.data
    expect(declined).toMatchObject({ status: 'declined', decidedBy: 'Siddharth Verma' })
    expect((await c.staff.post(`/v1/refill-requests/${asked.id}/decision`).send({ decision: 'approve', version: 1 }).expect(409)).body.error.code).toBe('REFILL_CHANGED')

    const seen = (await phone(token).get(`/v1/patient/prescriptions/${c.rx.id}`).expect(200)).body.data
    expect(seen).toMatchObject({ refill: { status: 'declined', decisionNote: 'Please book a review before more is given.' }, canRequestRefill: true })
    expect((await phone(token).get('/v1/patient/notifications').expect(200)).body.data[0]).toMatchObject({ title: 'Refill request declined', entityType: 'prescription', entityId: c.rx.id })

    // A second request can be approved.
    const again = (await phone(token).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({}).expect(201)).body.data
    await c.staff.post(`/v1/refill-requests/${again.id}/decision`).send({ decision: 'approve', version: 1 }).expect(200)
    expect((await c.staff.get('/v1/refill-requests?status=all').expect(200)).body.data.map((row: { status: string }) => row.status).sort()).toEqual(['approved', 'declined'])
  })

  it('lets the patient cancel while waiting, and refuses stopped prescriptions', async () => {
    const c = await clinic()
    const token = await signUp(MOBILE, BIRTH)
    const asked = (await phone(token).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({}).expect(201)).body.data
    expect((await phone(token).post(`/v1/patient/refill-requests/${asked.id}/cancel`).expect(200)).body.data.status).toBe('cancelled')
    expect((await c.staff.get('/v1/refill-requests').expect(200)).body.data).toEqual([])

    await c.staff.post(`/v1/prescriptions/${c.rx.id}/discontinue`).send({ reason: 'Fever resolved, stopping.' }).expect(200)
    expect((await phone(token).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({}).expect(422)).body.error.code).toBe('PRESCRIPTION_CLOSED')
  })

  it('keeps other patients and other roles out', async () => {
    const c = await clinic()
    const mine = await signUp(MOBILE, BIRTH)
    const theirs = await signUp('9812345678', '1990-01-01', 'Ravi Kumar')
    const asked = (await phone(mine).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({}).expect(201)).body.data

    await phone(theirs).post(`/v1/patient/prescriptions/${c.rx.id}/refill-requests`).send({}).expect(404)
    await phone(theirs).post(`/v1/patient/refill-requests/${asked.id}/cancel`).expect(404)

    const desk = await c.member('desk@aura.test', 'Front Desk & Reception')
    await desk.get('/v1/refill-requests').expect(403)
    await desk.post(`/v1/refill-requests/${asked.id}/decision`).send({ decision: 'approve', version: 1 }).expect(403)
  })
})

describe('help requests', () => {
  it('opens a request to a connected clinic, and the conversation reaches both sides', async () => {
    const c = await clinic()
    const token = await signUp(MOBILE, BIRTH)
    const [link] = (await phone(token).get('/v1/patient/links').expect(200)).body.data

    const opened = (await phone(token).post('/v1/patient/support-tickets').send({ linkId: link.id, category: 'Appointments', subject: 'Wrong time shown', body: 'My appointment shows 9:00 but the desk said 9:30.' }).expect(201)).body.data
    expect(opened).toMatchObject({ reference: 'HLP-000001', status: 'open', clinicName: 'Aura Health', messages: [{ by: 'you' }] })

    const inbox = (await c.staff.get('/v1/support-tickets').expect(200)).body
    expect(inbox.meta.counts).toEqual({ open: 1, answered: 0, resolved: 0 })
    expect(inbox.data[0]).toMatchObject({ reference: 'HLP-000001', patient: { fullName: 'Ananya Sharma' } })
    expect((await c.staff.get('/v1/notifications').expect(200)).body.data[0]).toMatchObject({ title: 'New help request', entityType: 'support_ticket' })

    const replied = (await c.staff.post(`/v1/support-tickets/${opened.id}/replies`).send({ body: 'Sorry, it is 9:30. We have corrected it.' }).expect(201)).body.data
    expect(replied).toMatchObject({ status: 'answered', messages: [{ by: 'patient' }, { by: 'staff', author: 'Siddharth Verma' }] })

    const thread = (await phone(token).get(`/v1/patient/support-tickets/${opened.id}`).expect(200)).body.data
    expect(thread.status).toBe('answered')
    expect(thread.messages.map((message: { by: string }) => message.by)).toEqual(['you', 'clinic'])
    expect(JSON.stringify(thread)).not.toContain('Siddharth')

    expect((await phone(token).post(`/v1/patient/support-tickets/${opened.id}/messages`).send({ body: 'Thank you!' }).expect(201)).body.data.status).toBe('open')
    await c.staff.post(`/v1/support-tickets/${opened.id}/replies`).send({ body: 'You are welcome.', resolve: true }).expect(201)
    expect((await phone(token).post(`/v1/patient/support-tickets/${opened.id}/messages`).send({ body: 'One more thing' }).expect(409)).body.error.code).toBe('TICKET_RESOLVED')
    expect((await phone(token).get('/v1/patient/notifications').expect(200)).body.data.map((item: { title: string }) => item.title)).toEqual(['Reply to your help request', 'Reply to your help request'])

    await c.staff.post(`/v1/support-tickets/${opened.id}/status`).send({ status: 'open' }).expect(200)
    expect((await c.staff.get('/v1/support-tickets?status=open').expect(200)).body.data).toHaveLength(1)
  })

  it('keeps requests to their patient and clinic, and lets only editors reply', async () => {
    const c = await clinic()
    const mine = await signUp(MOBILE, BIRTH)
    const theirs = await signUp('9812345678', '1990-01-01', 'Ravi Kumar')
    const [link] = (await phone(mine).get('/v1/patient/links').expect(200)).body.data
    const opened = (await phone(mine).post('/v1/patient/support-tickets').send({ linkId: link.id, category: 'Other', subject: 'Question', body: 'A question about my last visit to the clinic.' }).expect(201)).body.data

    await phone(theirs).get(`/v1/patient/support-tickets/${opened.id}`).expect(404)
    expect((await phone(theirs).get('/v1/patient/support-tickets').expect(200)).body.data).toEqual([])
    await phone(theirs).post('/v1/patient/support-tickets').send({ linkId: link.id, category: 'Other', subject: 'Hijack', body: 'Trying to post to someone else’s clinic.' }).expect(404)

    const other = await createOwner(ctx, 'owner@other.test')
    await other.browser.get(`/v1/support-tickets/${opened.id}`).set('X-Org-Id', other.orgId).expect(404)

    const nurse = await c.member('nurse@aura.test', 'Nurse')
    await nurse.get('/v1/support-tickets').expect(200)
    await nurse.post(`/v1/support-tickets/${opened.id}/replies`).send({ body: 'Hello' }).expect(403)
  })
})
