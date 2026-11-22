import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays, localDate } from '../../src/modules/scheduling/clinic-time'
import { Browser, createOwner, resetState, startApp, stopApp, TestContext } from './helpers'

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

// Each test makes dozens of requests against the remote test database.
const SLOW = 300_000
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')
const today = () => localDate(new Date(), 'Asia/Kolkata')

async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
    delete: (url: string) => b.delete(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const mainId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  return { owner, orgId, mainId, browser }
}

const branchBody = (extra: Record<string, unknown> = {}) => ({
  name: 'Kondapur Clinic', code: 'kdp-01', addressLine1: 'Hitec City Main Road', city: 'Hyderabad', state: 'Telangana', pinCode: '500084', phone: '040 2311 4455', email: 'kondapur@aura.example', facilityType: 'Outpatient Practice', ...extra,
})

describe('onboarding', () => {
  it('saves the contact, operating model and specialties, creating departments, then completes setup', async () => {
    const c = await clinic()
    expect((await c.owner.put('/v1/organisation/contact').send({ phone: '12345' }).expect(400)).body.error.code).toBe('VALIDATION_FAILED')
    await c.owner.put('/v1/organisation/contact').send({ phone: '+91 98480 11223', email: 'Front.Desk@Aura.Example' }).expect(200)
    await c.owner.put('/v1/organisation/operations').send({ classification: 'multi-specialty', structure: 'network' }).expect(200)
    const saved = (await c.owner.put('/v1/organisation/specialties').send({ specialties: ['Orthopedics', 'Cardiology', 'Orthopedics'], departments: ['Orthopaedics', 'Cardiology', 'orthopaedics'] }).expect(200)).body.data
    expect(saved).toMatchObject({ phone: '9848011223', email: 'front.desk@aura.example', classification: 'multi-specialty', structure: 'network', specialties: ['Orthopedics', 'Cardiology'], counts: { branches: 1, departments: 2 } })

    const departments = (await c.owner.get('/v1/departments').expect(200)).body.data
    expect(departments.map((entry: { name: string; branches: unknown[] }) => [entry.name, entry.branches.length])).toEqual([['Cardiology', 1], ['Orthopaedics', 1]])
    await c.owner.post('/v1/organisation/complete').expect(200)

    await c.owner.put('/v1/organisation/logo').set('Content-Type', 'image/png').send(Buffer.from('not an image')).expect(422)
    const withLogo = (await c.owner.put('/v1/organisation/logo').set('Content-Type', 'image/png').set('X-File-Name', 'aura.png').send(PNG).expect(200)).body.data
    expect(withLogo.logoId).toBeTruthy()
    const logo = await c.browser.get(`/v1/organisation/logo?orgId=${c.orgId}`).expect(200)
    expect(logo.headers['content-type']).toBe('image/png')
  }, SLOW)
})

describe('branches', () => {
  it('adds a branch, gives it to branch-limited roles, and keeps the primary branch active', async () => {
    const c = await clinic()
    const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string; scope: string }>
    const frontDesk = roles.find((role) => role.scope === 'branch')!
    expect((await c.owner.post('/v1/configuration/branches').send(branchBody({ pinCode: '0500' })).expect(400)).body.error.code).toBe('VALIDATION_FAILED')
    const branch = (await c.owner.post('/v1/configuration/branches').send(branchBody({ roleIds: [frontDesk.id] })).expect(201)).body.data
    expect(branch).toMatchObject({ code: 'KDP-01', status: 'active', isPrimary: false, phone: '04023114455', pinCode: '500084' })
    expect((await c.owner.post('/v1/configuration/branches').send(branchBody({ name: 'Second' })).expect(409)).body.error.code).toBe('BRANCH_CODE_TAKEN')
    const role = (await c.owner.get('/v1/roles').expect(200)).body.data.find((entry: { id: string }) => entry.id === frontDesk.id)
    expect(role.branchIds).toContain(branch.id)

    const list = (await c.owner.get('/v1/configuration/branches').expect(200)).body.data
    expect(list.map((entry: { code: string; isPrimary: boolean }) => [entry.code, entry.isPrimary])).toEqual([['MAIN', true], ['KDP-01', false]])
    const main = list[0]
    expect((await c.owner.patch(`/v1/configuration/branches/${main.id}`).send({ ...branchBody({ name: main.name }), status: 'paused', version: main.version }).expect(422)).body.error.code).toBe('PRIMARY_BRANCH')
    const paused = (await c.owner.patch(`/v1/configuration/branches/${branch.id}`).send({ ...branchBody(), status: 'paused', version: branch.version }).expect(200)).body.data
    expect(paused.status).toBe('paused')
    await c.owner.patch(`/v1/configuration/branches/${branch.id}`).send({ ...branchBody(), status: 'active', version: branch.version }).expect(409)
  }, SLOW)

  it('blocks booking on a closed day, keeps special hours bookable, and warns about sessions outside the hours', async () => {
    const c = await clinic()
    const members = (await c.owner.get('/v1/practitioners/candidates').expect(200)).body.data
    const doctor = (await c.owner.post('/v1/practitioners').send({ membershipId: members[0].membershipId, displayName: 'Dr. Rahul Mehta', specialty: 'Orthopaedics', department: 'Orthopaedics', slotMinutes: 30 }).expect(201)).body.data
    const everyDay = Array.from({ length: 7 }, (_, weekday) => ({ branchId: c.mainId, weekday, start: '09:00', end: '20:00' }))
    await c.owner.put(`/v1/practitioners/${doctor.id}/availability`).send({ windows: everyDay }).expect(200)

    // The branch opens 09:00–13:00 and 17:00–20:00 every day: the doctor's 09:00–20:00 session is reported.
    const sessions = Array.from({ length: 7 }, (_, weekday) => [{ weekday, start: '09:00', end: '13:00', label: 'Morning OPD' }, { weekday, start: '17:00', end: '20:00', label: 'Evening OPD' }]).flat()
    await c.owner.put(`/v1/configuration/branches/${c.mainId}/hours`).send({ sessions: [{ weekday: 1, start: '09:00', end: '13:00' }, { weekday: 1, start: '12:00', end: '14:00' }] }).expect(422)
    const hours = (await c.owner.put(`/v1/configuration/branches/${c.mainId}/hours`).send({ sessions }).expect(200)).body.data
    expect(hours.hours).toHaveLength(14)
    const warned = (await c.owner.get(`/v1/practitioners/${doctor.id}`).expect(200)).body.data
    expect(warned.hoursWarnings).toHaveLength(7)
    expect(warned.hoursWarnings[0]).toContain('is outside the branch’s hours (09:00–13:00, 17:00–20:00)')

    const closed = addDays(today(), 2)
    const special = addDays(today(), 3)
    await c.owner.post(`/v1/configuration/branches/${c.mainId}/closures`).send({ date: addDays(today(), -1), kind: 'closed', reason: 'Past' }).expect(422)
    await c.owner.post(`/v1/configuration/branches/${c.mainId}/closures`).send({ date: special, kind: 'special', opensAt: '14:00', closesAt: '10:00', reason: 'Festival' }).expect(400)
    await c.owner.post(`/v1/configuration/branches/${c.mainId}/closures`).send({ date: closed, kind: 'closed', reason: 'Diwali' }).expect(201)
    const added = (await c.owner.post(`/v1/configuration/branches/${c.mainId}/closures`).send({ date: special, kind: 'special', opensAt: '10:00', closesAt: '14:00', reason: 'Festival eve' }).expect(201)).body.data
    expect(added.closures.map((entry: { date: string; kind: string }) => [entry.date, entry.kind])).toEqual([[closed, 'closed'], [special, 'special']])
    await c.owner.post(`/v1/configuration/branches/${c.mainId}/closures`).send({ date: closed, kind: 'closed', reason: 'Again' }).expect(409)

    const slots = (await c.owner.get(`/v1/practitioners/${doctor.id}/slots?branchId=${c.mainId}&from=${closed}&days=2`).expect(200)).body.data.days
    expect(slots[0]).toEqual({ date: closed, slots: [], closed: 'Diwali' })
    expect(slots[1].slots.length).toBeGreaterThan(0)

    const patient = (await c.owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: c.mainId }).expect(201)).body.data
    const booking = (date: string) => ({ patientId: patient.id, practitionerId: doctor.id, branchId: c.mainId, date, time: '10:00', reason: 'Knee pain review' })
    expect((await c.owner.post('/v1/appointments').send(booking(closed)).expect(422)).body.error.code).toBe('BRANCH_CLOSED')
    const appointment = (await c.owner.post('/v1/appointments').send(booking(special)).expect(201)).body.data
    expect((await c.owner.post(`/v1/appointments/${appointment.id}/reschedule`).send({ date: closed, time: '10:00', reason: 'Patient request', note: 'Patient asked to move the visit' }).expect(422)).body.error.code).toBe('BRANCH_CLOSED')

    const closure = added.closures.find((entry: { date: string }) => entry.date === closed)
    await c.owner.delete(`/v1/configuration/branches/${c.mainId}/closures/${closure.id}`).expect(200)
    await c.owner.post('/v1/appointments').send({ ...booking(closed), time: '11:00' }).expect(201)
  }, SLOW)
})

describe('departments', () => {
  it('is the master list for staff, doctors and services, and a rename carries them along', async () => {
    const c = await clinic()
    const created = (await c.owner.post('/v1/departments').send({ code: 'ortho', name: 'Orthopaedics', type: 'Clinical', branchIds: [c.mainId] }).expect(201)).body.data
    expect(created).toMatchObject({ code: 'ORTHO', name: 'Orthopaedics', status: 'active', branches: [{ id: c.mainId }] })
    expect((await c.owner.post('/v1/departments').send({ code: 'ORT2', name: 'orthopaedics', type: 'Clinical', branchIds: [c.mainId] }).expect(409)).body.error.code).toBe('DEPARTMENT_EXISTS')

    const person = { type: 'staff', fullName: 'Priya Nair', designation: 'Front Office Executive' }
    expect((await c.owner.post('/v1/staff').send({ ...person, department: 'Dermatology' }).expect(422)).body.error.code).toBe('DEPARTMENT_UNKNOWN')
    const staff = (await c.owner.post('/v1/staff').send({ ...person, department: 'orthopaedics' }).expect(201)).body.data
    expect(staff.department).toBe('Orthopaedics')

    const renamed = (await c.owner.patch(`/v1/departments/${created.id}`).send({ name: 'Orthopaedics & Sports Medicine', type: 'Clinical', branchIds: [c.mainId], status: 'active', version: 1 }).expect(200)).body.data
    expect(renamed).toMatchObject({ name: 'Orthopaedics & Sports Medicine', counts: { staff: 1 }, staff: [expect.objectContaining({ fullName: 'Priya Nair' })] })
    expect((await c.owner.get(`/v1/staff/${staff.id}`).expect(200)).body.data.department).toBe('Orthopaedics & Sports Medicine')

    await c.owner.patch(`/v1/departments/${created.id}`).send({ name: 'Orthopaedics & Sports Medicine', type: 'Clinical', branchIds: [c.mainId], status: 'inactive', version: 2 }).expect(200)
    expect((await c.owner.post('/v1/staff').send({ ...person, fullName: 'Arjun Desai', department: 'Orthopaedics & Sports Medicine' }).expect(422)).body.error.code).toBe('DEPARTMENT_UNKNOWN')
  }, SLOW)

  it('moves people into a department, but not into an inactive one', async () => {
    const c = await clinic()
    const ortho = (await c.owner.post('/v1/departments').send({ code: 'ORTHO', name: 'Orthopaedics', type: 'Clinical', branchIds: [c.mainId] }).expect(201)).body.data
    const physio = (await c.owner.post('/v1/departments').send({ code: 'PHYSIO', name: 'Physiotherapy', type: 'Therapy', branchIds: [c.mainId] }).expect(201)).body.data
    const staff = (await c.owner.post('/v1/staff').send({ type: 'staff', fullName: 'Priya Nair', designation: 'Physiotherapist', department: 'Orthopaedics' }).expect(201)).body.data

    expect((await c.owner.post(`/v1/departments/${physio.id}/members`).send({ staffIds: [] }).expect(400)).body.error.code).toBe('VALIDATION_FAILED')
    const moved = (await c.owner.post(`/v1/departments/${physio.id}/members`).send({ staffIds: [staff.id] }).expect(200)).body.data
    expect(moved).toMatchObject({ counts: { staff: 1 }, staff: [expect.objectContaining({ id: staff.id })] })
    expect((await c.owner.get(`/v1/staff/${staff.id}`).expect(200)).body.data.department).toBe('Physiotherapy')

    await c.owner.patch(`/v1/departments/${ortho.id}`).send({ name: 'Orthopaedics', type: 'Clinical', branchIds: [c.mainId], status: 'inactive', version: 1 }).expect(200)
    expect((await c.owner.post(`/v1/departments/${ortho.id}/members`).send({ staffIds: [staff.id] }).expect(422)).body.error.code).toBe('DEPARTMENT_INACTIVE')
  }, SLOW)
})

describe('service catalogue', () => {
  it('lists the billing services with their branch prices for configuration', async () => {
    const c = await clinic()
    const body = { code: 'srv-ortho-01', name: 'Orthopaedic Consultation', category: 'Consultation', department: null, description: '', unit: '30 min', status: 'inactive', price: 800, taxTreatment: 'exempt', taxConfig: 'Healthcare services — Exempt', prices: [{ branchId: c.mainId, price: 750 }] }
    await c.owner.post('/v1/billing/services').send(body).expect(201)
    const services = (await c.owner.get('/v1/billing/services').expect(200)).body.data
    expect(services).toEqual([expect.objectContaining({ code: 'SRV-ORTHO-01', price: 800, unit: '30 min', prices: [{ branchId: c.mainId, price: 750 }], events: expect.any(Array) })])
  }, SLOW)
})

describe('insurance', () => {
  it('records partners and a draft agreement with its PDF, activates it, and locks it once active', async () => {
    const c = await clinic()
    expect((await c.owner.put('/v1/insurance/acceptance').send({ accepts: false }).expect(200)).body.data.acceptsInsurance).toBe(false)
    await c.owner.post('/v1/insurance/partners').send({ name: 'Star Health and Allied Insurance', type: 'insurer', listed: true }).expect(201)
    const overview = (await c.owner.post('/v1/insurance/partners').send({ name: 'Medi Assist Insurance TPA', type: 'tpa', listed: true }).expect(201)).body.data
    // Adding the same partner again does not create a second one.
    expect((await c.owner.post('/v1/insurance/partners').send({ name: 'star health and allied insurance', type: 'insurer' }).expect(201)).body.data.partners).toHaveLength(2)
    const insurer = overview.partners.find((entry: { type: string }) => entry.type === 'insurer')
    const tpa = overview.partners.find((entry: { type: string }) => entry.type === 'tpa')

    await c.owner.post('/v1/insurance/documents').set('Content-Type', 'application/pdf').send(Buffer.from('not a pdf')).expect(422)
    const document = (await c.owner.post('/v1/insurance/documents').set('Content-Type', 'application/pdf').set('X-File-Name', 'star-agreement.pdf').send(PDF).expect(201)).body.data
    expect(document).toMatchObject({ fileName: 'star-agreement.pdf', size: PDF.length })
    const pdf = await c.browser.get(`/v1/insurance/documents/${document.id}?orgId=${c.orgId}`).expect(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')

    const body = { insurerId: insurer.id, tpaId: tpa.id, reference: 'AGR-HYD-2026-01', startDate: today(), endDate: addDays(today(), 365), documentId: document.id, branchIds: [c.mainId], methods: ['cashless'], coverage: ['opd', 'diagnostics'] }
    await c.owner.post('/v1/insurance/agreements').send({ ...body, tpaId: insurer.id }).expect(422)
    await c.owner.post('/v1/insurance/agreements').send({ ...body, endDate: addDays(today(), -1) }).expect(400)
    const draft = (await c.owner.post('/v1/insurance/agreements').send(body).expect(201)).body.data
    expect(draft).toMatchObject({ code: 'AGR-0001', status: 'draft', insurer: { name: 'Star Health and Allied Insurance' }, tpa: { name: 'Medi Assist Insurance TPA' }, branches: [{ id: c.mainId }], coverage: ['opd', 'diagnostics'] })
    expect((await c.owner.post('/v1/insurance/agreements').send(body).expect(409)).body.error.code).toBe('REFERENCE_TAKEN')

    const edited = (await c.owner.patch(`/v1/insurance/agreements/${draft.id}`).send({ ...body, methods: ['cashless', 'reimbursement'], version: 1 }).expect(200)).body.data
    const active = (await c.owner.post(`/v1/insurance/agreements/${draft.id}/activate`).send({ confirm: true, version: edited.version }).expect(200)).body.data
    expect(active).toMatchObject({ status: 'active', activatedBy: 'Siddharth Verma' })
    expect((await c.owner.get('/v1/insurance').expect(200)).body.data.acceptsInsurance).toBe(true)
    expect((await c.owner.patch(`/v1/insurance/agreements/${draft.id}`).send({ ...body, version: active.version }).expect(409)).body.error.code).toBe('AGREEMENT_LOCKED')
    expect((await c.owner.patch(`/v1/insurance/partners/${insurer.id}`).send({ active: false }).expect(409)).body.error.code).toBe('PARTNER_IN_USE')

    const ended = (await c.owner.post(`/v1/insurance/agreements/${draft.id}/end`).send({ confirm: true, version: active.version }).expect(200)).body.data
    expect(ended.status).toBe('ended')
    await c.owner.patch(`/v1/insurance/partners/${insurer.id}`).send({ active: false }).expect(200)
  }, SLOW)
})
