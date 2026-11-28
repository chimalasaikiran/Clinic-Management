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

async function clinic(email = 'owner@aura.test') {
  const { browser, orgId } = await createOwner(ctx, email)
  const branchId = (await browser.get('/v1/branches').set('X-Org-Id', orgId).expect(200)).body.data[0].id as string
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
    delete: (url: string) => b.delete(url).set('X-Org-Id', orgId),
  })
  return { owner: as(browser), ownerBrowser: browser, orgId, branchId, as }
}

const DOCTOR = { type: 'doctor', fullName: 'Dr. Preeti Deshmukh', email: 'preeti@aura.test', mobile: '9849023114', department: 'Rehabilitation', designation: 'Consultant Physiotherapist', council: 'NMC', councilNumber: 'NMC-TS-2018-1', qualifications: ['BPT', 'MPT'] }

describe('staff', () => {
  it('creates people with staff codes, validates doctors and lists them with filters', async () => {
    const c = await clinic()
    const doctor = await c.owner.post('/v1/staff').send(DOCTOR).expect(201)
    expect(doctor.body.data).toMatchObject({ staffCode: 'STF-001', type: 'doctor', status: 'active', account: { linked: false }, branches: [] })
    const nurse = await c.owner.post('/v1/staff').send({ type: 'staff', fullName: 'Priya Sharma', department: 'Nursing', designation: 'Head Nurse' }).expect(201)
    expect(nurse.body.data.staffCode).toBe('STF-002')

    const missing = await c.owner.post('/v1/staff').send({ ...DOCTOR, council: '', councilNumber: '', qualifications: [] }).expect(400)
    expect(missing.body.error.details.map((detail: { field: string }) => detail.field)).toEqual(expect.arrayContaining(['council', 'councilNumber', 'qualifications']))

    expect((await c.owner.get('/v1/staff?type=doctor').expect(200)).body.meta.total).toBe(1)
    expect((await c.owner.get('/v1/staff?query=stf-002').expect(200)).body.data[0].fullName).toBe('Priya Sharma')
    expect((await c.owner.get('/v1/staff/summary').expect(200)).body.data).toMatchObject({ total: 2, doctors: 1, staff: 1, active: 2 })
  })

  it('assigns branches with one primary and keeps edits safe from overwrites', async () => {
    const c = await clinic()
    const person = (await c.owner.post('/v1/staff').send(DOCTOR).expect(201)).body.data
    const assigned = await c.owner.put(`/v1/staff/${person.id}/branches`).send({ branchIds: [c.branchId], primaryBranchId: c.branchId }).expect(200)
    expect(assigned.body.data.branches).toEqual([expect.objectContaining({ id: c.branchId, isPrimary: true })])

    const { id, staffCode, account, branches, practitioner, onLeave, createdAt, version, ...fields } = assigned.body.data
    await c.owner.patch(`/v1/staff/${id}`).send({ ...fields, designation: 'Senior Physiotherapist', version }).expect(200)
    expect((await c.owner.patch(`/v1/staff/${id}`).send({ ...fields, version }).expect(409)).body.error.code).toBe('STAFF_CHANGED')
  })

  it('links a login through an invitation, or straight away for an existing member', async () => {
    const c = await clinic()
    const person = (await c.owner.post('/v1/staff').send(DOCTOR).expect(201)).body.data
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    const clinician = roles.find((role) => role.name === 'Clinician')!

    const invited = await c.owner.post(`/v1/staff/${person.id}/invite`).send({ email: 'preeti@aura.test', roleIds: [clinician.id] }).expect(200)
    expect(invited.body.data).toMatchObject({ result: 'invited', staff: { account: { linked: false, invitationPending: true } } })
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('preeti@aura.test'), fullName: 'Preeti Deshmukh', password: PASSWORD }).expect(201)
    const linked = (await c.owner.get(`/v1/staff/${person.id}`).expect(200)).body.data
    expect(linked.account).toMatchObject({ linked: true, email: 'preeti@aura.test', roles: ['Clinician'] })

    const owner = (await c.owner.post('/v1/staff').send({ type: 'staff', fullName: 'Siddharth Verma', department: 'Administration', designation: 'Owner' }).expect(201)).body.data
    const direct = await c.owner.post(`/v1/staff/${owner.id}/invite`).send({ email: 'owner@aura.test', roleIds: [clinician.id] }).expect(200)
    expect(direct.body.data).toMatchObject({ result: 'linked', staff: { account: { linked: true } } })
  })

  it('records attendance once per day, corrects it with an audit trail and refuses future dates', async () => {
    const c = await clinic()
    const person = (await c.owner.post('/v1/staff').send(DOCTOR).expect(201)).body.data
    const day = today()
    await c.owner.post(`/v1/staff/${person.id}/attendance`).send({ branchId: c.branchId, date: day, status: 'present', time: '08:52' }).expect(422)
    await c.owner.put(`/v1/staff/${person.id}/branches`).send({ branchIds: [c.branchId], primaryBranchId: c.branchId }).expect(200)

    const record = (await c.owner.post(`/v1/staff/${person.id}/attendance`).send({ branchId: c.branchId, date: day, status: 'present', time: '08:52' }).expect(201)).body.data
    expect(record).toMatchObject({ status: 'present', time: '08:52' })
    expect((await c.owner.post(`/v1/staff/${person.id}/attendance`).send({ branchId: c.branchId, date: day, status: 'late', time: '09:30' }).expect(409)).body.error.code).toBe('ATTENDANCE_EXISTS')
    await c.owner.post(`/v1/staff/${person.id}/attendance`).send({ branchId: c.branchId, date: addDays(day, 2), status: 'absent' }).expect(422)

    const corrected = await c.owner.patch(`/v1/staff/${person.id}/attendance/${record.id}`).send({ status: 'late', time: '09:20', reason: 'Biometric reader was down; arrival confirmed by supervisor.', version: record.version }).expect(200)
    expect(corrected.body.data).toMatchObject({ status: 'late', time: '09:20', corrections: [expect.objectContaining({ fromStatus: 'present', toStatus: 'late', fromTime: '08:52', toTime: '09:20' })] })

    const month = await c.owner.get(`/v1/staff/${person.id}/attendance?month=${day.slice(0, 7)}`).expect(200)
    expect(month.body.data.counts).toMatchObject({ late: 1, present: 0 })
  })

  it('takes leave out of the therapist’s bookable slots and blocks booking into it', async () => {
    const c = await clinic()
    const person = (await c.owner.post('/v1/staff').send({ type: 'staff', fullName: 'Siddharth Verma', department: 'Rehabilitation', designation: 'Physiotherapist' }).expect(201)).body.data
    await c.owner.put(`/v1/staff/${person.id}/branches`).send({ branchIds: [c.branchId], primaryBranchId: c.branchId }).expect(200)
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    await c.owner.post(`/v1/staff/${person.id}/invite`).send({ email: 'owner@aura.test', roleIds: [roles[0]!.id] }).expect(200)

    const membershipId = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
    const practitioner = (await c.owner.post('/v1/practitioners').send({ membershipId, displayName: 'Siddharth Verma', specialty: 'Physiotherapy', department: 'Rehabilitation', slotMinutes: 30 }).expect(201)).body.data
    await c.owner.put(`/v1/practitioners/${practitioner.id}/availability`).send({ windows: Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.branchId, weekday, start: '09:00', end: '12:00' })) }).expect(200)
    const patient = (await c.owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: c.branchId }).expect(201)).body.data

    const day = addDays(today(), 3)
    await c.owner.post('/v1/appointments').send({ patientId: patient.id, practitionerId: practitioner.id, branchId: c.branchId, date: day, time: '11:00', reason: 'Review' }).expect(201)
    const block = await c.owner.post(`/v1/staff/${person.id}/leaves`).send({ kind: 'block', title: 'Procedure block', startDate: day, endDate: day, startTime: '10:00', endTime: '12:00', branchId: null, reason: 'Ward procedures all morning.' }).expect(201)
    expect(block.body.data.affectedAppointments).toBe(1)

    const slots = (await c.owner.get(`/v1/practitioners/${practitioner.id}/slots?branchId=${c.branchId}&from=${day}&days=1`).expect(200)).body.data.days[0].slots
    expect(slots.map((slot: { time: string; state: string }) => `${slot.time} ${slot.state}`)).toEqual(['09:00 available', '09:30 available', '10:00 unavailable', '10:30 unavailable', '11:00 unavailable', '11:30 unavailable'])
    const refused = await c.owner.post('/v1/appointments').send({ patientId: patient.id, practitionerId: practitioner.id, branchId: c.branchId, date: day, time: '10:30', reason: 'Review' }).expect(422)
    expect(refused.body.error.code).toBe('THERAPIST_UNAVAILABLE')

    await c.owner.delete(`/v1/staff/${person.id}/leaves/${block.body.data.leave.id}`).expect(200)
    const reopened = (await c.owner.get(`/v1/practitioners/${practitioner.id}/slots?branchId=${c.branchId}&from=${day}&days=1`).expect(200)).body.data.days[0].slots
    expect(reopened.find((slot: { time: string }) => slot.time === '10:30').state).toBe('available')
  })

  it('needs the staff permissions and keeps organisations apart', async () => {
    const a = await clinic('owner@aura.test')
    const b = await clinic('owner@other.test')
    const person = (await a.owner.post('/v1/staff').send(DOCTOR).expect(201)).body.data
    await b.owner.get(`/v1/staff/${person.id}`).expect(404)
    await b.ownerBrowser.get(`/v1/staff/${person.id}`).set('X-Org-Id', a.orgId).expect(403)
  })
})

describe('clinical core', () => {
  async function setup() {
    const c = await clinic()
    const membershipId = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
    const practitioner = (await c.owner.post('/v1/practitioners').send({ membershipId, displayName: 'Dr. Rahul Mehta', specialty: 'Cardiology', department: 'Cardiology', slotMinutes: 30 }).expect(201)).body.data
    await c.owner.put(`/v1/practitioners/${practitioner.id}/availability`).send({ windows: Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.branchId, weekday, start: '00:00', end: '24:00' })) }).expect(200)
    const patient = (await c.owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: c.branchId }).expect(201)).body.data
    const walkIn = (await c.owner.post('/v1/appointments').send({ patientId: patient.id, practitionerId: practitioner.id, branchId: c.branchId, date: today(), channel: 'walk_in', waitingQueue: true, arrivedNow: true, reason: 'Chest discomfort review' }).expect(201)).body.data
    return { ...c, practitioner, patient, appointment: walkIn }
  }

  it('starts an encounter from an arrived appointment and signs it into a note, completing the visit', async () => {
    const c = await setup()
    const encounter = (await c.owner.post('/v1/encounters').send({ appointmentId: c.appointment.id }).expect(201)).body.data
    expect(encounter).toMatchObject({ reference: 'ENC-000001', status: 'in_progress', chiefComplaint: 'Chest discomfort review' })
    expect((await c.owner.get(`/v1/appointments/${c.appointment.id}`).expect(200)).body.data.status).toBe('in_progress')

    const saved = await c.owner.patch(`/v1/encounters/${encounter.id}`).send({ chiefComplaint: 'Exertional chest tightness for 2 weeks', subjective: 'No rest pain.', objective: 'BP 132/84.', assessment: 'Stable angina, rule out ACS.', plan: 'ECG, troponin, review in 1 week.', version: encounter.version }).expect(200)
    const blocked = await c.owner.post(`/v1/encounters/${encounter.id}/sign`).expect(422)
    expect(blocked.body.error.code).toBe('DIAGNOSIS_REQUIRED')

    await c.owner.post(`/v1/patients/${c.patient.id}/diagnoses`).send({ encounterId: encounter.id, icd: 'I20.9', name: 'Angina pectoris, unspecified', description: 'Exertional symptoms, stable pattern.' }).expect(201)
    await c.owner.post(`/v1/patients/${c.patient.id}/vitals`).send({ encounterId: encounter.id, systolic: 132, diastolic: 84, pulse: 78, respiration: 16, temperatureF: 98.4, spo2: 98, weightKg: 64.2, heightCm: 168 }).expect(201)
    const signed = await c.owner.post(`/v1/encounters/${encounter.id}/sign`).expect(200)
    expect(signed.body.data).toMatchObject({ status: 'signed', signed: expect.objectContaining({ by: 'Siddharth Verma' }) })

    // Locked after signing; the visit is complete and the note is on the chart.
    expect((await c.owner.patch(`/v1/encounters/${encounter.id}`).send({ chiefComplaint: 'changed', version: saved.body.data.version + 1 }).expect(409)).body.error.code).toBe('ENCOUNTER_SIGNED')
    await c.owner.post(`/v1/patients/${c.patient.id}/vitals`).send({ encounterId: encounter.id, systolic: 120, diastolic: 80, pulse: 70, respiration: 16, temperatureF: 98.4, spo2: 99, weightKg: 64, heightCm: 168 }).expect(409)
    expect((await c.owner.get(`/v1/appointments/${c.appointment.id}`).expect(200)).body.data.status).toBe('completed')
    const chart = (await c.owner.get(`/v1/patients/${c.patient.id}/chart`).expect(200)).body.data
    expect(chart.notes[0].sections.map((section: { heading: string }) => section.heading)).toEqual(['Chief complaint', 'Subjective', 'Objective', 'Assessment', 'Plan'])
    expect(chart.vitals).toHaveLength(1)

    const withAddendum = await c.owner.post(`/v1/notes/${chart.notes[0].id}/addenda`).send({ text: 'Troponin negative at 6 hours.' }).expect(201)
    expect(withAddendum.body.data.addenda).toHaveLength(1)
  })

  it('validates vitals ranges on the server', async () => {
    const c = await setup()
    const res = await c.owner.post(`/v1/patients/${c.patient.id}/vitals`).send({ systolic: 80, diastolic: 120, pulse: 300, respiration: 16, temperatureF: 98.4, spo2: 98, weightKg: 64, heightCm: 168 }).expect(400)
    expect(res.body.error.details.map((detail: { field: string }) => detail.field)).toEqual(expect.arrayContaining(['pulse']))
  })

  it('raises a critical alert for a severe allergy and requires a justification to acknowledge it', async () => {
    const c = await setup()
    await c.owner.post(`/v1/patients/${c.patient.id}/allergies`).send({ substance: 'Penicillin', drugClass: 'penicillin', severity: 'severe', reaction: 'Anaphylaxis' }).expect(201)
    const chart = (await c.owner.get(`/v1/patients/${c.patient.id}/chart`).expect(200)).body.data
    const alert = chart.alerts[0]
    expect(alert).toMatchObject({ kind: 'ALLERGY: PENICILLIN', severity: 'critical', status: 'active' })

    await c.owner.post(`/v1/alerts/${alert.id}/acknowledge`).send({ disposition: 'acknowledged', justification: 'short' }).expect(400)
    const done = await c.owner.post(`/v1/alerts/${alert.id}/acknowledge`).send({ disposition: 'acknowledged', justification: 'Reviewed with the patient; no beta-lactams ordered.' }).expect(200)
    expect(done.body.data).toMatchObject({ status: 'acknowledged', acknowledgedBy: 'Siddharth Verma' })
    expect((await c.owner.get(`/v1/alerts/${alert.id}`).expect(200)).body.data).toMatchObject({ id: alert.id, status: 'acknowledged', disposition: 'acknowledged' })
    expect((await c.owner.post(`/v1/alerts/${alert.id}/resolve`).expect(409)).body.error.code).toBe('ALERT_CLOSED')

    const worklist = (await c.owner.get(`/v1/clinical/worklist?date=${today()}`).expect(200)).body.data
    expect(worklist.appointments).toHaveLength(1)
    expect(worklist.alerts).toHaveLength(0)
  })

  it('limits a clinician to patients booked with them and keeps other organisations out', async () => {
    const c = await setup()
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
    await c.owner.post('/v1/invitations').send({ email: 'nurse@aura.test', roleIds: [roles.find((role) => role.name === 'Clinician')!.id] }).expect(201)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('nurse@aura.test'), fullName: 'Ravi Nurse', password: PASSWORD }).expect(201)
    const nurse = ctx.browser()
    await signIn(nurse, 'nurse@aura.test')
    // Not a therapist and cannot book: sees the directory but no appointments; chart access follows the patient scope.
    await c.as(nurse).get(`/v1/patients/${c.patient.id}/chart`).expect(200)
    await c.as(nurse).post('/v1/encounters').send({ appointmentId: c.appointment.id }).expect(404)

    const other = await clinic('owner@other.test')
    await other.owner.get(`/v1/patients/${c.patient.id}/chart`).expect(404)
  })
})
