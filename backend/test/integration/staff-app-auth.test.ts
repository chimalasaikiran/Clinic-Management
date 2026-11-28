import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SmsSender } from '../../src/common/sms/sms.service'
import { createOwner, PASSWORD, resetState, startApp, stopApp, TestContext, WEB_ORIGIN } from './helpers'

class CaptureSmsSender extends SmsSender {
  readonly sent: Array<{ mobile: string; code: string }> = []

  async sendCode(mobile: string, code: string) {
    this.sent.push({ mobile, code })
  }

  last(mobile: string) {
    const entry = [...this.sent].reverse().find((item) => item.mobile === mobile)
    if (!entry) throw new Error(`No code sent to ${mobile}`)
    return entry.code
  }
}

const sms = new CaptureSmsSender()
let ctx: TestContext

beforeAll(async () => {
  ctx = await startApp([{ provide: SmsSender, useValue: sms }])
})
beforeEach(() => resetState(ctx))
afterAll(() => stopApp(ctx))

const MOBILE = '9876500002'
// The phone app: no Origin header and no cookies.
const phone = () => request(ctx.app.getHttpServer())

// A clinic owner whose staff record carries MOBILE, so they can sign in to the staff app.
async function staffMember(email = 'owner@aura.test', mobile = MOBILE) {
  const owner = await createOwner(ctx, email)
  const staff = {
    get: (url: string) => owner.browser.get(url).set('X-Org-Id', owner.orgId),
    post: (url: string) => owner.browser.post(url).set('X-Org-Id', owner.orgId),
  }
  const roles = (await staff.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  const record = (await staff.post('/v1/staff').send({ type: 'staff', fullName: 'Siddharth Verma', department: 'Administration', designation: 'Owner', mobile }).expect(201)).body.data
  await staff.post(`/v1/staff/${record.id}/invite`).send({ email, roleIds: [roles.find((role) => role.name === 'Front Desk & Reception')!.id] }).expect(200)
  return { ...owner, staff }
}

async function signIn(mobile = MOBILE, password = PASSWORD) {
  const login = await phone().post('/v1/auth/app/login').send({ mobile, password, deviceName: 'Test phone' }).expect(200)
  const verified = await phone().post('/v1/auth/app/verify').send({ ticket: login.body.data.ticket, code: sms.last(mobile) }).expect(200)
  return verified.body.data as { token: string; memberships: Array<{ organisation: { id: string }; permissions: string[] }> }
}

describe('staff app sign-in', () => {
  it('takes mobile, password and an SMS code, and returns a bearer session that works on staff routes', async () => {
    const { orgId } = await staffMember()
    const login = await phone().post('/v1/auth/app/login').send({ mobile: MOBILE, password: PASSWORD, deviceName: 'Pixel 9' }).expect(200)
    expect(login.body.data).toMatchObject({ sentTo: '98••••••02', expiresInSeconds: 300 })
    expect(login.headers['set-cookie']).toBeUndefined()

    const verified = await phone().post('/v1/auth/app/verify').send({ ticket: login.body.data.ticket, code: sms.last(MOBILE) }).expect(200)
    const { token, memberships } = verified.body.data
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(memberships[0]).toMatchObject({ organisation: { id: orgId }, permissions: expect.arrayContaining(['bookings.create']) })
    expect(verified.headers['set-cookie']).toBeUndefined()

    await phone().get('/v1/auth/session').set('Authorization', `Bearer ${token}`).expect(200)
    await phone().get('/v1/patients').set('Authorization', `Bearer ${token}`).set('X-Org-Id', orgId).expect(200)
    const sessions = (await phone().get('/v1/auth/sessions').set('Authorization', `Bearer ${token}`).expect(200)).body.data
    expect(sessions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'app', deviceName: 'Pixel 9' })]))

    // The code works once.
    await phone().post('/v1/auth/app/verify').send({ ticket: login.body.data.ticket, code: sms.last(MOBILE) }).expect(400)
  })

  it('keeps app tokens and browser cookies apart', async () => {
    const { browser } = await staffMember()
    const { token } = await signIn()
    // An app token sent as a cookie is refused, and so is a browser session sent as a bearer token.
    await phone().get('/v1/auth/session').set('Cookie', `clinicos_session=${token}`).expect(401)
    const cookie = (await browser.post('/v1/auth/login').send({ email: 'owner@aura.test', password: PASSWORD }).expect(200)).headers['set-cookie'] as unknown as string[]
    const browserToken = cookie.find((entry) => entry.startsWith('clinicos_session='))!.split(';')[0]!.split('=')[1]!
    await phone().get('/v1/auth/session').set('Authorization', `Bearer ${browserToken}`).expect(401)
    // A web page cannot obtain an app token.
    expect((await phone().post('/v1/auth/app/login').set('Origin', WEB_ORIGIN).send({ mobile: MOBILE, password: PASSWORD }).expect(403)).body.error.code).toBe('APP_ONLY')
  })

  it('refuses a wrong password, an unknown number and repeated wrong codes, without sending a code', async () => {
    await staffMember()
    const before = sms.sent.length
    expect((await phone().post('/v1/auth/app/login').send({ mobile: MOBILE, password: 'not-the-password' }).expect(401)).body.error.code).toBe('INVALID_CREDENTIALS')
    await phone().post('/v1/auth/app/login').send({ mobile: '9876500099', password: PASSWORD }).expect(401)
    expect(sms.sent.length).toBe(before)

    const login = await phone().post('/v1/auth/app/login').send({ mobile: MOBILE, password: PASSWORD }).expect(200)
    const right = sms.last(MOBILE)
    const wrong = right === '111111' ? '222222' : '111111'
    for (let attempt = 0; attempt < 5; attempt += 1) await phone().post('/v1/auth/app/verify').send({ ticket: login.body.data.ticket, code: wrong }).expect(400)
    expect((await phone().post('/v1/auth/app/verify').send({ ticket: login.body.data.ticket, code: right }).expect(400)).body.error.code).toBe('CODE_INVALID')
  })

  it('refuses a number shared by two accounts, and ends the session on sign-out', async () => {
    await staffMember()
    const { token } = await signIn()
    await phone().post('/v1/auth/app/logout').set('Authorization', `Bearer ${token}`).expect(204)
    await phone().get('/v1/auth/session').set('Authorization', `Bearer ${token}`).expect(401)

    await staffMember('owner@other.test', MOBILE)
    expect((await phone().post('/v1/auth/app/login').send({ mobile: MOBILE, password: PASSWORD }).expect(409)).body.error.code).toBe('MOBILE_SHARED')
  })
})
