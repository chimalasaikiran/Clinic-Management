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

describe('owner dashboard', () => {
  it('shows the day from the appointment, payment, attendance and audit records', async () => {
    const c = await clinic()
    const member = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
    const doctor = (await c.owner.post('/v1/practitioners').send({ membershipId: member, displayName: 'Dr. Rahul Mehta', specialty: 'Physiotherapy', department: 'Rehabilitation', slotMinutes: 30 }).expect(201)).body.data
    await c.owner.put(`/v1/practitioners/${doctor.id}/availability`).send({ windows: Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.branchId, weekday, start: '00:00', end: '23:30' })) }).expect(200)
    const patient = (await c.owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId }).expect(201)).body.data
    const second = (await c.owner.post('/v1/patients').send({ ...PATIENT, fullName: 'Ravi Kumar', mobile: '+91 98452 11030', homeBranchId: c.branchId }).expect(201)).body.data

    // One walk-in seen and closed, another still waiting.
    const walkIn = { practitionerId: doctor.id, branchId: c.branchId, date: today(), channel: 'walk_in', waitingQueue: true, arrivedNow: true, reason: 'Acute neck pain' }
    const seen = (await c.owner.post('/v1/appointments').send({ ...walkIn, patientId: patient.id }).expect(201)).body.data
    await c.owner.post(`/v1/appointments/${seen.id}/start`).expect(200)
    await c.owner.post(`/v1/appointments/${seen.id}/complete`).expect(200)
    await c.owner.post('/v1/appointments').send({ ...walkIn, patientId: second.id }).expect(201)

    await c.owner.post('/v1/billing/payments').send({ patientId: patient.id, amount: 1200, channel: 'UPI / QR', payer: 'Patient Direct (Self)', purpose: 'advance', txnReference: 'UPI-DASH-1' }).expect(201)

    const staff = { department: 'Front Office', designation: 'Receptionist' }
    const present = (await c.owner.post('/v1/staff').send({ ...staff, type: 'staff', fullName: 'Kavya Menon' }).expect(201)).body.data
    const missing = (await c.owner.post('/v1/staff').send({ ...staff, type: 'staff', fullName: 'Arjun Rao' }).expect(201)).body.data
    for (const person of [present, missing]) await c.owner.put(`/v1/staff/${person.id}/branches`).send({ branchIds: [c.branchId], primaryBranchId: c.branchId }).expect(200)
    await c.owner.post(`/v1/staff/${present.id}/attendance`).send({ branchId: c.branchId, date: today(), status: 'present', time: '08:52' }).expect(201)

    const view = (await c.owner.get('/v1/dashboard').expect(200)).body.data
    expect(view).toMatchObject({ date: today(), today: today(), orgWide: true, branchId: null })
    expect(view.appointments).toMatchObject({ total: 2, completed: 1, waiting: 1, upcoming: 0, noShow: 0, noShowRate: 0 })
    expect(view.appointments.sessions).toHaveLength(2)
    expect(view.collections).toMatchObject({ amount: 1200, count: 1, digitalShare: 100, previous: { date: addDays(today(), -7), amount: 0 }, change: null })
    expect(view.refunds).toEqual({ processed: 0, amount: 0, pending: 0 })
    expect(view.outstanding).toMatchObject({ amount: 0, count: 0 })
    expect(view.reconciliation).toEqual({ candidates: 0, exceptions: 0 })
    expect(view.orders).toMatchObject({ awaitingReview: 0 })
    expect(view.lowStock).toEqual({ count: 0, items: [] })
    expect(view.team).toMatchObject({ total: 2, present: 1, notMarked: 1, staffOnDuty: 1, doctorsOnDuty: 0 })
    expect(view.approvals).toEqual({ attendanceUnmarked: 1, payrollAdjustments: 0, advances: 0 })
    expect(view.locations).toEqual([{ id: c.branchId, appointments: 2, collections: 1200, exceptions: 1 }])

    const actions = view.activity.map((entry: { action: string }) => entry.action)
    expect(actions[0]).toBe('staff.attendance_recorded')
    expect(view.activity[0]).toMatchObject({ subject: 'Kavya Menon', details: { status: 'present' } })
    expect(view.activity.find((entry: { action: string }) => entry.action === 'billing.payment.recorded')).toMatchObject({ subject: 'Ananya Sharma', details: { amount: 1200, channel: 'UPI / QR' } })
    expect(view.activity.find((entry: { action: string }) => entry.action === 'appointment.complete')).toMatchObject({ subject: 'Ananya Sharma', practitioner: 'Dr. Rahul Mehta' })

    const done = view.setup.filter((step: { done: boolean }) => step.done).map((step: { id: string }) => step.id)
    expect(done).toEqual(expect.arrayContaining(['organisation', 'branches', 'staff', 'schedules']))
    expect(done).not.toContain('payroll')

    // Earlier days have their own figures; the future and anything past a week are refused.
    expect((await c.owner.get(`/v1/dashboard?date=${addDays(today(), -1)}`).expect(200)).body.data.appointments.total).toBe(0)
    expect((await c.owner.get(`/v1/dashboard?date=${addDays(today(), 1)}`).expect(400)).body.error.code).toBe('DATE_IN_FUTURE')
    expect((await c.owner.get(`/v1/dashboard?date=${addDays(today(), -7)}`).expect(400)).body.error.code).toBe('DATE_TOO_OLD')
    await c.owner.get('/v1/dashboard?branchId=01930000-0000-7000-8000-000000000001').expect(404)
  }, 300_000)

  it('leaves out what a branch-limited role cannot see', async () => {
    const c = await clinic()
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    await c.owner.post('/v1/invitations').send({ email: 'desk@aura.test', roleIds: [roles.find((role) => role.name === 'Front Desk & Reception')!.id] }).expect(201)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('desk@aura.test'), fullName: 'Front Desk', password: PASSWORD }).expect(201)
    const browser = ctx.browser()
    await signIn(browser, 'desk@aura.test')

    const view = (await c.as(browser).get('/v1/dashboard').expect(200)).body.data
    expect(view.orgWide).toBe(false)
    expect(view.branches.map((branch: { id: string }) => branch.id)).toEqual([c.branchId])
    expect(view.appointments).not.toBeNull()
    expect(view.team).not.toBeNull()
    expect(view).toMatchObject({ collections: null, refunds: null, outstanding: null, reconciliation: null, orders: null, lowStock: null, activity: null, setup: null })
    expect(view.approvals).toEqual({ attendanceUnmarked: null, payrollAdjustments: null, advances: null })
    expect(view.locations).toEqual([{ id: c.branchId, appointments: 0, collections: null, exceptions: null }])
  }, 300_000)
})
