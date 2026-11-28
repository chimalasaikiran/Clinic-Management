import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { LiveEvent, LiveService } from '../../src/common/realtime/live.service'
import { SmsSender } from '../../src/common/sms/sms.service'
import { addDays, localDate } from '../../src/modules/scheduling/clinic-time'
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
const BIRTH = '1992-04-18'
const today = () => localDate(new Date(), 'Asia/Kolkata')
const NAPROXEN = { medicineCode: 'naproxen', name: 'Naproxen Sodium', strength: '250 mg', form: 'Tablet', route: 'Oral', drugClass: 'nsaid', dose: 1, frequency: 'Twice daily (1-0-1)', frequencyPerDay: 2, food: 'After food', durationDays: 5, indication: 'Low back pain' }
const HBA1C = { code: 'LAB-HBA1C-01', name: 'Glycated Hemoglobin (HbA1c)', category: 'Laboratory', loinc: '4548-4', destination: 'In-house laboratory', priority: 'Routine (Outpatient OPD)' }

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

// A listed clinic with a therapist and a patient record that an app account on MOBILE / BIRTH connects to.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const staff = {
    get: (url: string) => browser.get(url).set('X-Org-Id', orgId),
    post: (url: string) => browser.post(url).set('X-Org-Id', orgId),
    patch: (url: string) => browser.patch(url).set('X-Org-Id', orgId),
    delete: (url: string) => browser.delete(url).set('X-Org-Id', orgId),
  }
  const branchId = (await staff.get('/v1/branches').expect(200)).body.data[0].id as string
  await ctx.prisma.branch.update({ where: { id: branchId }, data: { listedInPatientApp: true } })
  const membershipId = (await staff.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
  const practitioner = (await staff.post('/v1/practitioners').send({ membershipId, displayName: 'Dr. Rahul Mehta', credentials: 'MD', specialty: 'Cardiology', department: 'Cardiology', slotMinutes: 30 }).expect(201)).body.data
  const patient = (await staff.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: MOBILE, pinCode: '500084', dateOfBirth: BIRTH, gender: 'female', homeBranchId: branchId }).expect(201)).body.data
  return { staff, orgId, branchId, practitioner, patient }
}

async function liveDuring(work: () => Promise<unknown>) {
  const seen: LiveEvent[] = []
  const subscription = ctx.app.get(LiveService).stream().subscribe((event) => seen.push(event))
  await work()
  subscription.unsubscribe()
  return seen
}

describe('health records in the patient app', () => {
  it('shows a consultation only once signed, with its note, diagnoses, vitals and linked prescription', async () => {
    const c = await clinic()
    const token = await signUp(MOBILE, BIRTH)
    const encounter = (await c.staff.post('/v1/encounters').send({ patientId: c.patient.id, branchId: c.branchId, type: 'Cardiology consultation', reason: 'Chest discomfort' }).expect(201)).body.data
    await c.staff.patch(`/v1/encounters/${encounter.id}`).send({ chiefComplaint: 'Chest tightness on exertion', subjective: 'No rest pain.', objective: 'BP 120/80.', assessment: 'Stable angina.', plan: 'ECG and review in a week.', version: encounter.version }).expect(200)
    await c.staff.post(`/v1/patients/${c.patient.id}/diagnoses`).send({ encounterId: encounter.id, icd: 'I20.9', name: 'Angina pectoris, unspecified', description: 'Exertional symptoms.' }).expect(201)
    await c.staff.post(`/v1/patients/${c.patient.id}/vitals`).send({ encounterId: encounter.id, systolic: 120, diastolic: 80, pulse: 72, respiration: 16, temperatureF: 98.4, spo2: 99, weightKg: 64, heightCm: 168 }).expect(201)
    const rx = (await c.staff.post(`/v1/patients/${c.patient.id}/prescriptions`).send({ encounterId: encounter.id, indication: 'Pain', precautionAcknowledged: true, items: [NAPROXEN] }).expect(201)).body.data

    // An unsigned consultation is not released.
    expect((await phone(token).get('/v1/patient/consultations').expect(200)).body.data).toEqual([])
    await phone(token).get(`/v1/patient/consultations/${encounter.id}`).expect(404)
    // The prescription is, but it cannot point at a consultation the patient cannot open yet.
    expect((await phone(token).get(`/v1/patient/prescriptions/${rx.id}`).expect(200)).body.data.consultation).toBeNull()

    const events = await liveDuring(() => c.staff.post(`/v1/encounters/${encounter.id}/sign`).expect(200))
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ topic: 'records', entityId: encounter.id, patientId: c.patient.id }), expect.objectContaining({ topic: 'notifications' })]))

    const [listed] = (await phone(token).get('/v1/patient/consultations').expect(200)).body.data
    expect(listed).toMatchObject({ id: encounter.id, clinicName: 'Aura Health', practitioner: null, signedBy: 'Siddharth Verma', diagnoses: [{ icd: 'I20.9' }], prescriptions: 1 })
    const detail = (await phone(token).get(`/v1/patient/consultations/${encounter.id}`).expect(200)).body.data
    expect(detail.notes[0].sections).toEqual(expect.arrayContaining([{ heading: 'Assessment', body: 'Stable angina.' }]))
    expect(detail.vitals).toMatchObject({ systolic: 120, diastolic: 80 })
    expect(detail.linkedPrescriptions).toEqual([expect.objectContaining({ id: rx.id })])
    expect((await phone(token).get(`/v1/patient/prescriptions/${rx.id}`).expect(200)).body.data).toMatchObject({
      status: 'active',
      consultation: { id: encounter.id },
      items: [expect.objectContaining({ name: 'Naproxen Sodium', durationDays: 5 })],
    })

    const titles = (await phone(token).get('/v1/patient/notifications').expect(200)).body.data.map((item: { title: string }) => item.title)
    expect(titles).toEqual(['Consultation summary ready', 'New prescription'])
  })

  it('shows an order’s progress, and its result only after a clinician has reviewed it', async () => {
    const c = await clinic()
    const token = await signUp(MOBILE, BIRTH)
    const order = (await c.staff.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Diabetes follow-up', items: [HBA1C] }).expect(201)).body.data
    await c.staff.post(`/v1/orders/${order.id}/collect`).send({ note: 'EDTA tube, slightly haemolysed' }).expect(200)
    await c.staff.post(`/v1/orders/${order.id}/result`).send({ summary: 'HbA1c 11.2% (target below 7%).', flag: 'critical' }).expect(200)

    const waiting = await phone(token).get(`/v1/patient/orders/${order.id}`).expect(200)
    expect(waiting.body.data).toMatchObject({ status: 'awaiting_review', result: null, steps: [{ action: 'ordered' }, { action: 'collected' }, { action: 'resulted' }] })
    expect(JSON.stringify(waiting.body)).not.toMatch(/11\.2|haemolysed|critical/)
    expect((await phone(token).get('/v1/patient/orders?scope=results').expect(200)).body.data).toHaveLength(1)

    await c.staff.post(`/v1/orders/${order.id}/review`).send({ outcome: 'action', note: 'Start basal insulin; review in two weeks.' }).expect(200)
    const reviewed = await phone(token).get(`/v1/patient/orders/${order.id}`).expect(200)
    expect(reviewed.body.data.result).toMatchObject({ summary: 'HbA1c 11.2% (target below 7%).', flag: 'critical', followUp: true })
    expect(JSON.stringify(reviewed.body)).not.toMatch(/basal insulin|haemolysed/)

    const overview = (await phone(token).get('/v1/patient/records/overview').expect(200)).body.data
    expect(overview.counts).toMatchObject({ orders: 1, openOrders: 0, results: 1, reportsReady: 1 })
    expect(overview.latest.result).toMatchObject({ id: order.id, kind: 'result' })
    expect((await phone(token).get('/v1/patient/notifications').expect(200)).body.data.map((item: { title: string }) => item.title)).toEqual(['Test result ready'])
  })

  it('shows care plans without the care team’s review notes', async () => {
    const c = await clinic()
    const token = await signUp(MOBILE, BIRTH)
    const start = today()
    const plan = (await c.staff.post(`/v1/patients/${c.patient.id}/care-plans`).send({
      title: 'Hypertension control', category: 'Chronic Disease Management', leadPractitionerId: c.practitioner.id, rationale: 'Bring blood pressure under 130/80.',
      startDate: start, nextReview: addDays(start, 30), targetDate: addDays(start, 180), diagnoses: [{ icd: 'I10', name: 'Essential (primary) hypertension' }],
      goals: [{ title: 'Blood pressure', target: '< 130/80 mmHg', cadence: 'Every 30 Days' }], interventions: [{ type: 'medication', title: 'Review antihypertensives' }], education: ['Chest pain'],
    }).expect(201)).body.data
    await c.staff.post(`/v1/care-plans/${plan.id}/reviews`).send({ mode: 'escalate', observation: 'Family reports missed doses at home.', goalStatus: { [plan.goals[0].id]: 'Worsening' }, adherence: ['Partially Completed'], version: plan.version }).expect(200)

    const shown = await phone(token).get(`/v1/patient/care-plans/${plan.id}`).expect(200)
    expect(shown.body.data).toMatchObject({ title: 'Hypertension control', status: 'at_risk', lead: { displayName: 'Dr. Rahul Mehta' }, goals: [{ status: 'Worsening' }], branch: { id: c.branchId, bookable: true } })
    expect(JSON.stringify(shown.body)).not.toMatch(/missed doses/)
    expect((await phone(token).get('/v1/patient/records/history').expect(200)).body.data).toEqual([expect.objectContaining({ kind: 'care_plan', id: plan.id })])
  })

  it('keeps one patient out of another’s records, and closes them when the clinic removes access', async () => {
    const c = await clinic()
    const mine = await signUp(MOBILE, BIRTH)
    const theirs = await signUp('9812345678', '1990-01-01', 'Ravi Kumar')
    const rx = (await c.staff.post(`/v1/patients/${c.patient.id}/prescriptions`).send({ branchId: c.branchId, indication: 'Pain', items: [NAPROXEN] }).expect(201)).body.data
    const order = (await c.staff.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Check', items: [HBA1C] }).expect(201)).body.data

    for (const url of [`/v1/patient/prescriptions/${rx.id}`, `/v1/patient/orders/${order.id}`]) await phone(theirs).get(url).expect(404)
    expect((await phone(theirs).get('/v1/patient/prescriptions').expect(200)).body.data).toEqual([])
    expect((await phone(theirs).get('/v1/patient/records/overview').expect(200)).body.data.counts).toMatchObject({ prescriptions: 0, orders: 0 })
    await phone(mine).get(`/v1/patient/prescriptions/${rx.id}`).expect(200)

    const link = await ctx.prisma.patientLink.findFirstOrThrow({ where: { patientId: c.patient.id } })
    await c.staff.delete(`/v1/patients/${c.patient.id}/app-links/${link.id}`).expect(204)
    await phone(mine).get(`/v1/patient/prescriptions/${rx.id}`).expect(404)
    expect((await phone(mine).get('/v1/patient/records/history').expect(200)).body.data).toEqual([])
  })
})
