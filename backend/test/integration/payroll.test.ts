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

// Runs are for a past month, so attendance can be recorded for every day of it.
const lastMonth = () => addMonths(localDate(new Date(), 'Asia/Kolkata').slice(0, 7), -1)
const PROFILE = { employment: 'full_time', model: 'monthly', rate: 30000, bankName: 'HDFC Bank', ifsc: 'HDFC0001234', accountLast4: '4421' }

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
  const state = async () => (await owner.get('/v1/payroll/state').expect(200)).body.data
  // A person at the clinic's branch with a verified pay profile.
  const person = async (fullName: string, profile: Record<string, unknown> = {}, verify = true) => {
    const staff = (await owner.post('/v1/staff').send({ type: 'staff', fullName, department: 'Nursing', designation: 'Staff Nurse' }).expect(201)).body.data
    await owner.put(`/v1/staff/${staff.id}/branches`).send({ branchIds: [branchId], primaryBranchId: branchId }).expect(200)
    const id = (await owner.post('/v1/payroll/profiles').send({ staffId: staff.id, ...PROFILE, ...profile }).expect(201)).body.data.id as string
    if (verify) await owner.post(`/v1/payroll/profiles/${id}/verify-bank`).send({ version: 1 }).expect(200)
    return { staffId: staff.id as string, profileId: id }
  }
  const attendance = (staffId: string, date: string, status: string) =>
    owner.post(`/v1/staff/${staffId}/attendance`).send({ branchId, date, status, ...(status === 'present' && { time: '09:00' }) }).expect(201)
  return { owner, orgId, branchId, state, person, attendance, as }
}

const lineOf = (state: { cycle: { lines: Array<{ staffId: string }> } }, staffId: string) => state.cycle.lines.find((line) => line.staffId === staffId) as Record<string, any>

describe('payroll settings and pay profiles', () => {
  it('saves the statutory rules once per version and keeps only the last digits of an account', async () => {
    const c = await clinic()
    expect((await c.state()).settings).toMatchObject({ epfRate: 12, epfCap: 1800, esicCeiling: 21000, tdsRate: 10, payDay: 5, version: null })
    const settings = { epfEnabled: true, epfRate: 12, epfCap: 0, esicEnabled: false, esicRate: 0.75, esicCeiling: 21000, ptEnabled: true, ptState: 'Telangana', ptSlabs: [{ above: 15000, amount: 150 }], tdsEnabled: true, tdsRate: 10, payDay: 7 }
    await c.owner.put('/v1/payroll/settings').send({ ...settings, version: null }).expect(200)
    expect((await c.owner.put('/v1/payroll/settings').send({ ...settings, version: null }).expect(409)).body.error.code).toBe('STALE_RECORD')
    expect((await c.state()).settings).toMatchObject({ epfCap: 0, esicEnabled: false, payDay: 7, version: 1 })

    const { staffId, profileId } = await c.person('Priya Sharma', {}, false)
    expect((await c.owner.post('/v1/payroll/profiles').send({ staffId, ...PROFILE }).expect(409)).body.error.code).toBe('PROFILE_EXISTS')
    await c.owner.post(`/v1/payroll/profiles/${profileId}/verify-bank`).send({ version: 1 }).expect(200)
    // New bank details have to be verified again.
    await c.owner.patch(`/v1/payroll/profiles/${profileId}`).send({ ...PROFILE, accountLast4: '9014', version: 2 }).expect(200)
    const profile = (await c.state()).staff.find((row: { id: string }) => row.id === staffId).profile
    expect(profile).toMatchObject({ accountLast4: '9014', bankVerified: false, rate: 30000 })
    expect(Object.keys(profile)).not.toContain('accountNumber')
  })
})

describe('a payroll run', () => {
  it('pays salaried staff for the days not absent, blocks approval until reviewed, then fixes payslips', async () => {
    const c = await clinic()
    const month = lastMonth()
    const nurse = await c.person('Priya Sharma')
    await c.attendance(nurse.staffId, `${month}-02`, 'present')
    await c.attendance(nurse.staffId, `${month}-03`, 'absent')
    await c.attendance(nurse.staffId, `${month}-04`, 'leave')

    const cycleId = (await c.owner.post('/v1/payroll/cycles').send({ month }).expect(201)).body.data.id
    expect((await c.owner.post('/v1/payroll/cycles').send({ month: addMonths(month, -1) }).expect(409)).body.error.code).toBe('CYCLE_OPEN')
    let state = await c.state()
    const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
    let line = lineOf(state, nurse.staffId)
    expect(line).toMatchObject({ status: 'needs_review', statusNote: 'Confirm 1 days leave and 1 days absent', derived: days - 1, quantity: days - 1, gross: Math.round((30000 * (days - 1) * 100) / days) / 100 })
    expect(line.statutory.map((entry: { code: string }) => entry.code)).toEqual(['epf', 'pt'])

    const blocked = await c.owner.post(`/v1/payroll/cycles/${cycleId}/approve`).send({ version: state.cycle.version }).expect(409)
    expect(blocked.body.error.code).toBe('RUN_BLOCKED')
    expect(blocked.body.error.details.map((detail: { issue: string }) => detail.issue)).toEqual(['1 included staff · not marked ready'])

    // A figure from the records is only replaced with a reason.
    expect((await c.owner.patch(`/v1/payroll/entries/${line.entryId}`).send({ entered: days, version: line.version }).expect(422)).body.error.code).toBe('REASON_REQUIRED')
    await c.owner.patch(`/v1/payroll/entries/${line.entryId}`).send({ entered: days, enteredReason: 'Absence approved as paid', status: 'ready', version: line.version }).expect(200)
    state = await c.state()
    line = lineOf(state, nurse.staffId)
    expect(line).toMatchObject({ status: 'ready', quantity: days, gross: 30000, net: 30000 - 1800 - 200 })
    await c.owner.post(`/v1/payroll/cycles/${cycleId}/approve`).send({ version: state.cycle.version }).expect(200)

    // An adjustment logged after approval sends the run back, and blocks it until decided.
    const adjustment = (await c.owner.post('/v1/payroll/adjustments').send({ staffId: nurse.staffId, month, direction: 'addition', category: 'Clinic bonus', amount: 2500, reason: 'Weekend cover' }).expect(201)).body.data
    expect(adjustment.reference).toBe('PAD-000001')
    state = await c.state()
    expect(state.cycle).toMatchObject({ status: 'draft', blockers: ['1 adjustment awaiting approval'] })
    await c.owner.post('/v1/payroll/adjustments/decide').send({ ids: [adjustment.id], decision: 'approved' }).expect(200)
    expect((await c.owner.post('/v1/payroll/adjustments/decide').send({ ids: [adjustment.id], decision: 'approved' }).expect(409)).body.error.code).toBe('ADJUSTMENT_DECIDED')
    state = await c.state()
    expect(lineOf(state, nurse.staffId)).toMatchObject({ additions: 2500, net: 32500 - 1800 - 200 })
    await c.owner.post(`/v1/payroll/cycles/${cycleId}/approve`).send({ version: state.cycle.version }).expect(200)
    state = await c.state()
    expect((await c.owner.post(`/v1/payroll/cycles/${cycleId}/process`).send({ version: state.cycle.version }).expect(200)).body.data).toEqual({ payslips: 1 })

    state = await c.state()
    expect(state.cycle).toBeNull()
    const [run] = state.history
    expect(run).toMatchObject({ month, reference: `PAY-${month}`, staff: 1, gross: 30000, additions: 2500, statutory: 2000, net: 30500 })
    expect(run.payslips[0]).toMatchObject({ payslipRef: 'PSL-000001', quantity: days, net: 30500, paymentRef: null })
    expect(state.adjustments[0]).toMatchObject({ status: 'approved', appliedIn: month })

    // The run is read-only; payments are recorded by their bank reference, once.
    expect((await c.owner.patch(`/v1/payroll/entries/${run.payslips[0].entryId}`).send({ status: 'on_hold', version: run.payslips[0].version }).expect(409)).body.error.code).toBe('CYCLE_PROCESSED')
    await c.owner.post(`/v1/payroll/entries/${run.payslips[0].entryId}/payment`).send({ reference: 'UTR-HDFC-4471', version: run.payslips[0].version }).expect(200)
    expect((await c.owner.post(`/v1/payroll/entries/${run.payslips[0].entryId}/payment`).send({ reference: 'UTR-2', version: run.payslips[0].version + 1 }).expect(409)).body.error.code).toBe('PAYMENT_RECORDED')
    expect((await c.state()).history[0].payslips[0]).toMatchObject({ paymentRef: 'UTR-HDFC-4471', paidBy: 'Siddharth Verma' })

  }, 300_000)

  it('needs units entered for shift pay, and refuses to process when the records changed after approval', async () => {
    const c = await clinic()
    const month = lastMonth()
    const locum = await c.person('Ramesh Kumar', { employment: 'contract_locum', model: 'shift', rate: 2500 })
    const nurse = await c.person('Sneha Patel')
    const cycleId = (await c.owner.post('/v1/payroll/cycles').send({ month }).expect(201)).body.data.id
    let state = await c.state()
    expect(lineOf(state, locum.staffId)).toMatchObject({ status: 'needs_review', quantityNote: 'Enter the shifts worked', gross: 0, issues: ['Enter the shifts worked', 'Not marked ready'] })
    const shifts = lineOf(state, locum.staffId)
    await c.owner.patch(`/v1/payroll/entries/${shifts.entryId}`).send({ entered: 16, status: 'ready', version: shifts.version }).expect(200)
    state = await c.state()
    expect(lineOf(state, locum.staffId)).toMatchObject({ quantity: 16, gross: 40000, statutoryTotal: 4000, net: 36000, issues: [] })

    await c.owner.post(`/v1/payroll/cycles/${cycleId}/approve`).send({ version: state.cycle.version }).expect(200)
    // Attendance recorded after approval changes the pay without touching the run.
    await c.attendance(nurse.staffId, `${month}-05`, 'absent')
    state = await c.state()
    expect((await c.owner.post(`/v1/payroll/cycles/${cycleId}/process`).send({ version: state.cycle.version }).expect(409)).body.error.code).toBe('RUN_CHANGED')
    state = await c.state()
    expect(state.cycle.status).toBe('draft')
    expect(state.activity[0]).toMatchObject({ action: 'Approval withdrawn', note: 'The records changed after approval' })
  })

  it('pays only the staff in scope and included', async () => {
    const c = await clinic()
    const month = lastMonth()
    const nurse = await c.person('Priya Sharma')
    const consultant = await c.person('Dr. Ravi Kumar', { employment: 'consultant', model: 'visit', rate: 1500 })
    const cycleId = (await c.owner.post('/v1/payroll/cycles').send({ month }).expect(201)).body.data.id
    let state = await c.state()
    await c.owner.put(`/v1/payroll/cycles/${cycleId}/scope`).send({ branchIds: [], employment: ['full_time'], version: state.cycle.version }).expect(200)
    state = await c.state()
    expect(lineOf(state, consultant.staffId)).toMatchObject({ inScope: false, quantity: 0, quantityNote: 'No login linked, so no appointments to count' })
    await c.owner.post(`/v1/payroll/cycles/${cycleId}/include`).send({ entryIds: [lineOf(state, nurse.staffId).entryId], included: false }).expect(200)
    state = await c.state()
    expect(state.cycle.blockers).toEqual(['No staff are included in this run'])
  })
})

describe('salary advances', () => {
  it('keeps to the limit, moves through disbursal and is recovered from the next payslip until settled', async () => {
    const c = await clinic()
    const month = lastMonth()
    const nurse = await c.person('Priya Sharma')
    const advance = { staffId: nurse.staffId, source: 'Admin created', installments: 1, startMonth: month, category: 'Medical emergency', method: 'Bank transfer (NEFT)', disbursalDate: `${month}-10` }
    expect((await c.owner.post('/v1/payroll/advances').send({ ...advance, principal: 60001, installments: 6 }).expect(422)).body.error.code).toBe('ADVANCE_OVER_LIMIT')
    expect((await c.owner.post('/v1/payroll/advances').send({ ...advance, principal: 20000 }).expect(422)).body.error.code).toBe('INSTALMENT_OVER_CAP')
    const created = (await c.owner.post('/v1/payroll/advances').send({ ...advance, principal: 9000 }).expect(201)).body.data
    expect(created.reference).toBe('ADV-000001')
    // Requested by the employee: needs a decision first.
    const request = (await c.owner.post('/v1/payroll/advances').send({ ...advance, source: 'Employee request', principal: 5000, method: null, disbursalDate: null }).expect(201)).body.data
    await c.owner.post(`/v1/payroll/advances/${request.id}/action`).send({ action: 'disburse', version: 1 }).expect(409)
    await c.owner.post(`/v1/payroll/advances/${request.id}/action`).send({ action: 'reject', note: 'Outside policy', version: 1 }).expect(200)

    await c.owner.post(`/v1/payroll/advances/${created.id}/action`).send({ action: 'disburse', version: 1 }).expect(200)
    const cycleId = (await c.owner.post('/v1/payroll/cycles').send({ month }).expect(201)).body.data.id
    let state = await c.state()
    expect(lineOf(state, nurse.staffId).advance).toBe(0)
    await c.owner.post(`/v1/payroll/advances/${created.id}/action`).send({ action: 'acknowledge', version: 2 }).expect(200)
    state = await c.state()
    expect(lineOf(state, nurse.staffId)).toMatchObject({ advance: 9000, advanceLines: [{ advanceId: created.id, number: 1, amount: 9000 }] })

    const line = lineOf(state, nurse.staffId)
    if (line.status !== 'ready') await c.owner.patch(`/v1/payroll/entries/${line.entryId}`).send({ status: 'ready', version: line.version }).expect(200)
    state = await c.state()
    await c.owner.post(`/v1/payroll/cycles/${cycleId}/approve`).send({ version: state.cycle.version }).expect(200)
    state = await c.state()
    await c.owner.post(`/v1/payroll/cycles/${cycleId}/process`).send({ version: state.cycle.version }).expect(200)
    state = await c.state()
    expect(state.advances.find((row: { id: string }) => row.id === created.id)).toMatchObject({ status: 'settled', recovered: 9000, outstanding: 0, recoveries: [{ number: 1, amount: 9000, month }] })
    expect(state.advances.find((row: { id: string }) => row.id === request.id)).toMatchObject({ status: 'rejected', decisionNote: 'Outside policy' })
  })
})

describe('access', () => {
  it('keeps payroll to roles holding staff.payroll', async () => {
    const c = await clinic()
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    const role = roles.find((entry) => entry.name !== 'Super Admin')!
    await c.owner.post('/v1/invitations').send({ email: 'desk@aura.test', roleIds: [role.id] }).expect(201)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('desk@aura.test'), fullName: 'Front Desk', password: PASSWORD }).expect(201)
    const browser = ctx.browser()
    await signIn(browser, 'desk@aura.test')
    const desk = c.as(browser)
    await desk.get('/v1/payroll/state').expect(403)
    await desk.post('/v1/payroll/cycles').send({ month: lastMonth() }).expect(403)
  })
})
