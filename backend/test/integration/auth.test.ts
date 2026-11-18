import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createVerifiedUser, PASSWORD, resetState, sessionCookie, signIn, startApp, stopApp, TestContext } from './helpers'

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

describe('registration and email verification', () => {
  it('registers, stores an Argon2id hash, emails a code, and verifies', async () => {
    const browser = ctx.browser()
    const register = await browser.post('/v1/auth/register').send({ fullName: 'Asha Rao', email: 'Asha@Clinic.test', password: PASSWORD }).expect(202)
    expect(register.body.data).toEqual({ status: 'verification_pending', email: 'asha@clinic.test' })

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'asha@clinic.test' } })
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(user.passwordHash).not.toContain(PASSWORD)
    expect(user.emailVerifiedAt).toBeNull()

    // Signed in but unverified: the session says so and grants nothing.
    await signIn(browser, 'asha@clinic.test')
    const unverified = await browser.get('/v1/auth/session').expect(200)
    expect(unverified.body.data).toEqual({ user: expect.objectContaining({ emailVerified: false }), memberships: [] })
    expect((await browser.post('/v1/organisations').send({}).expect(403)).body.error.code).toBe('EMAIL_NOT_VERIFIED')

    await browser.post('/v1/auth/email-verification/confirm').send({ email: 'asha@clinic.test', code: ctx.mail.lastCode('asha@clinic.test') }).expect(200)
    const session = await browser.get('/v1/auth/session').expect(200)
    expect(session.body.data.user).toEqual({ id: user.id, email: 'asha@clinic.test', fullName: 'Asha Rao', emailVerified: true })
  })

  it('answers the same way for an existing email and warns the owner by email', async () => {
    await createVerifiedUser(ctx, 'taken@clinic.test')
    ctx.mail.sent.length = 0

    const res = await ctx.browser().post('/v1/auth/register').send({ fullName: 'Someone Else', email: 'taken@clinic.test', password: 'Other2026' }).expect(202)
    expect(res.body.data).toEqual({ status: 'verification_pending', email: 'taken@clinic.test' })
    expect(ctx.mail.to('taken@clinic.test')[0]?.subject).toMatch(/already/i)
    // The original password still works; the attempt changed nothing.
    await signIn(ctx.browser(), 'taken@clinic.test')
  })

  it('stops accepting a code after five wrong guesses', async () => {
    const browser = ctx.browser()
    await browser.post('/v1/auth/register').send({ fullName: 'Ravi', email: 'ravi@clinic.test', password: PASSWORD }).expect(202)
    const code = ctx.mail.lastCode('ravi@clinic.test')
    const wrong = code === '000000' ? '111111' : '000000'
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await browser.post('/v1/auth/email-verification/confirm').send({ email: 'ravi@clinic.test', code: wrong }).expect(400)
      expect(res.body.error.code).toBe('CODE_INVALID')
    }
    await browser.post('/v1/auth/email-verification/confirm').send({ email: 'ravi@clinic.test', code }).expect(400)
  })

  it('does not reveal whether an email exists when confirming', async () => {
    const res = await ctx.browser().post('/v1/auth/email-verification/confirm').send({ email: 'nobody@clinic.test', code: '123456' }).expect(400)
    expect(res.body.error.code).toBe('CODE_INVALID')
  })

  it('enforces a resend cooldown and replaces the old code', async () => {
    const browser = ctx.browser()
    await browser.post('/v1/auth/register').send({ fullName: 'Meena', email: 'meena@clinic.test', password: PASSWORD }).expect(202)
    await browser.post('/v1/auth/email-verification/resend').send({ email: 'meena@clinic.test' }).expect(202)
    expect(ctx.mail.to('meena@clinic.test')).toHaveLength(1)

    await ctx.prisma.verificationCode.updateMany({ data: { createdAt: new Date(Date.now() - 120_000) } })
    const first = ctx.mail.lastCode('meena@clinic.test')
    await browser.post('/v1/auth/email-verification/resend').send({ email: 'meena@clinic.test' }).expect(202)
    const second = ctx.mail.lastCode('meena@clinic.test')
    expect(ctx.mail.to('meena@clinic.test')).toHaveLength(2)

    if (first !== second) await browser.post('/v1/auth/email-verification/confirm').send({ email: 'meena@clinic.test', code: first }).expect(400)
    await browser.post('/v1/auth/email-verification/confirm').send({ email: 'meena@clinic.test', code: second }).expect(200)
  })

  it('rejects an expired code', async () => {
    const browser = ctx.browser()
    await browser.post('/v1/auth/register').send({ fullName: 'Old', email: 'old@clinic.test', password: PASSWORD }).expect(202)
    await ctx.prisma.verificationCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    await browser.post('/v1/auth/email-verification/confirm').send({ email: 'old@clinic.test', code: ctx.mail.lastCode('old@clinic.test') }).expect(400)
  })

  it('rate-limits registration per email with Retry-After', async () => {
    const browser = ctx.browser()
    for (let i = 0; i < 5; i++) await browser.post('/v1/auth/register').send({ fullName: 'Spam', email: 'spam@clinic.test', password: PASSWORD }).expect(202)
    const res = await browser.post('/v1/auth/register').send({ fullName: 'Spam', email: 'spam@clinic.test', password: PASSWORD }).expect(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })
})

describe('sign-in and sessions', () => {
  it('sets an HttpOnly session cookie and stores only its hash', async () => {
    await createVerifiedUser(ctx, 'cookie@clinic.test')
    const res = await signIn(ctx.browser(), 'cookie@clinic.test')
    const cookie = sessionCookie(res)!
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/Path=\//)
    const token = cookie.split(';')[0]!.split('=')[1]!
    const stored = await ctx.prisma.session.findMany()
    expect(stored.map((session) => session.tokenHash)).not.toContain(token)
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await createVerifiedUser(ctx, 'real@clinic.test')
    const wrongPassword = await ctx.browser().post('/v1/auth/login').send({ email: 'real@clinic.test', password: 'Wrong2026' }).expect(401)
    const unknownEmail = await ctx.browser().post('/v1/auth/login').send({ email: 'ghost@clinic.test', password: 'Wrong2026' }).expect(401)
    expect(wrongPassword.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' })
    expect(unknownEmail.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' })
    expect(sessionCookie(wrongPassword)).toBeNull()
  })

  it('locks sign-in after ten wrong passwords in a row, even for the right password', async () => {
    await createVerifiedUser(ctx, 'target@clinic.test')
    // Setting the user up signs in once; start the per-email limit from zero so ten guesses fit inside it.
    await ctx.prisma.rateLimit.deleteMany()
    for (let i = 0; i < 10; i++) await ctx.browser().post('/v1/auth/login').send({ email: 'target@clinic.test', password: `Guess${i}abc` }).expect(401)
    // Clear the per-email rate limit, so only the account lock is being tested.
    await ctx.prisma.rateLimit.deleteMany()

    const locked = await ctx.browser().post('/v1/auth/login').send({ email: 'target@clinic.test', password: PASSWORD }).expect(429)
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(60)
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'target@clinic.test' } })
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now())

    // The lock ends after its time, and a successful sign-in clears the failure count.
    await ctx.prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() - 1000) } })
    await signIn(ctx.browser(), 'target@clinic.test')
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount).toBe(0)
  })

  it('signs out: the cookie stops working and is cleared', async () => {
    const browser = await createVerifiedUser(ctx, 'leave@clinic.test')
    const cookieHeader = sessionCookie(await signIn(browser, 'leave@clinic.test'))!.split(';')[0]!
    const out = await browser.post('/v1/auth/logout').expect(204)
    expect(sessionCookie(out)).toMatch(/^clinicos_session=;/)

    const replay = await ctx.browser().get('/v1/auth/session').set('Cookie', cookieHeader).expect(401)
    expect(replay.body.error.code).toBe('SESSION_INVALID')
  })

  it('signs out of every device', async () => {
    const laptop = await createVerifiedUser(ctx, 'many@clinic.test')
    const phone = ctx.browser()
    await signIn(phone, 'many@clinic.test')
    await phone.get('/v1/auth/session').expect(200)

    await laptop.post('/v1/auth/logout-all').expect(204)
    expect((await phone.get('/v1/auth/session').expect(401)).body.error.code).toBe('SESSION_INVALID')
    await laptop.get('/v1/auth/session').expect(401)
  })

  it('lists sessions and ends one from another device', async () => {
    const laptop = await createVerifiedUser(ctx, 'list@clinic.test')
    const phone = ctx.browser()
    await signIn(phone, 'list@clinic.test')

    const list = (await laptop.get('/v1/auth/sessions').expect(200)).body.data as Array<{ id: string; current: boolean }>
    expect(list).toHaveLength(2)
    const other = list.find((session) => !session.current)!
    await laptop.delete(`/v1/auth/sessions/${other.id}`).expect(204)
    await phone.get('/v1/auth/session').expect(401)
    await laptop.get('/v1/auth/session').expect(200)
  })

  it('ends sessions that were idle too long or reached the absolute limit', async () => {
    const idle = await createVerifiedUser(ctx, 'idle@clinic.test')
    await ctx.prisma.session.updateMany({ data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } })
    expect((await idle.get('/v1/auth/session').expect(401)).body.error.code).toBe('SESSION_EXPIRED')

    const old = await createVerifiedUser(ctx, 'old@clinic.test')
    await ctx.prisma.session.updateMany({ where: { revokedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await old.get('/v1/auth/session').expect(401)).body.error.code).toBe('SESSION_EXPIRED')
  })

  it('blocks a disabled account, before and after sign-in', async () => {
    const browser = await createVerifiedUser(ctx, 'gone@clinic.test')
    await ctx.prisma.user.updateMany({ data: { status: 'disabled' } })
    expect((await browser.get('/v1/auth/session').expect(403)).body.error.code).toBe('ACCOUNT_DISABLED')
    expect((await ctx.browser().post('/v1/auth/login').send({ email: 'gone@clinic.test', password: PASSWORD }).expect(403)).body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('rejects a cookie-authenticated change that comes from another site', async () => {
    const browser = await createVerifiedUser(ctx, 'csrf@clinic.test')
    const res = await browser.post('/v1/auth/logout-all').set('Origin', 'https://evil.example').expect(403)
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED')
    await browser.get('/v1/auth/session').expect(200)
  })

  it('audits sign-ins and failures', async () => {
    await createVerifiedUser(ctx, 'audit@clinic.test')
    await ctx.browser().post('/v1/auth/login').send({ email: 'audit@clinic.test', password: 'Wrong2026' }).expect(401)
    const actions = (await ctx.prisma.auditLog.findMany({ orderBy: { id: 'asc' } })).map((entry) => entry.action)
    expect(actions).toEqual(['auth.registered', 'auth.email_verified', 'auth.signed_in', 'auth.sign_in_failed'])
  })
})

describe('passwords', () => {
  it('resets with an emailed code, ends every session, and accepts only the new password', async () => {
    const browser = await createVerifiedUser(ctx, 'forgot@clinic.test', 'Oldpass2026')
    ctx.mail.sent.length = 0

    await ctx.browser().post('/v1/auth/password-reset/request').send({ email: 'forgot@clinic.test' }).expect(202)
    const code = ctx.mail.lastCode('forgot@clinic.test')
    const weak = await ctx.browser().post('/v1/auth/password-reset/confirm').send({ email: 'forgot@clinic.test', code, password: 'weak' }).expect(400)
    expect(weak.body.error.code).toBe('VALIDATION_FAILED')

    await ctx.browser().post('/v1/auth/password-reset/confirm').send({ email: 'forgot@clinic.test', code, password: 'Newpass2026' }).expect(200)
    expect(ctx.mail.to('forgot@clinic.test').at(-1)?.subject).toMatch(/password was changed/)
    await browser.get('/v1/auth/session').expect(401)

    await ctx.browser().post('/v1/auth/login').send({ email: 'forgot@clinic.test', password: 'Oldpass2026' }).expect(401)
    await signIn(ctx.browser(), 'forgot@clinic.test', 'Newpass2026')
    // A used code cannot be replayed.
    await ctx.browser().post('/v1/auth/password-reset/confirm').send({ email: 'forgot@clinic.test', code, password: 'Another2026' }).expect(400)
  })

  it('answers 202 for unknown emails without sending anything', async () => {
    await ctx.browser().post('/v1/auth/password-reset/request').send({ email: 'ghost@clinic.test' }).expect(202)
    expect(ctx.mail.sent).toHaveLength(0)
  })

  it('changes the password, keeps this session and ends the others', async () => {
    const laptop = await createVerifiedUser(ctx, 'change@clinic.test')
    const phone = ctx.browser()
    await signIn(phone, 'change@clinic.test')

    const wrong = await laptop.post('/v1/auth/password/change').send({ currentPassword: 'Nope2026', newPassword: 'Fresh2026' }).expect(400)
    expect(wrong.body.error.details).toEqual([{ field: 'currentPassword', issue: 'Your current password is incorrect.' }])

    await laptop.post('/v1/auth/password/change').send({ currentPassword: PASSWORD, newPassword: 'Fresh2026' }).expect(200)
    await laptop.get('/v1/auth/session').expect(200)
    await phone.get('/v1/auth/session').expect(401)
    await signIn(ctx.browser(), 'change@clinic.test', 'Fresh2026')
  })
})

describe('profile', () => {
  it('reads and updates the signed-in user without exposing secrets', async () => {
    const browser = await createVerifiedUser(ctx, 'me@clinic.test')
    const me = await browser.get('/v1/users/me').expect(200)
    expect(Object.keys(me.body.data).sort()).toEqual(['email', 'emailVerified', 'fullName', 'id'])
    const updated = await browser.patch('/v1/users/me').send({ fullName: 'Dr. Meera Shah' }).expect(200)
    expect(updated.body.data.fullName).toBe('Dr. Meera Shah')
  })
})
