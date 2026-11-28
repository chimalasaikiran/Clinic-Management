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
let baseUrl: string

beforeAll(async () => {
  ctx = await startApp([{ provide: SmsSender, useValue: sms }])
  // A real port, for the event streams: a stream never ends, so it cannot be read through supertest.
  await ctx.app.listen(0)
  baseUrl = (await ctx.app.getUrl()).replace('[::1]', '127.0.0.1')
})
beforeEach(() => resetState(ctx))
afterAll(() => stopApp(ctx))

const MOBILE = '9876543210'
const OTHER_MOBILE = '9812345678'
const BIRTH = '1990-04-12'
// A week ahead in the clinic's time zone, so the slot is always in the future.
const DAY = addDays(localDate(new Date(), 'Asia/Kolkata'), 7)

function phone(token?: string) {
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', url: string) => {
    const test = request(ctx.app.getHttpServer())[method](url)
    return token ? test.set('Authorization', `Bearer ${token}`) : test
  }
  return {
    get: (url: string) => call('get', url),
    post: (url: string) => call('post', url),
    patch: (url: string) => call('patch', url),
    put: (url: string) => call('put', url),
  }
}

async function signUp(mobile = MOBILE, fullName = 'Asha Rao', profile: Record<string, string> | null = { dateOfBirth: BIRTH, gender: 'female', pinCode: '500084' }) {
  await phone().post('/v1/patient/auth/otp/request').send({ mobile }).expect(202)
  const verified = await phone().post('/v1/patient/auth/otp/verify').send({ mobile, code: sms.code(mobile), deviceName: 'Test phone' }).expect(200)
  const res = await phone()
    .post('/v1/patient/auth/register')
    .send({ registrationToken: verified.body.data.registrationToken, fullName, email: 'asha@example.com', password: 'Patient#2026' })
    .expect(201)
  const token = res.body.data.token as string
  if (profile) await phone(token).patch('/v1/patient/me').send(profile).expect(200)
  return token
}

// A listed clinic with `therapists` general physicians consulting 09:00–10:00 every day, and one bookable service.
async function clinic({ therapists = 1, email = 'owner@aura.test' } = {}) {
  const owner = await createOwner(ctx, email)
  const staff = {
    get: (url: string) => owner.browser.get(url).set('X-Org-Id', owner.orgId),
    post: (url: string) => owner.browser.post(url).set('X-Org-Id', owner.orgId),
    put: (url: string) => owner.browser.put(url).set('X-Org-Id', owner.orgId),
    patch: (url: string) => owner.browser.patch(url).set('X-Org-Id', owner.orgId),
  }
  const branchId = (await staff.get('/v1/branches').expect(200)).body.data[0].id as string
  await ctx.prisma.branch.update({ where: { id: branchId }, data: { listedInPatientApp: true } })

  const me = await ctx.prisma.membership.findFirstOrThrow({ where: { orgId: owner.orgId } })
  const practitionerIds: string[] = []
  for (let index = 0; index < therapists; index += 1) {
    let membershipId = me.id
    if (index > 0) {
      const user = await ctx.prisma.user.create({ data: { email: `doctor${index}.${email}`, fullName: `Doctor ${index}`, passwordHash: 'unused', emailVerifiedAt: new Date() } })
      membershipId = (await ctx.prisma.membership.create({ data: { orgId: owner.orgId, userId: user.id } })).id
    }
    const created = await staff
      .post('/v1/practitioners')
      .send({ membershipId, displayName: `Dr. Mehta ${index + 1}`, specialty: 'General Medicine', department: 'General Medicine', slotMinutes: 30, onlineBooking: true })
      .expect(201)
    const id = created.body.data.id as string
    await staff
      .put(`/v1/practitioners/${id}/availability`)
      .send({ windows: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ branchId, weekday, start: '09:00', end: '10:00' })) })
      .expect(200)
    practitionerIds.push(id)
  }

  const serviceBody = {
    code: 'OPD', name: 'General consultation', category: 'Consultation', department: 'General Medicine', status: 'active',
    price: 600, taxTreatment: 'exempt', taxConfig: 'Healthcare services — Exempt', prices: [{ branchId, price: 650 }], patientBookable: true,
  }
  const serviceId = (await staff.post('/v1/billing/services').send(serviceBody).expect(201)).body.data.id as string

  const book = (token: string, time = '09:00', date = DAY) => phone(token).post('/v1/patient/appointments').send({ branchId, serviceId, date, time })
  const addPatient = async (fullName: string, dateOfBirth = BIRTH, mobile = MOBILE) =>
    (await staff.post('/v1/patients').send({ title: 'Ms.', fullName, mobile, pinCode: '500084', dateOfBirth, gender: 'female', homeBranchId: branchId, confirmedNotDuplicate: true }).expect(201)).body.data.id as string
  return { ...owner, staff, branchId, serviceId, practitionerIds, membershipId: me.id, book, addPatient }
}

const slotsFor = async (token: string, branchId: string, serviceId: string) =>
  (await phone(token).get(`/v1/patient/clinics/${branchId}/slots?serviceId=${serviceId}&from=${DAY}&days=1`).expect(200)).body.data.days[0].slots

// Everything published while `work` runs.
async function liveDuring(work: () => Promise<unknown>) {
  const seen: LiveEvent[] = []
  const subscription = ctx.app.get(LiveService).stream().subscribe((event) => seen.push(event))
  await work()
  subscription.unsubscribe()
  return seen
}

// Opens a Server-Sent Events stream and returns a reader that waits for a named event.
async function openStream(path: string, headers: Record<string, string>) {
  const controller = new AbortController()
  const response = await fetch(`${baseUrl}${path}`, { headers, signal: controller.signal })
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const waitFor = async (event: string) => {
    const timeout = setTimeout(() => controller.abort(), 60_000)
    try {
      while (!text.includes(`event: ${event}\n`)) {
        const { value, done } = await reader.read()
        if (done) throw new Error(`The stream ended before "${event}": ${text}`)
        text += decoder.decode(value, { stream: true })
      }
    } finally {
      clearTimeout(timeout)
    }
  }
  return { status: response.status, contentType: response.headers.get('content-type'), waitFor, text: () => text, close: () => controller.abort() }
}

describe('finding a clinic', () => {
  it('shows only listed clinics, with the services patients may book and the branch’s own price', async () => {
    const { branchId, serviceId } = await clinic()
    const token = await signUp()

    const list = (await phone(token).get('/v1/patient/clinics').expect(200)).body.data
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: branchId, clinicName: 'Aura Health', onlineBooking: true, departments: ['General Medicine'], saved: false, connected: false })

    const detail = (await phone(token).get(`/v1/patient/clinics/${branchId}`).expect(200)).body.data
    expect(detail.services).toEqual([expect.objectContaining({ id: serviceId, name: 'General consultation', fee: 650, gstRate: 0 })])
    expect(detail.booking).toEqual({ status: 'new_record', patientName: 'Asha Rao' })

    await phone(token).put(`/v1/patient/clinics/${branchId}/saved`).expect(200)
    expect((await phone(token).get('/v1/patient/clinics?saved=true').expect(200)).body.data).toHaveLength(1)

    await ctx.prisma.branch.update({ where: { id: branchId }, data: { listedInPatientApp: false } })
    expect((await phone(token).get('/v1/patient/clinics').expect(200)).body.data).toEqual([])
    await phone(token).get(`/v1/patient/clinics/${branchId}`).expect(404)
  })

  it('refuses every booking route without a patient session', async () => {
    const { branchId, browser } = await clinic()
    await phone().get('/v1/patient/clinics').expect(401)
    await phone().get('/v1/patient/appointments').expect(401)
    await phone().get('/v1/patient/notifications').expect(401)
    await phone().get('/v1/patient/events/stream').expect(401)
    // A signed-in staff browser has no standing in the patient realm.
    await browser.get(`/v1/patient/clinics/${branchId}`).expect(401)
  })
})

describe('booking', () => {
  it('registers a new patient, shows the booking to the clinic and tells both sides', async () => {
    const { book, staff, orgId, branchId, serviceId, membershipId } = await clinic()
    const token = await signUp()

    let created!: { id: string; reference: string }
    const events = await liveDuring(async () => {
      created = (await book(token).expect(201)).body.data
    })
    expect(created).toMatchObject({ status: 'confirmed', date: DAY, time: '09:00', fee: 650, serviceName: 'General consultation', patientName: 'Asha Rao', canCancel: true, canReschedule: true })
    expect(created).not.toHaveProperty('internalNote')

    const day = (await staff.get(`/v1/appointments?date=${DAY}&branchId=${branchId}`).expect(200)).body.data
    expect(day).toEqual([expect.objectContaining({ id: created.id, channel: 'portal', bookedBy: 'Patient app', service: 'General consultation' })])

    const patient = await ctx.prisma.patient.findFirstOrThrow({ where: { orgId } })
    expect(patient).toMatchObject({ fullName: 'Asha Rao', mobile: MOBILE, createdById: null, notifySms: false })
    expect(await ctx.prisma.patientLink.findFirstOrThrow()).toMatchObject({ patientId: patient.id, method: 'self_registered' })

    expect(events.map((event) => event.topic)).toEqual(expect.arrayContaining(['app_access', 'appointments', 'notifications']))
    expect(events.find((event) => event.topic === 'appointments')).toMatchObject({ orgId, branchId, entityId: created.id })

    const mine = (await phone(token).get('/v1/patient/notifications').expect(200)).body
    expect(mine.meta.unread).toBe(1)
    expect(mine.data[0]).toMatchObject({ title: 'Appointment booked', entityId: created.id })

    const desk = (await staff.get('/v1/notifications').expect(200)).body
    expect(desk.data[0]).toMatchObject({ title: 'New booking from the patient app', entityId: created.id })
    expect(await ctx.prisma.notification.count({ where: { membershipId } })).toBe(1)
    await staff.post('/v1/notifications/read').send({ all: true }).expect(200)
    expect((await staff.get('/v1/notifications').expect(200)).body.meta.unread).toBe(0)
    // Marking staff notifications read leaves the patient's alone.
    expect((await phone(token).get('/v1/patient/notifications').expect(200)).body.meta.unread).toBe(1)

    expect(await slotsFor(token, branchId, serviceId)).toEqual([
      { time: '09:00', available: false },
      { time: '09:30', available: true },
    ])
  })

  it('uses the existing record when mobile and date of birth match exactly one', async () => {
    const { book, addPatient } = await clinic()
    const patientId = await addPatient('Asha R.')
    const token = await signUp()
    const created = (await book(token).expect(201)).body.data
    expect(created.patientName).toBe('Asha R.')
    expect(await ctx.prisma.patient.count()).toBe(1)
    expect((await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: created.id } })).patientId).toBe(patientId)
  })

  it('sends uncertain matches to the desk instead of guessing or duplicating', async () => {
    const { book, addPatient, branchId } = await clinic()
    await addPatient('Asha Rao')
    await addPatient('Asha Rao (second file)')
    const token = await signUp()
    expect((await phone(token).get(`/v1/patient/clinics/${branchId}`).expect(200)).body.data.booking).toEqual({ status: 'code_required' })
    expect((await book(token).expect(409)).body.error.code).toBe('CLINIC_CODE_REQUIRED')
    expect(await ctx.prisma.patient.count()).toBe(2)
    expect(await ctx.prisma.appointment.count()).toBe(0)
  })

  it('asks for the details a clinic needs before registering someone', async () => {
    const { book } = await clinic()
    const token = await signUp(MOBILE, 'Asha Rao', { dateOfBirth: BIRTH })
    const res = await book(token).expect(422)
    expect(res.body.error).toMatchObject({ code: 'PROFILE_INCOMPLETE' })
    expect(res.body.error.message).toContain('gender, PIN code')
    expect(await ctx.prisma.patient.count()).toBe(0)
  })

  it('gives a shared time to a second therapist, then refuses without leaving anything behind', async () => {
    const { book, practitionerIds } = await clinic({ therapists: 2 })
    const first = await signUp()
    const second = await signUp(OTHER_MOBILE, 'Ravi Kumar')
    const third = await signUp('9800000001', 'Meena Iyer')

    await book(first).expect(201)
    await book(second).expect(201)
    const taken = await ctx.prisma.appointment.findMany({ select: { practitionerId: true } })
    expect(new Set(taken.map((row) => row.practitionerId))).toEqual(new Set(practitionerIds))

    expect((await book(third).expect(409)).body.error.code).toBe('SLOT_TAKEN')
    expect(await ctx.prisma.patient.count()).toBe(2)
  })

  it('never double-books one therapist when two patients take the last slot together', async () => {
    const { book } = await clinic()
    const first = await signUp()
    const second = await signUp(OTHER_MOBILE, 'Ravi Kumar')
    const results = await Promise.all([book(first), book(second)])
    expect(results.map((res) => res.status).sort()).toEqual([201, 409])
    expect(await ctx.prisma.appointment.count()).toBe(1)
    expect(await ctx.prisma.patient.count()).toBe(1)
  })

  it('refuses times outside consulting hours, past dates and services not opened to patients', async () => {
    const { book, serviceId } = await clinic()
    const token = await signUp()
    expect((await book(token, '14:00').expect(422)).body.error.code).toBe('SLOT_NOT_AVAILABLE')
    expect((await book(token, '09:00', '2020-01-01').expect(422)).body.error.code).toBe('SLOT_NOT_AVAILABLE')
    await ctx.prisma.billingService.update({ where: { id: serviceId }, data: { patientBookable: false } })
    expect((await book(token).expect(422)).body.error.code).toBe('SERVICE_NOT_BOOKABLE')
  })

  it('does not book a therapist who is on leave', async () => {
    const { book, branchId, serviceId, practitionerIds, membershipId, orgId } = await clinic()
    expect(practitionerIds).toHaveLength(1)
    const owner = await ctx.prisma.membership.findUniqueOrThrow({ where: { id: membershipId } })
    const staffMember = await ctx.prisma.staffMember.create({
      data: { orgId, membershipId, staffCode: 'STF-001', type: 'doctor', fullName: 'Dr. Mehta 1', designation: 'Doctor', department: 'General Medicine', createdById: owner.userId },
    })
    await ctx.prisma.staffLeave.create({ data: { staffId: staffMember.id, kind: 'leave', title: 'Leave', startDate: new Date(`${DAY}T00:00:00Z`), endDate: new Date(`${DAY}T00:00:00Z`), reason: 'Away', createdById: owner.userId } })
    const token = await signUp()
    expect(await slotsFor(token, branchId, serviceId)).toEqual([])
    expect((await book(token).expect(422)).body.error.code).toBe('SLOT_NOT_AVAILABLE')
  })
})

describe('changing a booking', () => {
  it('moves and cancels it, with history, and the clinic hears each time', async () => {
    const { book, staff, branchId, serviceId } = await clinic()
    const token = await signUp()
    const { id } = (await book(token).expect(201)).body.data

    // Its own slot does not count against it when choosing a new one.
    const free = (await phone(token).get(`/v1/patient/appointments/${id}/slots?from=${DAY}&days=1`).expect(200)).body.data.days[0].slots
    expect(free.every((slot: { available: boolean }) => slot.available)).toBe(true)

    const moved = (await phone(token).post(`/v1/patient/appointments/${id}/reschedule`).send({ date: DAY, time: '09:30' }).expect(200)).body.data
    expect(moved).toMatchObject({ time: '09:30', status: 'confirmed' })
    expect(moved.events.at(-1)).toMatchObject({ action: 'reschedule', by: 'you', from: { date: DAY, time: '09:00' }, to: { date: DAY, time: '09:30' } })

    const cancelled = (await phone(token).post(`/v1/patient/appointments/${id}/cancel`).send({ reason: 'Schedule conflict' }).expect(200)).body.data
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: 'Schedule conflict', canCancel: false, canReschedule: false })
    expect((await phone(token).post(`/v1/patient/appointments/${id}/cancel`).send({ reason: 'Again' }).expect(409)).body.error.code).toBe('CHANGE_NOT_ALLOWED')

    const record = (await staff.get(`/v1/appointments/${id}`).expect(200)).body.data
    expect(record.status).toBe('cancelled')
    expect(record.events.map((event: { actor: string }) => event.actor)).toEqual(['Patient app', 'Patient app', 'Patient app'])
    const titles = (await staff.get('/v1/notifications').expect(200)).body.data.map((item: { title: string }) => item.title)
    expect(titles).toEqual(['Patient cancelled a booking', 'Patient moved a booking', 'New booking from the patient app'])

    expect((await slotsFor(token, branchId, serviceId)).every((slot: { available: boolean }) => slot.available)).toBe(true)
    expect((await phone(token).get('/v1/patient/appointments?scope=upcoming').expect(200)).body.data).toEqual([])
    expect((await phone(token).get('/v1/patient/appointments?scope=past').expect(200)).body.data).toHaveLength(1)
  })

  it('tells the patient when the clinic changes it, without showing desk notes', async () => {
    const { book, staff } = await clinic()
    const token = await signUp()
    const { id } = (await book(token).expect(201)).body.data

    const events = await liveDuring(() => staff.post(`/v1/appointments/${id}/cancel`).send({ reason: 'Doctor unavailable', note: 'Internal: roster changed this morning.' }).expect(200))
    expect(events.some((event) => event.topic === 'appointments' && event.entityId === id)).toBe(true)

    const detail = await phone(token).get(`/v1/patient/appointments/${id}`).expect(200)
    expect(detail.body.data).toMatchObject({ status: 'cancelled' })
    expect(detail.body.data.events.at(-1)).toMatchObject({ action: 'cancel', by: 'clinic' })
    expect(JSON.stringify(detail.body)).not.toContain('roster changed')

    const notices = (await phone(token).get('/v1/patient/notifications').expect(200)).body.data
    expect(notices[0].title).toBe('Appointment cancelled')
    expect(JSON.stringify(notices)).not.toContain('roster changed')
  })

  it('keeps one patient away from another’s appointments and notifications', async () => {
    const { book } = await clinic()
    const mine = await signUp()
    const theirs = await signUp(OTHER_MOBILE, 'Ravi Kumar')
    const { id } = (await book(mine).expect(201)).body.data

    await phone(theirs).get(`/v1/patient/appointments/${id}`).expect(404)
    await phone(theirs).get(`/v1/patient/appointments/${id}/slots?from=${DAY}`).expect(404)
    await phone(theirs).post(`/v1/patient/appointments/${id}/reschedule`).send({ date: DAY, time: '09:30' }).expect(404)
    await phone(theirs).post(`/v1/patient/appointments/${id}/cancel`).send({ reason: 'No' }).expect(404)
    expect((await phone(theirs).get('/v1/patient/appointments').expect(200)).body.data).toEqual([])

    const [notice] = (await phone(mine).get('/v1/patient/notifications').expect(200)).body.data
    expect((await phone(theirs).post('/v1/patient/notifications/read').send({ ids: [notice.id] }).expect(200)).body.data).toEqual({ marked: 0 })
    expect((await phone(theirs).get('/v1/patient/notifications').expect(200)).body.data).toEqual([])
  })

  it('hides appointments and their notices once the clinic removes access', async () => {
    const { book, staff, orgId } = await clinic()
    const token = await signUp()
    const { id } = (await book(token).expect(201)).body.data
    const link = await ctx.prisma.patientLink.findFirstOrThrow({ where: { orgId } })
    await staff.get(`/v1/patients/${link.patientId}/app-access`).expect(200)
    await ctx.prisma.patientLink.update({ where: { id: link.id }, data: { revokedAt: new Date() } })

    await phone(token).get(`/v1/patient/appointments/${id}`).expect(404)
    expect((await phone(token).get('/v1/patient/notifications').expect(200)).body.data).toEqual([])
    expect((await book(token, '09:30').expect(409)).body.error.code).toBe('CLINIC_CODE_REQUIRED')
  })
})

describe('live updates over HTTP', () => {
  it('streams a patient booking to the signed-in staff browser and to that patient only', async () => {
    const { book, orgId, browser } = await clinic({ therapists: 2 })
    const mine = await signUp()
    const theirs = await signUp(OTHER_MOBILE, 'Ravi Kumar')
    // A first booking creates the link that the patient stream filters on.
    await book(mine, '09:00').expect(201)
    const login = await browser.post('/v1/auth/login').send({ email: 'owner@aura.test', password: 'Clinic2026' }).expect(200)
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((entry) => entry.split(';')[0]).join('; ')

    const staffStream = await openStream(`/v1/events/stream?orgId=${orgId}`, { Cookie: cookie })
    const patientStream = await openStream('/v1/patient/events/stream', { Authorization: `Bearer ${mine}` })
    const otherStream = await openStream('/v1/patient/events/stream', { Authorization: `Bearer ${theirs}` })
    try {
      expect(staffStream.status).toBe(200)
      expect(patientStream.contentType).toContain('text/event-stream')
      await Promise.all([staffStream.waitFor('ready'), patientStream.waitFor('ready'), otherStream.waitFor('ready')])

      const { id } = (await book(mine, '09:30', addDays(DAY, 1)).expect(201)).body.data
      await Promise.all([staffStream.waitFor('appointments'), staffStream.waitFor('notifications'), patientStream.waitFor('appointments'), patientStream.waitFor('notifications')])
      expect(staffStream.text()).toContain(id)
      expect(staffStream.text()).not.toContain('Asha')
      expect(otherStream.text()).not.toContain(id)
    } finally {
      for (const stream of [staffStream, patientStream, otherStream]) stream.close()
    }
  })
})
