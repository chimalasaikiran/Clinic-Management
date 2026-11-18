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
const PATIENT = { title: 'Ms.', fullName: 'Ananya Sharma', mobile: '+91 98452 11029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', city: 'Hyderabad', state: 'Telangana' }

async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  return { owner, orgId, branchId, as }
}

describe('operations report', () => {
  it('reports outcomes, the check-in wait, capacity and services from the appointment records', async () => {
    const c = await clinic()
    const member = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
    const doctor = (await c.owner.post('/v1/practitioners').send({ membershipId: member, displayName: 'Dr. Rahul Mehta', specialty: 'Physiotherapy', department: 'Rehabilitation', slotMinutes: 30 }).expect(201)).body.data
    await c.owner.put(`/v1/practitioners/${doctor.id}/availability`).send({ windows: Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.branchId, weekday, start: '08:00', end: '20:00' })) }).expect(200)
    const patient = (await c.owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId }).expect(201)).body.data
    const second = (await c.owner.post('/v1/patients').send({ ...PATIENT, fullName: 'Ravi Kumar', mobile: '+91 98452 11030', homeBranchId: c.branchId }).expect(201)).body.data

    // Seen today as a walk-in; one booking for tomorrow cancelled, another still confirmed.
    const walkIn = (await c.owner.post('/v1/appointments').send({ patientId: patient.id, practitionerId: doctor.id, branchId: c.branchId, date: today(), channel: 'walk_in', waitingQueue: true, arrivedNow: true, reason: 'Acute neck pain' }).expect(201)).body.data
    await c.owner.post(`/v1/appointments/${walkIn.id}/start`).expect(200)
    await c.owner.post(`/v1/appointments/${walkIn.id}/complete`).expect(200)
    const booking = { practitionerId: doctor.id, branchId: c.branchId, date: addDays(today(), 1), type: 'follow_up', reason: 'Review' }
    const cancelled = (await c.owner.post('/v1/appointments').send({ ...booking, patientId: second.id, time: '10:00' }).expect(201)).body.data
    await c.owner.post(`/v1/appointments/${cancelled.id}/cancel`).send({ reason: 'Patient requested', note: 'Travelling out of town.' }).expect(200)
    await c.owner.post('/v1/appointments').send({ ...booking, patientId: second.id, time: '11:00' }).expect(201)

    const report = (await c.owner.get(`/v1/reports/operations?from=${today()}&to=${addDays(today(), 1)}`).expect(200)).body.data
    expect(report).toMatchObject({ scheduled: 3, completed: 1, cancelled: 1, noShow: 0, open: 1, rescheduled: 0, branchId: null })
    expect(report.windows).toEqual([expect.objectContaining({ from: today(), to: addDays(today(), 1), days: 2, completed: 1, cancelled: 1, open: 1 })])
    expect(report.wait).toMatchObject({ pairs: 1 })
    // Cancelled just now, so its week of follow-up has not passed.
    expect(report.rebooking).toEqual({ mature: 0, replaced: 0, immature: 1 })
    // Only today has passed: 08:00–20:00 available.
    expect(report.doctors).toEqual([expect.objectContaining({ name: 'Dr. Rahul Mehta', availableMinutes: 720 })])
    expect(report.doctors[0].consultMinutes).toBeGreaterThan(0)
    expect(report.services).toEqual([{ name: 'Consultation', count: 1 }])

    expect((await c.owner.get(`/v1/reports/operations?from=${today()}&to=${addDays(today(), -1)}`).expect(400)).body.error.code).toBe('VALIDATION_FAILED')
    await c.owner.get(`/v1/reports/operations?from=${today()}&to=${today()}&branchId=01930000-0000-7000-8000-000000000001`).expect(404)
  })

  it('keeps reports to roles holding reports.view', async () => {
    const c = await clinic()
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    await c.owner.post('/v1/invitations').send({ email: 'desk@aura.test', roleIds: [roles.find((role) => role.name === 'Front Desk & Reception')!.id] }).expect(201)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('desk@aura.test'), fullName: 'Front Desk', password: PASSWORD }).expect(201)
    const browser = ctx.browser()
    await signIn(browser, 'desk@aura.test')
    await c.as(browser).get(`/v1/reports/operations?from=${today()}&to=${today()}`).expect(403)
  })
})
