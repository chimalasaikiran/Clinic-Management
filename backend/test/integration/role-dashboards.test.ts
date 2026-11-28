import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localDate } from '../../src/modules/scheduling/clinic-time'
import { Browser, createOwner, PASSWORD, resetState, startApp, stopApp, TestContext } from './helpers'

let ctx: TestContext

afterAll(async () => {
  await stopApp(ctx)
})

const today = () => localDate(new Date(), 'Asia/Kolkata')
const PATIENT = { title: 'Ms.', fullName: 'Ananya Sharma', mobile: '+91 98452 11029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', city: 'Hyderabad', state: 'Telangana' }
const VITALS = { systolic: 122, diastolic: 80, pulse: 76, respiration: 16, temperatureF: 98.6, spo2: 98, weightKg: 62, heightCm: 165 }

const ROLES = {
  clinician: 'Clinician',
  nurse: 'Nurse',
  desk: 'Front Desk & Reception',
  manager: 'Branch Manager',
  pharmacist: 'Pharmacist',
  accountant: 'Accountant / Billing',
  hr: 'HR & Compliance Officer',
  growth: 'Growth & Marketing',
} as const
type RoleKey = keyof typeof ROLES

// A clinic with one member per default role, the clinician set up as a therapist with a walk-in patient waiting,
// and a second therapist (the owner) with another patient the clinician must not see.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const roles = (await owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  const ownerMember = (await owner.get('/v1/practitioners/candidates').expect(200)).body.data[0].membershipId as string

  const members = {} as Record<RoleKey, ReturnType<typeof as>>
  for (const key of Object.keys(ROLES) as RoleKey[]) {
    const email = `${key}@aura.test`
    await owner.post('/v1/invitations').send({ email, roleIds: [roles.find((role) => role.name === ROLES[key])!.id] }).expect(201)
    const joined = ctx.browser()
    await joined.post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: `${key} member`, password: PASSWORD }).expect(201)
    await joined.post('/v1/auth/login').send({ email, password: PASSWORD }).expect(200)
    members[key] = as(joined)
  }

  const candidates = (await owner.get('/v1/practitioners/candidates').expect(200)).body.data as Array<{ membershipId: string; fullName: string }>
  const therapist = async (membershipId: string, displayName: string) => {
    const created = (await owner.post('/v1/practitioners').send({ membershipId, displayName, specialty: 'Physiotherapy', department: 'Rehabilitation', slotMinutes: 30 }).expect(201)).body.data
    const windows = Array.from({ length: 7 }, (_, weekday) => ({ branchId, weekday, start: '00:00', end: '23:30' }))
    await owner.put(`/v1/practitioners/${created.id}/availability`).send({ windows }).expect(200)
    return created.id as string
  }
  const doctorId = await therapist(candidates.find((entry) => entry.fullName === 'clinician member')!.membershipId, 'Dr. Aditi Rao')
  const otherId = await therapist(ownerMember, 'Dr. Other')

  const walkIn = async (practitionerId: string, fullName: string, mobile: string) => {
    const patient = (await owner.post('/v1/patients').send({ ...PATIENT, fullName, mobile, homeBranchId: branchId }).expect(201)).body.data
    const appointment = (await owner.post('/v1/appointments').send({ patientId: patient.id, practitionerId, branchId, date: today(), channel: 'walk_in', waitingQueue: true, arrivedNow: true, reason: 'Neck pain' }).expect(201)).body.data
    return { patient, appointment }
  }
  const mine = await walkIn(doctorId, 'Ananya Sharma', '+91 98452 11029')
  const theirs = await walkIn(otherId, 'Ravi Kumar', '+91 98452 11030')
  return { owner, members, branchId, mine, theirs }
}

const names = (body: { data: { appointments: Array<{ patient: { fullName: string } }> } }) => body.data.appointments.map((row) => row.patient.fullName).sort()

describe('role dashboards', () => {
  // Eight accounts take minutes to set up against a distant database, so the tests share one clinic, in order.
  let c: Awaited<ReturnType<typeof clinic>>
  beforeAll(async () => {
    ctx = await startApp()
    await resetState(ctx)
    c = await clinic()
  }, 900_000)

  it('gives each role only the day data its permissions allow', async () => {

    // A clinician sees their own patients only, with clinical detail.
    const doctor = (await c.members.clinician.get('/v1/dashboard/day').expect(200)).body
    expect(names({ data: doctor.data })).toEqual(['Ananya Sharma'])
    expect(doctor.data.me.practitionerId).not.toBeNull()
    expect(doctor.data.clinical).not.toBeNull()

    // A nurse prepares whoever has arrived.
    const nurse = (await c.members.nurse.get('/v1/dashboard/day').expect(200)).body
    expect(names(nurse)).toEqual(['Ananya Sharma', 'Ravi Kumar'])
    expect(nurse.data.appointments[0].vitals).toBeNull()

    // The front desk sees the whole list without any clinical field.
    const desk = (await c.members.desk.get('/v1/dashboard/day').expect(200)).body
    expect(names(desk)).toEqual(['Ananya Sharma', 'Ravi Kumar'])
    expect(desk.data.clinical).toBeNull()
    for (const row of desk.data.appointments) {
      expect(row).not.toHaveProperty('vitals')
      expect(row).not.toHaveProperty('allergies')
      expect(row).not.toHaveProperty('encounter')
    }
    expect(desk.data.events.length).toBeGreaterThan(0)

    await c.members.manager.get('/v1/dashboard/day').expect(200)
    for (const key of ['pharmacist', 'accountant', 'hr', 'growth'] as const) await c.members[key].get('/v1/dashboard/day').expect(403)
  })

  it('opens the overview to dashboard roles, hiding sections they may not read', async () => {
    const pharmacist = (await c.members.pharmacist.get('/v1/dashboard').expect(200)).body.data
    expect(pharmacist).toMatchObject({ appointments: null, collections: null, team: null })
    const accountant = (await c.members.accountant.get('/v1/dashboard').expect(200)).body.data
    expect(accountant.appointments).toBeNull()
    expect(accountant.collections).not.toBeNull()
    const hr = (await c.members.hr.get('/v1/dashboard').expect(200)).body.data
    expect(hr.collections).toBeNull()
    expect(hr.team).not.toBeNull()

    await c.members.growth.get('/v1/dashboard').expect(403)
    await c.members.growth.get('/v1/leads').expect(200)
    await c.members.growth.get('/v1/patients').expect(403)
  })

  it('lets nurses record vitals and nothing else clinical', async () => {
    const { patient, appointment } = c.mine

    await c.members.desk.post(`/v1/patients/${patient.id}/vitals`).send(VITALS).expect(403)
    await c.members.nurse.post(`/v1/patients/${patient.id}/vitals`).send(VITALS).expect(201)
    const day = (await c.members.nurse.get('/v1/dashboard/day').expect(200)).body.data
    expect(day.appointments.find((row: { id: string }) => row.id === appointment.id).vitals).toMatchObject({ systolic: 122, spo2: 98 })

    await c.members.nurse.post(`/v1/appointments/${appointment.id}/start`).expect(403)
    await c.members.nurse.post(`/v1/appointments/${appointment.id}/check-in`).send({}).expect(403)
    await c.members.nurse.post('/v1/encounters').send({ appointmentId: appointment.id }).expect(403)
    await c.members.nurse.post(`/v1/patients/${patient.id}/prescriptions`).send({}).expect(403)
    await c.members.nurse.post(`/v1/patients/${patient.id}/allergies`).send({}).expect(403)
  })

  it('follows the encounter from the doctor starting it to the unsigned-notes list', async () => {
    await c.members.clinician.post('/v1/encounters').send({ appointmentId: c.theirs.appointment.id }).expect(404)
    await c.members.clinician.post('/v1/encounters').send({ appointmentId: c.mine.appointment.id }).expect(201)
    const day = (await c.members.clinician.get('/v1/dashboard/day').expect(200)).body.data
    expect(day.appointments[0]).toMatchObject({ status: 'in_progress', encounter: { status: 'in_progress' } })
    expect(day.clinical.unsigned.total).toBe(1)
  })

  it('refuses a branch outside the organisation', async () => {
    await c.members.desk.get('/v1/dashboard/day?branchId=0190f000-0000-7000-8000-000000000000').expect(404)
    await c.members.desk.get(`/v1/dashboard/day?branchId=${c.branchId}`).expect(200)
  })
})
