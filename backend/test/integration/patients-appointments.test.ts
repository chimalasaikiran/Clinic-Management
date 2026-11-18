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

const tomorrow = () => addDays(localDate(new Date(), 'Asia/Kolkata'), 1)

const PATIENT = {
  title: 'Ms.',
  fullName: 'Ananya Sharma',
  mobile: '+91 98452 11029',
  pinCode: '500084',
  dateOfBirth: '1992-04-18',
  gender: 'female',
  bloodGroup: 'O+',
  city: 'Hyderabad',
  state: 'Telangana',
}

interface Clinic {
  owner: Browser
  orgId: string
  branchId: string
  as: (browser: Browser) => { get: (url: string) => ReturnType<Browser['get']>; post: (url: string) => ReturnType<Browser['post']>; patch: (url: string) => ReturnType<Browser['patch']>; put: (url: string) => ReturnType<Browser['put']> }
}

async function clinic(email = 'owner@aura.test'): Promise<Clinic> {
  const { browser, orgId } = await createOwner(ctx, email)
  const branches = await browser.get('/v1/branches').set('X-Org-Id', orgId).expect(200)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  return { owner: browser, orgId, branchId: branches.body.data[0].id, as }
}

async function register(c: Clinic, overrides: Record<string, unknown> = {}) {
  const res = await c.as(c.owner).post('/v1/patients').send({ ...PATIENT, homeBranchId: c.branchId, ...overrides }).expect(201)
  return res.body.data
}

// The owner's own membership becomes a therapist consulting every day, 08:00–20:00, in 30-minute slots.
async function therapist(c: Clinic, membershipId?: string) {
  const member = membershipId ?? (await c.as(c.owner).get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
  const created = await c
    .as(c.owner)
    .post('/v1/practitioners')
    .send({ membershipId: member, displayName: 'Dr. Rahul Mehta', credentials: 'MD, DM', specialty: 'Physiotherapy', department: 'Rehabilitation', room: 'Chamber 104', slotMinutes: 30 })
    .expect(201)
  const windows = Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.branchId, weekday, start: '08:00', end: '20:00' }))
  await c.as(c.owner).put(`/v1/practitioners/${created.body.data.id}/availability`).send({ windows }).expect(200)
  return created.body.data
}

// Invites someone with the given role, has them accept, and returns their membership id.
async function joinMember(c: Clinic, email: string, fullName: string, roleName: string) {
  const roles = (await c.as(c.owner).get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.as(c.owner).post('/v1/invitations').send({ email, roleIds: [roles.find((role) => role.name === roleName)!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName, password: PASSWORD }).expect(201)
  const candidates = (await c.as(c.owner).get('/v1/practitioners/candidates').expect(200)).body.data as Array<{ membershipId: string; fullName: string }>
  return candidates.find((entry) => entry.fullName === fullName)!.membershipId
}

function booking(c: Clinic, patientId: string, practitionerId: string, time = '10:00', extra: Record<string, unknown> = {}) {
  return { patientId, practitionerId, branchId: c.branchId, date: tomorrow(), time, type: 'consultation', reason: 'Lower back pain review', ...extra }
}

describe('patients', () => {
  it('registers a patient with an organisation MRN and reads it back from the database', async () => {
    const c = await clinic()
    const patient = await register(c)
    expect(patient).toMatchObject({ mrn: 'PT-000001', fullName: 'Ananya Sharma', mobile: '9845211029', gender: 'female', status: 'active', version: 1, lastVisit: null })
    expect(patient.homeBranch.id).toBe(c.branchId)

    const second = await register(c, { fullName: 'Rajesh Sundaram', mobile: '9444082910', gender: 'male', confirmedNotDuplicate: false })
    expect(second.mrn).toBe('PT-000002')

    const fetched = await c.as(c.owner).get(`/v1/patients/${patient.id}`).expect(200)
    expect(fetched.body.data.dateOfBirth).toBe('1992-04-18')
  })

  it('flags a possible duplicate by mobile number until staff confirm it is a different person', async () => {
    const c = await clinic()
    await register(c)
    const matches = await c.as(c.owner).get('/v1/patients/duplicates?mobile=98452%2011029').expect(200)
    expect(matches.body.data).toHaveLength(1)

    const blocked = await c.as(c.owner).post('/v1/patients').send({ ...PATIENT, fullName: 'Another Person', homeBranchId: c.branchId }).expect(409)
    expect(blocked.body.error.code).toBe('POSSIBLE_DUPLICATE')
    await register(c, { fullName: 'Another Person', confirmedNotDuplicate: true })
  })

  it('validates input on the server', async () => {
    const c = await clinic()
    const res = await c.as(c.owner).post('/v1/patients').send({ ...PATIENT, mobile: '12345', pinCode: '50', dateOfBirth: '2999-01-01', homeBranchId: c.branchId }).expect(400)
    const fields = res.body.error.details.map((detail: { field: string }) => detail.field)
    expect(fields).toEqual(expect.arrayContaining(['mobile', 'pinCode', 'dateOfBirth']))
  })

  it('searches, filters and paginates', async () => {
    const c = await clinic()
    for (let index = 0; index < 5; index += 1) {
      await register(c, { fullName: `Patient ${index}`, mobile: `98000000${10 + index}`, gender: index % 2 ? 'male' : 'female' })
    }
    const page = await c.as(c.owner).get('/v1/patients?page=2&pageSize=2').expect(200)
    expect(page.body.meta).toEqual({ page: 2, pageSize: 2, total: 5 })
    expect(page.body.data).toHaveLength(2)

    const byMobile = await c.as(c.owner).get('/v1/patients?query=800000012').expect(200)
    expect(byMobile.body.data.map((row: { fullName: string }) => row.fullName)).toEqual(['Patient 2'])
    const byGender = await c.as(c.owner).get('/v1/patients?gender=male').expect(200)
    expect(byGender.body.meta.total).toBe(2)
    const byMrn = await c.as(c.owner).get('/v1/patients?query=pt-000005').expect(200)
    expect(byMrn.body.data[0].fullName).toBe('Patient 4')
  })

  it('updates with optimistic locking and manages status', async () => {
    const c = await clinic()
    const patient = await register(c)
    const { id, version, homeBranch, lastVisit, mrn, createdAt, status, statusNote, ...fields } = patient
    const updated = await c.as(c.owner).patch(`/v1/patients/${id}`).send({ ...fields, homeBranchId: homeBranch.id, city: 'Bengaluru', version }).expect(200)
    expect(updated.body.data).toMatchObject({ city: 'Bengaluru', version: 2 })

    const stale = await c.as(c.owner).patch(`/v1/patients/${id}`).send({ ...fields, homeBranchId: homeBranch.id, city: 'Chennai', version }).expect(409)
    expect(stale.body.error.code).toBe('PATIENT_CHANGED')

    const inactive = await c.as(c.owner).patch(`/v1/patients/${id}/status`).send({ status: 'inactive', note: 'Moved city' }).expect(200)
    expect(inactive.body.data).toMatchObject({ status: 'inactive', statusNote: 'Moved city' })
  })

  it('keeps every organisation’s patients private to it', async () => {
    const a = await clinic('owner@aura.test')
    const b = await clinic('owner@other.test')
    const patient = await register(a)

    await b.as(b.owner).get(`/v1/patients/${patient.id}`).expect(404)
    expect((await b.as(b.owner).get('/v1/patients').expect(200)).body.meta.total).toBe(0)
    // Using someone else's organisation id is refused outright.
    await b.owner.get(`/v1/patients/${patient.id}`).set('X-Org-Id', a.orgId).expect(403)
    await ctx.browser().get('/v1/patients').set('X-Org-Id', a.orgId).expect(401)
  })
})

describe('appointments', () => {
  it('lists slots, books, and marks the slot as taken', async () => {
    const c = await clinic()
    const patient = await register(c)
    const doctor = await therapist(c)

    const slots = await c.as(c.owner).get(`/v1/practitioners/${doctor.id}/slots?branchId=${c.branchId}&from=${tomorrow()}&days=1`).expect(200)
    const day = slots.body.data.days[0]
    expect(day.slots).toHaveLength(24)
    expect(day.slots.find((slot: { time: string }) => slot.time === '10:00').state).toBe('available')

    const created = await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id)).expect(201)
    expect(created.body.data).toMatchObject({ reference: 'APT-000001', status: 'confirmed', date: tomorrow(), time: '10:00', endTime: '10:30', durationMinutes: 30 })
    expect(created.body.data.events).toEqual([expect.objectContaining({ action: 'booked', toStatus: 'confirmed' })])

    const after = await c.as(c.owner).get(`/v1/practitioners/${doctor.id}/slots?branchId=${c.branchId}&from=${tomorrow()}&days=1`).expect(200)
    expect(after.body.data.days[0].slots.find((slot: { time: string }) => slot.time === '10:00').state).toBe('booked')
  })

  it('rejects times that are not one of the therapist’s slots', async () => {
    const c = await clinic()
    const patient = await register(c)
    const doctor = await therapist(c)
    const offGrid = await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id, '10:15')).expect(422)
    expect(offGrid.body.error.code).toBe('SLOT_NOT_AVAILABLE')
    const outside = await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id, '21:00')).expect(422)
    expect(outside.body.error.code).toBe('SLOT_NOT_AVAILABLE')
    const past = await c.as(c.owner).post('/v1/appointments').send({ ...booking(c, patient.id, doctor.id), date: addDays(tomorrow(), -3) }).expect(422)
    expect(past.body.error.code).toBe('SLOT_IN_PAST')
  })

  it('prevents double booking of a slot, also when two requests arrive at the same moment', async () => {
    const c = await clinic()
    const first = await register(c)
    const second = await register(c, { fullName: 'Rajesh Sundaram', mobile: '9444082910' })
    const third = await register(c, { fullName: 'Priya Venkataraman', mobile: '9711204821' })
    const doctor = await therapist(c)

    await c.as(c.owner).post('/v1/appointments').send(booking(c, first.id, doctor.id)).expect(201)
    const taken = await c.as(c.owner).post('/v1/appointments').send(booking(c, second.id, doctor.id)).expect(409)
    expect(taken.body.error.code).toBe('SLOT_TAKEN')

    const results = await Promise.all([
      c.as(c.owner).post('/v1/appointments').send(booking(c, second.id, doctor.id, '11:00')),
      c.as(c.owner).post('/v1/appointments').send(booking(c, third.id, doctor.id, '11:00')),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([201, 409])
    const day = await c.as(c.owner).get(`/v1/appointments?date=${tomorrow()}`).expect(200)
    expect(day.body.data.filter((row: { time: string }) => row.time === '11:00')).toHaveLength(1)
  })

  it('stops the same patient being booked twice at once or twice with one therapist on a day', async () => {
    const c = await clinic()
    const patient = await register(c)
    const doctor = await therapist(c)
    const colleague = await therapist(c, await joinMember(c, 'colleague@aura.test', 'Ananya Rao', 'Front Desk & Reception'))

    await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id)).expect(201)
    const sameDay = await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id, '15:00')).expect(409)
    expect(sameDay.body.error.code).toBe('DUPLICATE_BOOKING')
    const overlapping = await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, colleague.id, '10:00')).expect(409)
    expect(overlapping.body.error.code).toBe('PATIENT_DOUBLE_BOOKED')
    await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, colleague.id, '10:30')).expect(201)
  })

  it('runs the full lifecycle and keeps the history', async () => {
    const c = await clinic()
    const patient = await register(c)
    const doctor = await therapist(c)
    const created = await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id, '10:00', { status: 'pending' })).expect(201)
    const id = created.body.data.id
    expect(created.body.data.status).toBe('pending')

    await c.as(c.owner).post(`/v1/appointments/${id}/confirm`).expect(200)
    const moved = await c.as(c.owner).post(`/v1/appointments/${id}/reschedule`).send({ date: tomorrow(), time: '12:30', reason: 'Patient requested', note: 'Patient asked for a later slot.' }).expect(200)
    expect(moved.body.data).toMatchObject({ status: 'confirmed', time: '12:30' })
    expect(moved.body.data.events[0]).toMatchObject({ action: 'reschedule', from: { date: tomorrow(), time: '10:00' }, to: { date: tomorrow(), time: '12:30' } })

    // Check-in is only possible on the day itself, and a no-show only after the time has passed.
    expect((await c.as(c.owner).post(`/v1/appointments/${id}/check-in`).send({}).expect(422)).body.error.code).toBe('NOT_TODAY')
    expect((await c.as(c.owner).post(`/v1/appointments/${id}/no-show`).send({ reason: 'Did not arrive', note: 'No answer on the phone.' }).expect(422)).body.error.code).toBe('NO_SHOW_TOO_EARLY')

    const cancelled = await c.as(c.owner).post(`/v1/appointments/${id}/cancel`).send({ reason: 'Patient requested', note: 'Travelling out of town.' }).expect(200)
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', closedReason: 'Patient requested' })
    expect(cancelled.body.data.events.map((event: { action: string }) => event.action)).toEqual(['cancel', 'reschedule', 'confirm', 'booked'])

    const again = await c.as(c.owner).post(`/v1/appointments/${id}/confirm`).expect(409)
    expect(again.body.error.code).toBe('INVALID_STATUS_CHANGE')
    // The slot is free again once cancelled.
    await c.as(c.owner).post('/v1/appointments').send(booking(c, patient.id, doctor.id, '12:30')).expect(201)
  })

  it('handles walk-ins: checked in with a queue token and taken through to completion', async () => {
    const c = await clinic()
    const patient = await register(c)
    const doctor = await therapist(c)
    const today = localDate(new Date(), 'Asia/Kolkata')
    const walkIn = await c
      .as(c.owner)
      .post('/v1/appointments')
      .send({ patientId: patient.id, practitionerId: doctor.id, branchId: c.branchId, date: today, channel: 'walk_in', waitingQueue: true, arrivedNow: true, reason: 'Acute neck pain' })
      .expect(201)
    expect(walkIn.body.data).toMatchObject({ status: 'arrived', queueToken: 'W-01', waitingQueue: true })

    const id = walkIn.body.data.id
    await c.as(c.owner).post(`/v1/appointments/${id}/start`).expect(200)
    const done = await c.as(c.owner).post(`/v1/appointments/${id}/complete`).expect(200)
    expect(done.body.data.status).toBe('completed')

    const record = await c.as(c.owner).get(`/v1/patients/${patient.id}`).expect(200)
    expect(record.body.data.lastVisit).toMatchObject({ date: today, practitioner: 'Dr. Rahul Mehta', department: 'Rehabilitation' })
  })

  it('limits a therapist without booking rights to their own appointments and patients', async () => {
    const c = await clinic()
    const mine = await therapist(c, await joinMember(c, 'therapist@aura.test', 'Preeti Deshmukh', 'Clinician'))
    const other = await therapist(c)
    const therapistBrowser = ctx.browser()
    await signIn(therapistBrowser, 'therapist@aura.test')

    const seen = await register(c)
    const unseen = await register(c, { fullName: 'Rajesh Sundaram', mobile: '9444082910' })
    const myBooking = await c.as(c.owner).post('/v1/appointments').send(booking(c, seen.id, mine.id)).expect(201)
    const otherBooking = await c.as(c.owner).post('/v1/appointments').send(booking(c, unseen.id, other.id)).expect(201)

    const t = c.as(therapistBrowser)
    expect((await t.get('/v1/appointments').expect(200)).body.data.map((row: { id: string }) => row.id)).toEqual([myBooking.body.data.id])
    await t.get(`/v1/appointments/${otherBooking.body.data.id}`).expect(404)
    expect((await t.get('/v1/patients').expect(200)).body.data.map((row: { id: string }) => row.id)).toEqual([seen.id])
    await t.get(`/v1/patients/${unseen.id}`).expect(404)
    // Clinicians cannot book or cancel, and cannot act on someone else's appointment.
    await t.post('/v1/appointments').send(booking(c, seen.id, mine.id, '16:00')).expect(403)
    await t.post(`/v1/appointments/${otherBooking.body.data.id}/start`).expect(404)
  })
})
