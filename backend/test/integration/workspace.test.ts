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
const PATIENT = { title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', city: 'Hyderabad', state: 'Telangana' }

// An organisation with a consulting doctor, a patient waiting as a walk-in, an invoice and a staff member whose
// attendance is not marked yet.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const member = (await owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId
  const doctor = (await owner.post('/v1/practitioners').send({ membershipId: member, displayName: 'Dr. Rahul Mehta', specialty: 'Physiotherapy', department: 'Rehabilitation', slotMinutes: 30 }).expect(201)).body.data
  await owner.put(`/v1/practitioners/${doctor.id}/availability`).send({ windows: Array.from({ length: 7 }, (_, weekday) => ({ branchId, weekday, start: '00:00', end: '23:30' })) }).expect(200)
  const patient = (await owner.post('/v1/patients').send({ ...PATIENT, homeBranchId: branchId }).expect(201)).body.data
  const appointment = (await owner.post('/v1/appointments').send({ patientId: patient.id, practitionerId: doctor.id, branchId, date: today(), channel: 'walk_in', waitingQueue: true, arrivedNow: true, reason: 'Acute neck pain' }).expect(201)).body.data

  const service = (await owner.post('/v1/billing/services').send({
    code: 'srv-gmed-01', name: 'General Physician Consultation', category: 'Consultation', status: 'active', price: 1000, taxTreatment: 'exempt', taxConfig: 'Healthcare services — Exempt', prices: [{ branchId, price: null }],
  }).expect(201)).body.data.id as string
  const invoice = (await owner.post('/v1/billing/invoices').send({ patientId: patient.id, payer: 'Patient Direct (Self)', model: 'Pay-as-you-go', invoiceDate: today(), dueDate: addDays(today(), 7), items: [{ serviceId: service, quantity: 1 }] }).expect(201)).body.data

  const staff = (await owner.post('/v1/staff').send({ department: 'Front Office', designation: 'Receptionist', type: 'staff', fullName: 'Kavya Menon' }).expect(201)).body.data
  await owner.put(`/v1/staff/${staff.id}/branches`).send({ branchIds: [branchId], primaryBranchId: branchId }).expect(200)

  return { owner, orgId, branchId, patient, appointment, invoice, as }
}

async function frontDesk(c: Awaited<ReturnType<typeof clinic>>) {
  const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.owner.post('/v1/invitations').send({ email: 'desk@aura.test', roleIds: [roles.find((role) => role.name === 'Front Desk & Reception')!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken('desk@aura.test'), fullName: 'Front Desk', password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, 'desk@aura.test')
  return c.as(browser)
}

describe('header alerts', () => {
  it('lists the open items each person can act on', async () => {
    const c = await clinic()
    const owner = (await c.owner.get('/v1/alerts').expect(200)).body.data
    expect(owner.items).toEqual([{ id: 'waiting', count: 1 }, { id: 'attendance', count: 1 }])
    expect((await c.owner.get(`/v1/alerts?branchId=${c.branchId}`).expect(200)).body.data).toMatchObject({ branchId: c.branchId, items: owner.items })
    await c.owner.get('/v1/alerts?branchId=01930000-0000-7000-8000-000000000001').expect(404)

    // Front desk cannot mark attendance, so only the waiting patient is theirs to act on.
    const desk = await frontDesk(c)
    expect((await desk.get('/v1/alerts').expect(200)).body.data.items).toEqual([{ id: 'waiting', count: 1 }])
  }, 300_000)
})

describe('header search', () => {
  it('finds patients, appointments and invoices the person may read', async () => {
    const c = await clinic()
    const byName = (await c.owner.get('/v1/search?q=ananya').expect(200)).body.data
    expect(byName.patients).toEqual([{ id: c.patient.id, mrn: c.patient.mrn, fullName: 'Ananya Sharma', mobile: '9845211029', status: 'active' }])
    expect(byName.appointments).toHaveLength(1)
    expect(byName.appointments[0]).toMatchObject({ id: c.appointment.id, reference: c.appointment.reference, patientId: c.patient.id, patient: 'Ananya Sharma', practitioner: 'Dr. Rahul Mehta' })
    expect(byName.invoices).toEqual([expect.objectContaining({ reference: c.invoice.reference, patient: 'Ananya Sharma', total: 1000, date: today() })])

    const byReference = (await c.owner.get(`/v1/search?q=${c.invoice.reference.toLowerCase()}`).expect(200)).body.data
    expect(byReference).toMatchObject({ patients: [], appointments: [] })
    expect(byReference.invoices.map((row: { reference: string }) => row.reference)).toEqual([c.invoice.reference])
    expect((await c.owner.get(`/v1/search?q=${c.appointment.reference}`).expect(200)).body.data.appointments.map((row: { id: string }) => row.id)).toEqual([c.appointment.id])

    expect((await c.owner.get('/v1/search?q=a').expect(400)).body.error.code).toBeDefined()

    // Front desk sees patients and appointments, but not billing.
    const desk = await frontDesk(c)
    const limited = (await desk.get('/v1/search?q=ananya').expect(200)).body.data
    expect(limited.patients).toHaveLength(1)
    expect(limited.appointments).toHaveLength(1)
    expect(limited.invoices).toBeNull()
  }, 300_000)
})
