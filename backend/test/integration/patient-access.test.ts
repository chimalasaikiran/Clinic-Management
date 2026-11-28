import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SmsSender } from '../../src/common/sms/sms.service'
import { createOwner, resetState, startApp, stopApp, TestContext } from './helpers'

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
const PASSWORD = 'Patient#2026'

// The phone app: no cookies, no Origin, a bearer token once signed in.
function phone(token?: string) {
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', url: string) => {
    const test = request(ctx.app.getHttpServer())[method](url)
    return token ? test.set('Authorization', `Bearer ${token}`) : test
  }
  return {
    get: (url: string) => call('get', url),
    post: (url: string) => call('post', url),
    patch: (url: string) => call('patch', url),
    put: (url: string) => call('put', url),
    delete: (url: string) => call('delete', url),
  }
}

async function verify(mobile: string) {
  await phone().post('/v1/patient/auth/otp/request').send({ mobile }).expect(202)
  const res = await phone().post('/v1/patient/auth/otp/verify').send({ mobile, code: sms.code(mobile), deviceName: 'Test phone' }).expect(200)
  return res.body.data
}

async function signUp(mobile: string, fullName = 'Asha Rao') {
  const verified = await verify(mobile)
  expect(verified.status).toBe('registration_required')
  const res = await phone()
    .post('/v1/patient/auth/register')
    .send({ registrationToken: verified.registrationToken, fullName, email: 'asha@example.com', password: PASSWORD })
    .expect(201)
  return res.body.data.token as string
}

async function clinic(email = 'owner@aura.test', listed = true) {
  const owner = await createOwner(ctx, email)
  const branches = await owner.browser.get('/v1/branches').set('X-Org-Id', owner.orgId).expect(200)
  const branchId = branches.body.data[0].id as string
  if (listed) await ctx.prisma.branch.update({ where: { id: branchId }, data: { listedInPatientApp: true } })
  const staff = {
    get: (url: string) => owner.browser.get(url).set('X-Org-Id', owner.orgId),
    post: (url: string) => owner.browser.post(url).set('X-Org-Id', owner.orgId),
    delete: (url: string) => owner.browser.delete(url).set('X-Org-Id', owner.orgId),
  }
  const addPatient = async (fullName: string, dateOfBirth: string, mobile = MOBILE) => {
    const res = await staff
      .post('/v1/patients')
      .send({ title: 'Ms.', fullName, mobile, pinCode: '500084', dateOfBirth, gender: 'female', homeBranchId: branchId, confirmedNotDuplicate: true })
      .expect(201)
    return res.body.data.id as string
  }
  return { ...owner, branchId, staff, addPatient }
}

const setBirthDate = (token: string, dateOfBirth: string) => phone(token).patch('/v1/patient/me').send({ dateOfBirth }).expect(200)
const linkedNames = async (token: string) => (await phone(token).get('/v1/patient/links').expect(200)).body.data.map((link: { patientName: string }) => link.patientName)

describe('patient sign-in', () => {
  it('registers a new number, then signs it in again with a code', async () => {
    const token = await signUp(MOBILE)
    const me = (await phone(token).get('/v1/patient/me').expect(200)).body.data
    expect(me).toMatchObject({ mobile: MOBILE, fullName: 'Asha Rao', dateOfBirth: null })
    expect(me).not.toHaveProperty('passwordHash')

    const stored = await ctx.prisma.patientAccount.findUniqueOrThrow({ where: { mobile: MOBILE } })
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
    const sessions = await ctx.prisma.patientSession.findMany()
    expect(sessions.map((row) => row.tokenHash)).not.toContain(token)

    const again = await verify(MOBILE)
    expect(again.status).toBe('signed_in')
    expect(again.token).not.toBe(token)

    await phone(token).post('/v1/patient/auth/logout').expect(204)
    expect((await phone(token).get('/v1/patient/me').expect(401)).body.error.code).toBe('SESSION_INVALID')
  })

  it('locks a code after five wrong attempts and lets a registration ticket be used once', async () => {
    await phone().post('/v1/patient/auth/otp/request').send({ mobile: MOBILE }).expect(202)
    const right = sms.code(MOBILE)
    const wrong = right === '111111' ? '222222' : '111111'
    for (let attempt = 0; attempt < 5; attempt += 1) await phone().post('/v1/patient/auth/otp/verify').send({ mobile: MOBILE, code: wrong }).expect(400)
    await phone().post('/v1/patient/auth/otp/verify').send({ mobile: MOBILE, code: right }).expect(400)

    const verified = await verify('9812345678')
    const account = { registrationToken: verified.registrationToken, fullName: 'Ravi', email: 'ravi@example.com', password: PASSWORD }
    await phone().post('/v1/patient/auth/register').send(account).expect(201)
    expect((await phone().post('/v1/patient/auth/register').send(account).expect(400)).body.error.code).toBe('REGISTRATION_EXPIRED')
  })

  it('does not send a second code inside the resend wait', async () => {
    await phone().post('/v1/patient/auth/otp/request').send({ mobile: MOBILE }).expect(202)
    const again = await phone().post('/v1/patient/auth/otp/request').send({ mobile: MOBILE }).expect(202)
    expect(again.body.data.resendInSeconds).toBeGreaterThan(0)
    expect(await ctx.prisma.patientOtp.count()).toBe(1)
  })

  it('keeps one patient out of another patient’s sessions', async () => {
    const first = await signUp(MOBILE)
    const second = await signUp('9812345678', 'Ravi')
    const [mine] = (await phone(first).get('/v1/patient/auth/sessions').expect(200)).body.data
    await phone(second).delete(`/v1/patient/auth/sessions/${mine.id}`).expect(404)
    await phone(first).get('/v1/patient/me').expect(200)
  })

  it('never treats a patient token as a staff session', async () => {
    const token = await signUp(MOBILE)
    const { orgId } = await clinic()
    await phone(token).get('/v1/patients').set('X-Org-Id', orgId).expect(401)
    await phone().get('/v1/patients').set('Cookie', `clinicos_session=${token}`).set('X-Org-Id', orgId).expect(401)
  })
})

describe('connecting clinic records', () => {
  it('links only the record whose mobile and date of birth both match, on a shared family number', async () => {
    const { addPatient } = await clinic()
    await addPatient('Asha Rao', '1994-08-14')
    await addPatient('Ravi Rao', '1990-01-02')

    const token = await signUp(MOBILE)
    expect(await linkedNames(token)).toEqual([])
    await setBirthDate(token, '1994-08-14')
    expect(await linkedNames(token)).toEqual(['Asha Rao'])
  })

  it('links nothing when two records match, or when the clinic has not opted in', async () => {
    const open = await clinic()
    await open.addPatient('Asha Rao', '1994-08-14')
    await open.addPatient('Isha Rao', '1994-08-14')
    const closed = await clinic('owner@other.test', false)
    await closed.addPatient('Asha Rao', '1994-08-14')

    const token = await signUp(MOBILE)
    await setBirthDate(token, '1994-08-14')
    expect(await linkedNames(token)).toEqual([])
  })

  it('picks up a record the clinic creates later, at the next sign-in', async () => {
    const { addPatient } = await clinic()
    const token = await signUp(MOBILE)
    await setBirthDate(token, '1994-08-14')
    await addPatient('Asha Rao', '1994-08-14')

    const again = await verify(MOBILE)
    expect(await linkedNames(again.token)).toEqual(['Asha Rao'])
  })

  it('does not let the app change a date of birth to reach another record', async () => {
    const { addPatient } = await clinic()
    await addPatient('Ravi Rao', '1990-01-02')
    const token = await signUp(MOBILE)
    await setBirthDate(token, '1994-08-14')

    const res = await phone(token).patch('/v1/patient/me').send({ dateOfBirth: '1990-01-02' }).expect(409)
    expect(res.body.error.code).toBe('DATE_OF_BIRTH_LOCKED')
    expect(await linkedNames(token)).toEqual([])
    // Sending the saved date again, as an edit form does, is not a change.
    await phone(token).patch('/v1/patient/me').send({ dateOfBirth: '1994-08-14', city: 'Pune' }).expect(200)
  })

  it('connects by a single-use desk code, to one account at a time', async () => {
    const { staff, addPatient } = await clinic()
    const patientId = await addPatient('Meena Iyer', '1970-05-05', '9700000001')
    const issued = (await staff.post(`/v1/patients/${patientId}/app-link-code`).expect(201)).body.data
    expect(issued.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(JSON.stringify(await ctx.prisma.patientLinkCode.findMany())).not.toContain(issued.code)

    const first = await signUp(MOBILE)
    const spaced = `${issued.code.slice(0, 4)} ${issued.code.slice(4)}`.toLowerCase()
    await phone(first).post('/v1/patient/links/code').send({ code: spaced }).expect(200)
    expect(await linkedNames(first)).toEqual(['Meena Iyer'])

    const second = await signUp('9812345678', 'Ravi')
    expect((await phone(second).post('/v1/patient/links/code').send({ code: issued.code }).expect(400)).body.error.code).toBe('LINK_CODE_INVALID')
    const fresh = (await staff.post(`/v1/patients/${patientId}/app-link-code`).expect(201)).body.data
    expect((await phone(second).post('/v1/patient/links/code').send({ code: fresh.code }).expect(409)).body.error.code).toBe('RECORD_ALREADY_LINKED')
    expect(await linkedNames(second)).toEqual([])
  })

  it('keeps access removed after the clinic revokes it', async () => {
    const { staff, addPatient } = await clinic()
    const patientId = await addPatient('Asha Rao', '1994-08-14')
    const token = await signUp(MOBILE)
    await setBirthDate(token, '1994-08-14')

    const access = (await staff.get(`/v1/patients/${patientId}/app-access`).expect(200)).body.data
    expect(access.links).toMatchObject([{ method: 'mobile_dob', accountMobile: MOBILE, revokedAt: null }])
    await staff.delete(`/v1/patients/${patientId}/app-links/${access.links[0].id}`).expect(204)
    expect(await linkedNames(token)).toEqual([])

    const again = await verify(MOBILE)
    expect(await linkedNames(again.token)).toEqual([])
  })

  it('keeps one clinic and one patient out of another’s links', async () => {
    const mine = await clinic()
    const patientId = await mine.addPatient('Asha Rao', '1994-08-14')
    const other = await clinic('owner@other.test')
    await other.staff.get(`/v1/patients/${patientId}/app-access`).expect(404)
    await other.staff.post(`/v1/patients/${patientId}/app-link-code`).expect(404)

    const token = await signUp(MOBILE)
    await setBirthDate(token, '1994-08-14')
    const [link] = (await phone(token).get('/v1/patient/links').expect(200)).body.data
    const stranger = await signUp('9812345678', 'Ravi')
    await phone(stranger).delete(`/v1/patient/links/${link.id}`).expect(404)
    await phone(token).delete(`/v1/patient/links/${link.id}`).expect(204)
    expect(await linkedNames(token)).toEqual([])
  })

  it('lets only the clinic’s settings holder opt a branch into the patient app', async () => {
    const { browser, orgId, branchId, addPatient } = await clinic('owner@aura.test', false)
    await addPatient('Asha Rao', '1994-08-14')
    const token = await signUp(MOBILE)
    await setBirthDate(token, '1994-08-14')
    expect(await linkedNames(token)).toEqual([])

    const url = `/v1/configuration/branches/${branchId}/patient-app`
    const branch = (await browser.get(`/v1/configuration/branches/${branchId}`).set('X-Org-Id', orgId).expect(200)).body.data
    await phone(token).put(url).send({ listedInPatientApp: true, latitude: null, longitude: null, version: branch.version }).expect(401)
    await browser.put(url).set('X-Org-Id', orgId).send({ listedInPatientApp: true, latitude: 17.47, longitude: null, version: branch.version }).expect(400)
    const saved = await browser.put(url).set('X-Org-Id', orgId).send({ listedInPatientApp: true, latitude: 17.4701, longitude: 78.3573, version: branch.version }).expect(200)
    expect(saved.body.data).toMatchObject({ listedInPatientApp: true, latitude: 17.4701, longitude: 78.3573 })

    const again = await verify(MOBILE)
    expect(await linkedNames(again.token)).toEqual(['Asha Rao'])
  })

  it('records consent answers and returns the latest one', async () => {
    const token = await signUp(MOBILE)
    await phone(token).put('/v1/patient/consents').send({ consents: [{ purpose: 'visit_alerts', granted: true }] }).expect(200)
    const res = await phone(token).put('/v1/patient/consents').send({ consents: [{ purpose: 'visit_alerts', granted: false }] }).expect(200)
    expect(res.body.data.find((row: { purpose: string }) => row.purpose === 'visit_alerts').granted).toBe(false)
    expect(await ctx.prisma.patientConsent.count()).toBe(2)
  })
})
