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

const NAPROXEN = { medicineCode: 'naproxen', name: 'Naproxen Sodium', strength: '250 mg', form: 'Tablet', route: 'Oral', drugClass: 'nsaid', dose: 1, frequency: 'Twice daily (1-0-1)', frequencyPerDay: 2, food: 'After food', durationDays: 5, indication: 'Low back pain' }
const AMOXICILLIN = { ...NAPROXEN, medicineCode: 'amoxicillin', name: 'Amoxicillin', strength: '500 mg', form: 'Capsule', drugClass: 'penicillin', frequency: 'Thrice daily (1-1-1)', frequencyPerDay: 3, indication: 'Infection' }
const HBA1C = { code: 'LAB-HBA1C-01', name: 'Glycated Hemoglobin (HbA1c)', category: 'Laboratory', loinc: '4548-4', destination: 'In-house laboratory', priority: 'Routine (Outpatient OPD)' }
const ECG = { code: 'CARD-ECG-12', name: '12-Lead ECG at Rest', category: 'Special Diagnostics', loinc: '11524-6', destination: 'Cardiology diagnostics', priority: 'Urgent' }

// An organisation with a therapist (the owner), a patient and an arrived walk-in.
async function clinic(email = 'owner@aura.test') {
  const { browser, orgId } = await createOwner(ctx, email)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const membershipId = (await owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
  const practitioner = (await owner.post('/v1/practitioners').send({ membershipId, displayName: 'Dr. Rahul Mehta', specialty: 'Cardiology', department: 'Cardiology', slotMinutes: 30 }).expect(201)).body.data
  const patient = (await owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: branchId }).expect(201)).body.data
  const chart = async () => (await owner.get(`/v1/patients/${patient.id}/chart`).expect(200)).body.data
  return { owner, ownerBrowser: browser, orgId, branchId, practitioner, patient, chart, as }
}

async function member(c: Awaited<ReturnType<typeof clinic>>, email: string, role: string) {
  const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.owner.post('/v1/invitations').send({ email, roleIds: [roles.find((entry) => entry.name === role)!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: 'Ravi Kumar', password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, email)
  return c.as(browser)
}

describe('prescriptions', () => {
  it('refuses a drug the patient is allergic to and an NSAID with raised blood pressure until the precaution is acknowledged', async () => {
    const c = await clinic()
    await c.owner.post(`/v1/patients/${c.patient.id}/allergies`).send({ substance: 'Penicillin', drugClass: 'penicillin', severity: 'moderate', reaction: 'Rash' }).expect(201)
    const conflict = await c.owner.post(`/v1/patients/${c.patient.id}/prescriptions`).send({ branchId: c.branchId, indication: 'Infection', items: [AMOXICILLIN] }).expect(422)
    expect(conflict.body.error).toMatchObject({ code: 'ALLERGY_CONFLICT', message: expect.stringMatching(/Penicillin allergy/) })

    await c.owner.post(`/v1/patients/${c.patient.id}/vitals`).send({ systolic: 142, diastolic: 88, pulse: 80, respiration: 16, temperatureF: 98.4, spo2: 98, weightKg: 64, heightCm: 168 }).expect(201)
    const precaution = await c.owner.post(`/v1/patients/${c.patient.id}/prescriptions`).send({ branchId: c.branchId, indication: 'Back pain', items: [NAPROXEN] }).expect(422)
    expect(precaution.body.error.code).toBe('PRECAUTION_REQUIRED')

    const signed = (await c.owner.post(`/v1/patients/${c.patient.id}/prescriptions`).send({ branchId: c.branchId, indication: 'Back pain', precautionAcknowledged: true, items: [NAPROXEN] }).expect(201)).body.data
    expect(signed).toMatchObject({ reference: 'RX-000001', status: 'active', prescriberName: 'Dr. Rahul Mehta', precautionAcknowledged: true, contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) })
    // Quantity comes from the server: 1 tablet, twice a day, for 5 days.
    expect(signed.items[0]).toMatchObject({ dose: '1 Tablet', quantity: 10 })
    expect(signed.events.map((event: { action: string }) => event.action)).toEqual(['signed'])

    await c.owner.post(`/v1/prescriptions/${signed.id}/discontinue`).send({ reason: 'short' }).expect(400)
    const stopped = await c.owner.post(`/v1/prescriptions/${signed.id}/discontinue`).send({ reason: 'Pain resolved; switched to paracetamol.' }).expect(200)
    expect(stopped.body.data.status).toBe('discontinued')
    expect((await c.owner.post(`/v1/prescriptions/${signed.id}/discontinue`).send({ reason: 'Pain resolved; switched to paracetamol.' }).expect(409)).body.error.code).toBe('PRESCRIPTION_CLOSED')
    expect((await c.chart()).prescriptions).toHaveLength(1)
  })
})

describe('diagnostic orders', () => {
  it('runs a lab order through collection, a critical result that raises an alert, and a review that clears it', async () => {
    const c = await clinic()
    const order = (await c.owner.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Diabetes follow-up', items: [HBA1C] }).expect(201)).body.data
    expect(order).toMatchObject({ reference: 'ORD-000001', kind: 'lab', status: 'ordered', urgent: false, orderingName: 'Dr. Rahul Mehta (Cardiology)' })

    expect((await c.owner.post(`/v1/orders/${order.id}/result`).send({ summary: 'HbA1c 11.2%', flag: 'critical' }).expect(409)).body.error.message).toMatch(/Collect the specimen/)
    const collected = (await c.owner.post(`/v1/orders/${order.id}/collect`).send({ note: 'EDTA tube' }).expect(200)).body.data
    expect(collected).toMatchObject({ status: 'processing', accession: 'ORD-000001-S1' })

    await c.owner.post(`/v1/orders/${order.id}/result`).send({ summary: 'HbA1c 11.2% (target below 7%).', flag: 'critical' }).expect(200)
    let chart = await c.chart()
    const alert = chart.alerts.find((entry: { orderId: string | null }) => entry.orderId === order.id)
    expect(alert).toMatchObject({ kind: 'RESULT: CRITICAL', severity: 'critical', status: 'active' })
    expect((await c.owner.get(`/v1/clinical/worklist?date=${today()}`).expect(200)).body.data.ordersAwaitingReview).toBe(1)

    await c.owner.post(`/v1/orders/${order.id}/review`).send({ outcome: 'action', note: 'short' }).expect(400)
    const reviewed = (await c.owner.post(`/v1/orders/${order.id}/review`).send({ outcome: 'action', note: 'Start basal insulin; review in two weeks.' }).expect(200)).body.data
    expect(reviewed).toMatchObject({ status: 'reviewed', review: { outcome: 'action', by: 'Siddharth Verma' } })
    chart = await c.chart()
    expect(chart.alerts.find((entry: { id: string }) => entry.id === alert.id).status).toBe('resolved')
    expect((await c.owner.post(`/v1/orders/${order.id}/review`).send({ outcome: 'action', note: 'Start basal insulin; review in two weeks.' }).expect(409)).body.error.code).toBe('ORDER_STATE')
  })

  it('takes imaging results without a specimen and cancels only orders without a result', async () => {
    const c = await clinic()
    const ecg = (await c.owner.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Palpitations', items: [ECG] }).expect(201)).body.data
    expect(ecg).toMatchObject({ kind: 'imaging', urgent: true })
    expect((await c.owner.post(`/v1/orders/${ecg.id}/collect`).send({}).expect(422)).body.error.code).toBe('NO_SPECIMEN')
    await c.owner.post(`/v1/orders/${ecg.id}/result`).send({ summary: 'Sinus rhythm, no ST changes.', flag: 'normal' }).expect(200)
    expect((await c.owner.post(`/v1/orders/${ecg.id}/cancel`).send({ reason: 'Ordered twice by mistake.' }).expect(409)).body.error.code).toBe('ORDER_STATE')
    // A normal result raises no alert.
    expect((await c.chart()).alerts).toHaveLength(0)

    const lab = (await c.owner.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Diabetes follow-up', items: [HBA1C] }).expect(201)).body.data
    expect((await c.owner.post(`/v1/orders/${lab.id}/cancel`).send({ reason: 'Ordered twice by mistake.' }).expect(200)).body.data.status).toBe('cancelled')
  })
})

describe('referrals', () => {
  it('sends a referral to one of the clinic’s therapists, follows it up and stops re-routing once accepted', async () => {
    const c = await clinic()
    const referral = (await c.owner
      .post(`/v1/patients/${c.patient.id}/referrals`)
      .send({ direction: 'outgoing', targetPractitionerId: c.practitioner.id, priority: 'High / Expedited (48h)', model: 'Second Opinion', specialty: 'Cardiology', indication: 'Exertional chest pain', narrative: 'Two weeks of exertional chest tightness; ECG normal.', questions: ['Is a stress test needed?'] })
      .expect(201)).body.data
    expect(referral).toMatchObject({ reference: 'REF-000001', status: 'pending_acceptance', windowHours: 48, elapsedHours: 0, clinician: 'Dr. Rahul Mehta', targetPractitioner: { id: c.practitioner.id } })

    const followed = (await c.owner.post(`/v1/referrals/${referral.id}/follow-up`).send({ method: 'phone', representative: 'Triage nurse', staff: 'Liaison desk', outcome: 'accepted', notes: 'Accepted; appointment to follow by phone.' }).expect(200)).body.data
    expect(followed.status).toBe('accepted')
    expect(followed.events[0].title).toBe('Phone call outreach — Acceptance Confirmed')
    expect((await c.owner.post(`/v1/referrals/${referral.id}/reroute`).expect(409)).body.error.code).toBe('REFERRAL_STATE')
  })

  it('logs a received referral for triage and accepts it once', async () => {
    const c = await clinic()
    const incoming = (await c.owner
      .post(`/v1/patients/${c.patient.id}/referrals`)
      .send({ direction: 'incoming', clinician: 'Dr. K. Rao', clinicianNote: 'City Hospital', facility: 'Cardiology OPD', priority: 'Routine (within 2 weeks)', model: 'Specialist Consultation & Opinion', specialty: 'Cardiology', indication: 'Murmur', narrative: 'New systolic murmur on routine examination.' })
      .expect(201)).body.data
    expect(incoming).toMatchObject({ status: 'awaiting_review', windowHours: 336 })
    expect((await c.owner.post(`/v1/referrals/${incoming.id}/follow-up`).send({ method: 'phone', representative: 'Desk', staff: 'Desk', outcome: 'accepted', notes: 'Not applicable to received referrals.' }).expect(422)).body.error.code).toBe('REFERRAL_DIRECTION')
    expect((await c.owner.post(`/v1/referrals/${incoming.id}/triage`).send({ decision: 'accept' }).expect(200)).body.data).toMatchObject({ status: 'accepted', outcome: 'Accepted for clinical intake' })
    expect((await c.owner.post(`/v1/referrals/${incoming.id}/triage`).send({ decision: 'decline' }).expect(409)).body.error.code).toBe('REFERRAL_STATE')
  })
})

describe('care plans', () => {
  it('activates a plan, enforces the follow-up rules, escalates a worsening goal and refuses a stale review', async () => {
    const c = await clinic()
    const start = today()
    const plan = (await c.owner
      .post(`/v1/patients/${c.patient.id}/care-plans`)
      .send({
        title: 'Hypertension control', category: 'Chronic Disease Management', leadPractitionerId: c.practitioner.id, rationale: 'Bring blood pressure under 130/80 with medication and lifestyle change.',
        startDate: start, nextReview: addDays(start, 30), targetDate: addDays(start, 180), diagnoses: [{ icd: 'I10', name: 'Essential (primary) hypertension' }],
        goals: [{ title: 'Blood pressure', target: '< 130/80 mmHg', cadence: 'Every 30 Days' }], interventions: [{ type: 'medication', title: 'Review antihypertensives' }], education: ['Chest pain'],
      })
      .expect(201)).body.data
    expect(plan).toMatchObject({ reference: 'CP-000001', status: 'on_track', compliance: 0, lead: { id: c.practitioner.id }, goals: [{ status: 'Pending Baseline' }] })
    const goalId = plan.goals[0].id

    const unrated = await c.owner.post(`/v1/care-plans/${plan.id}/reviews`).send({ mode: 'complete', observation: 'Seen in clinic today.', nextReview: addDays(start, 30), version: plan.version }).expect(422)
    expect(unrated.body.error.message).toMatch(/every goal/)
    const notEscalated = await c.owner.post(`/v1/care-plans/${plan.id}/reviews`).send({ mode: 'complete', observation: 'BP higher than last visit.', goalStatus: { [goalId]: 'Worsening' }, nextReview: addDays(start, 14), version: plan.version }).expect(422)
    expect(notEscalated.body.error.message).toMatch(/escalated/)

    const escalated = (await c.owner.post(`/v1/care-plans/${plan.id}/reviews`).send({ mode: 'escalate', observation: 'BP higher than last visit.', goalStatus: { [goalId]: 'Worsening' }, adherence: ['Partially Completed'], version: plan.version }).expect(200)).body.data
    expect(escalated).toMatchObject({ status: 'at_risk', compliance: 0, goals: [{ status: 'Worsening' }], interventions: [{ state: 'Partially Completed' }], reviews: [{ kind: 'escalated' }] })
    expect((await c.chart()).alerts[0]).toMatchObject({ kind: 'CLINICAL FLAG: CARE PLAN ESCALATION', severity: 'high' })

    expect((await c.owner.post(`/v1/care-plans/${plan.id}/reviews`).send({ mode: 'save', observation: 'Another note from a stale screen.', version: plan.version }).expect(409)).body.error.code).toBe('CARE_PLAN_CHANGED')
    // Due for review by the interim date.
    expect((await c.owner.get(`/v1/clinical/worklist?date=${addDays(start, 30)}`).expect(200)).body.data.followUpsDue).toBe(1)
    expect((await c.owner.get(`/v1/clinical/worklist?date=${start}`).expect(200)).body.data.followUpsDue).toBe(0)
  })
})

describe('incidents', () => {
  it('lets any member report, keeps anonymous reports untraceable and flags the chart for a sentinel event', async () => {
    const c = await clinic()
    const desk = await member(c, 'desk@aura.test', 'Front Desk & Reception')
    const report = { category: 'medication', severity: 5, date: today(), time: '10:30', branchId: c.branchId, zone: 'Pharmacy Dispensary', patientId: c.patient.id, headline: 'Wrong strength dispensed', chronology: 'A 500 mg strength was handed over instead of 250 mg and noticed at home by the patient.', actions: 'Patient recalled and reviewed.', anonymous: true }

    await desk.post('/v1/incidents').send({ ...report, date: addDays(today(), 1) }).expect(422)
    const filed = (await desk.post('/v1/incidents').send(report).expect(201)).body.data
    expect(filed).toMatchObject({ reference: 'INC-000001', severity: 5, reporter: 'Anonymous (safe harbor)', patient: { id: c.patient.id } })

    // Front desk can report but not read the register; the clinician view shows it.
    await desk.get('/v1/incidents').expect(403)
    expect((await c.owner.get('/v1/incidents').expect(200)).body.meta.total).toBe(1)

    const alert = (await c.chart()).alerts[0]
    expect(alert).toMatchObject({ kind: 'SENTINEL EVENT', severity: 'critical', createdBy: 'Anonymous incident report' })
    const row = await ctx.prisma.incident.findUniqueOrThrow({ where: { id: filed.id } })
    expect(row.reporterId).toBeNull()
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'incident.reported' } })
    expect(audit).toMatchObject({ actorUserId: null, ip: null, userAgent: null })
  })
})

describe('access', () => {
  it('needs clinical write access and keeps records inside the organisation', async () => {
    const c = await clinic()
    const order = (await c.owner.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Diabetes follow-up', items: [HBA1C] }).expect(201)).body.data
    const desk = await member(c, 'desk@aura.test', 'Front Desk & Reception')
    await desk.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: c.branchId, indication: 'Diabetes follow-up', items: [HBA1C] }).expect(403)
    await desk.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'Trying without permission.' }).expect(403)

    const other = await clinic('owner@other.test')
    await other.owner.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'Another organisation trying.' }).expect(404)
    await other.owner.post(`/v1/patients/${c.patient.id}/prescriptions`).send({ branchId: other.branchId, indication: 'Back pain', items: [NAPROXEN] }).expect(404)
    // Their own branch id cannot be used for another organisation's patient, and vice versa.
    await c.owner.post(`/v1/patients/${c.patient.id}/orders`).send({ branchId: other.branchId, indication: 'Diabetes follow-up', items: [HBA1C] }).expect(422)
  })
})
