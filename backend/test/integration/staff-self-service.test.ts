import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addMonths } from '../../src/modules/payroll/payroll.logic'
import { localDate } from '../../src/modules/scheduling/clinic-time'
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

const lastMonth = () => addMonths(localDate(new Date(), 'Asia/Kolkata').slice(0, 7), -1)
const PROFILE = { employment: 'full_time', model: 'monthly', rate: 30000, bankName: 'HDFC Bank', ifsc: 'HDFC0001234', accountLast4: '4421' }

// A clinic with two nurses who can each sign in and have their own staff record.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const roleId = ((await owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>).find((role) => role.name === 'Nurse')!.id

  const nurse = async (fullName: string, email: string) => {
    const staff = (await owner.post('/v1/staff').send({ type: 'staff', fullName, department: 'Nursing', designation: 'Staff Nurse' }).expect(201)).body.data
    await owner.put(`/v1/staff/${staff.id}/branches`).send({ branchIds: [branchId], primaryBranchId: branchId }).expect(200)
    await owner.post(`/v1/staff/${staff.id}/invite`).send({ email, roleIds: [roleId] }).expect(200)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName, password: PASSWORD }).expect(201)
    const session = ctx.browser()
    await signIn(session, email)
    return { staffId: staff.id as string, ...as(session) }
  }
  return { owner, orgId, branchId, nurse }
}

describe('staff self-service', () => {
  it('shows a member only their own attendance and leave', async () => {
    const c = await clinic()
    const priya = await c.nurse('Priya Sharma', 'priya@aura.test')
    const deepa = await c.nurse('Deepa Rao', 'deepa@aura.test')
    const month = lastMonth()
    await c.owner.post(`/v1/staff/${priya.staffId}/attendance`).send({ branchId: c.branchId, date: `${month}-02`, status: 'present', time: '09:05' }).expect(201)
    await c.owner.post(`/v1/staff/${priya.staffId}/leaves`).send({ kind: 'leave', title: 'Family event', startDate: `${month}-10`, endDate: `${month}-11`, reason: 'Wedding in the family' }).expect(201)

    const mine = (await priya.get(`/v1/me/attendance?month=${month}`).expect(200)).body.data
    expect(mine).toMatchObject({ linked: true, counts: { present: 1, absent: 0 }, records: [{ date: `${month}-02`, status: 'present', time: '09:05' }] })
    expect((await priya.get('/v1/me/leaves').expect(200)).body.data).toMatchObject({ linked: true, leaves: [{ title: 'Family event', status: 'scheduled' }] })

    expect((await deepa.get(`/v1/me/attendance?month=${month}`).expect(200)).body.data.records).toEqual([])
    expect((await deepa.get('/v1/me/leaves').expect(200)).body.data.leaves).toEqual([])
    // The admin routes stay closed to someone without the staff permission.
    await deepa.get(`/v1/staff/${priya.staffId}/attendance?month=${month}`).expect(403)
    // An account with no staff record gets an empty, unlinked result rather than anyone else's.
    expect((await c.owner.get('/v1/me/leaves').expect(200)).body.data).toEqual({ linked: false, leaves: [] })
  })

  it('shows a member their own pay and lets only them acknowledge their advance', async () => {
    const c = await clinic()
    const priya = await c.nurse('Priya Sharma', 'priya@aura.test')
    const deepa = await c.nurse('Deepa Rao', 'deepa@aura.test')
    const profileId = (await c.owner.post('/v1/payroll/profiles').send({ staffId: priya.staffId, ...PROFILE }).expect(201)).body.data.id
    await c.owner.post(`/v1/payroll/profiles/${profileId}/verify-bank`).send({ version: 1 }).expect(200)
    const month = lastMonth()
    const advance = (await c.owner.post('/v1/payroll/advances').send({ staffId: priya.staffId, source: 'Admin created', principal: 6000, installments: 2, startMonth: month, category: 'Medical emergency', method: 'Bank transfer (NEFT)', disbursalDate: `${month}-10`, notes: 'Internal: approved by finance' }).expect(201)).body.data
    await c.owner.post(`/v1/payroll/advances/${advance.id}/action`).send({ action: 'disburse', version: 1 }).expect(200)

    const pay = (await priya.get('/v1/me/pay').expect(200)).body.data
    expect(pay.profile).toMatchObject({ bankName: 'HDFC Bank', accountLast4: '4421', rate: 30000, bankVerified: true })
    expect(pay.payslips).toEqual([])
    expect(pay.advances).toMatchObject([{ id: advance.id, status: 'awaiting_acknowledgement', principal: 6000, outstanding: 6000, version: 2 }])
    expect(JSON.stringify(pay)).not.toContain('Internal: approved by finance')

    expect((await deepa.get('/v1/me/pay').expect(200)).body.data).toMatchObject({ profile: null, advances: [] })
    await deepa.post(`/v1/me/pay/advances/${advance.id}/acknowledge`).send({ version: 2 }).expect(404)
    await priya.get('/v1/payroll/state').expect(403)

    await priya.post(`/v1/me/pay/advances/${advance.id}/acknowledge`).send({ version: 1 }).expect(409)
    const done = (await priya.post(`/v1/me/pay/advances/${advance.id}/acknowledge`).send({ version: 2 }).expect(200)).body.data
    expect(done.advances[0]).toMatchObject({ status: 'active', acknowledged: expect.any(String) })
    await priya.post(`/v1/me/pay/advances/${advance.id}/acknowledge`).send({ version: 3 }).expect(409)
  })
})
