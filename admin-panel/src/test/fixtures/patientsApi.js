import { ApiError } from '../../lib/api'
import { localToday } from '../../features/patients/format'
import { createClinicalApi, createIncidentsApi } from './clinicalChart'
import { PATIENTS } from './patients'

// An in-memory stand-in for the patients, practitioners and appointments endpoints, for page tests.
// It follows the backend's rules closely enough to exercise the screens (paging, duplicates, slot conflicts,
// status changes); the real rules are tested against the database in backend/test/integration.

export const API_BRANCHES = [
  { id: 'b-main', code: 'MAIN', name: 'Main Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
  { id: 'b-kondapur', code: 'KDP', name: 'Kondapur Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
]

export const apiPatient = (overrides = {}) => ({
  id: 'p-1',
  mrn: 'PT-000001',
  title: 'Ms.',
  fullName: 'Ananya Sharma',
  alias: null,
  aadhaarLast4: null,
  abhaNumber: null,
  mobile: '9845211029',
  altMobile: null,
  email: null,
  addressLine: null,
  area: null,
  city: 'Hyderabad',
  state: 'Telangana',
  pinCode: '500084',
  dateOfBirth: '1992-04-18',
  gender: 'female',
  bloodGroup: 'O+',
  language: 'English',
  emergencyName: null,
  emergencyRelation: null,
  emergencyPhone: null,
  notifyWhatsapp: true,
  notifySms: true,
  intakeUnit: null,
  status: 'active',
  statusNote: null,
  version: 1,
  createdAt: '2026-10-14T09:00:00.000Z',
  homeBranch: { id: 'b-main', name: 'Main Clinic' },
  lastVisit: null,
  ...overrides,
})

const everyDay = (branchId, start = '09:00', end = '13:00') => Array.from({ length: 7 }, (_, weekday) => ({ branchId, branchName: API_BRANCHES.find((b) => b.id === branchId).name, weekday, start, end }))

export const apiPractitioner = (overrides = {}) => ({
  id: 'dr-1',
  membershipId: 'm-1',
  userId: 'u-1',
  memberName: 'Rahul Mehta',
  displayName: 'Dr. Rahul Mehta',
  credentials: 'MD',
  specialty: 'Physiotherapy',
  department: 'Rehabilitation',
  room: 'Chamber 104',
  slotMinutes: 30,
  status: 'active',
  version: 1,
  availability: everyDay('b-main'),
  ...overrides,
})

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const addDays = (iso, count) => {
  const [y, m, d] = iso.split('-').map(Number)
  const moved = new Date(y, m - 1, d + count)
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`
}
const weekdayOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export const tomorrow = () => addDays(localToday(), 1)

const OPEN = ['pending', 'confirmed', 'arrived', 'in_progress']
const MOVES = {
  confirm: [['pending'], 'confirmed'],
  reschedule: [['pending', 'confirmed'], 'confirmed'],
  checkIn: [['pending', 'confirmed'], 'arrived'],
  start: [['arrived'], 'in_progress'],
  complete: [['arrived', 'in_progress'], 'completed'],
  cancel: [['pending', 'confirmed'], 'cancelled'],
  noShow: [['pending', 'confirmed'], 'no_show'],
}

export function apiAppointment(state, overrides = {}) {
  const patient = state.patients.find((entry) => entry.id === (overrides.patientId ?? state.patients[0].id))
  const practitioner = state.practitioners.find((entry) => entry.id === (overrides.practitionerId ?? state.practitioners[0].id))
  const time = overrides.time ?? '10:00'
  const { patientId: _p, practitionerId: _d, ...rest } = overrides
  return {
    id: `a-${state.appointments.length + 1}`,
    reference: `APT-${String(state.appointments.length + 1).padStart(6, '0')}`,
    status: 'confirmed',
    type: 'consultation',
    channel: 'reception',
    waitingQueue: false,
    date: tomorrow(),
    time,
    endTime: toTime(toMinutes(time) + practitioner.slotMinutes),
    durationMinutes: practitioner.slotMinutes,
    patient: { id: patient.id, mrn: patient.mrn, fullName: patient.fullName, mobile: patient.mobile, dateOfBirth: patient.dateOfBirth, gender: patient.gender, status: patient.status },
    practitioner: { id: practitioner.id, displayName: practitioner.displayName, credentials: practitioner.credentials, specialty: practitioner.specialty, department: practitioner.department, room: practitioner.room, slotMinutes: practitioner.slotMinutes },
    branch: { id: 'b-main', name: 'Main Clinic', city: 'Hyderabad' },
    reason: 'Lower back pain review',
    internalNote: null,
    notifyWhatsapp: true,
    notifySms: true,
    queueToken: null,
    arrivedAt: null,
    closedReason: null,
    bookedBy: 'Siddharth Verma',
    createdAt: '2026-11-15T09:00:00.000Z',
    version: 1,
    events: [],
    ...rest,
  }
}

const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found.`)
const clone = (value) => JSON.parse(JSON.stringify(value))

// `closures` maps `${branchId}:${date}` to the reason the branch is closed that day; `hoursWarnings` is what
// saving availability reports for sessions outside a branch's opening hours.
export function createPatientsApi({ patients = [apiPatient()], practitioners = [apiPractitioner()], appointments = [], candidates = [], closures = {}, hoursWarnings = [] } = {}) {
  const state = { patients: clone(patients), practitioners: clone(practitioners), appointments: [], candidates: clone(candidates), closures: clone(closures), hoursWarnings: clone(hoursWarnings), calls: [] }
  for (const overrides of appointments) state.appointments.push(apiAppointment(state, overrides))
  const record = (name, ...args) => state.calls.push([name, ...args])

  const findPatient = (id) => {
    const patient = state.patients.find((entry) => entry.id === id)
    if (!patient) throw notFound('Patient')
    return patient
  }
  const findAppointment = (id) => {
    const appointment = state.appointments.find((entry) => entry.id === id)
    if (!appointment) throw notFound('Appointment')
    return appointment
  }
  const event = (appointment, action, from, extra = {}) => appointment.events.unshift({ id: `e-${appointment.events.length + 1}`, action, fromStatus: from, toStatus: appointment.status, from: null, to: null, reason: null, note: null, actor: 'Siddharth Verma', at: new Date().toISOString(), date: localToday(), time: '10:00', ...extra })
  const move = (id, action, extra = {}) => {
    const appointment = findAppointment(id)
    const [from, to] = MOVES[action]
    if (!from.includes(appointment.status)) throw new ApiError(409, 'INVALID_STATUS_CHANGE', `This appointment is ${appointment.status}, so it cannot be changed this way.`)
    const before = appointment.status
    appointment.status = to
    appointment.version += 1
    event(appointment, action, before, extra)
    return clone(appointment)
  }
  const taken = (practitionerId, date, time, exceptId) => state.appointments.find((entry) => entry.practitioner.id === practitionerId && entry.date === date && entry.time === time && OPEN.includes(entry.status) && !entry.waitingQueue && entry.id !== exceptId)

  const patientsApi = {
    // No app account is connected unless a test says otherwise.
    appAccess: async () => ({ links: [], pendingCodeExpiresAt: null }),
    list: async (params = {}) => {
      record('patients.list', params)
      const needle = (params.query ?? '').toLowerCase()
      const digits = needle.replace(/\D/g, '')
      const rows = state.patients.filter((entry) =>
        (!needle || entry.fullName.toLowerCase().includes(needle) || entry.mrn.toLowerCase().includes(needle) || (digits.length >= 3 && entry.mobile.includes(digits))) &&
        (!params.status || entry.status === params.status) &&
        (!params.gender || entry.gender === params.gender) &&
        (!params.branchId || entry.homeBranch.id === params.branchId))
      const page = params.page ?? 1
      const pageSize = params.pageSize ?? 25
      return { data: clone(rows.slice((page - 1) * pageSize, page * pageSize)), meta: { page, pageSize, total: rows.length } }
    },
    get: async (id) => clone(findPatient(id)),
    duplicates: async (mobile, excludeId) => clone(state.patients.filter((entry) => entry.mobile === mobile && entry.id !== excludeId)),
    create: async (body) => {
      record('patients.create', body)
      const { confirmedNotDuplicate, homeBranchId, ...fields } = body
      if (!confirmedNotDuplicate && state.patients.some((entry) => entry.mobile === fields.mobile)) throw new ApiError(409, 'POSSIBLE_DUPLICATE', 'A patient with this mobile number is already registered.')
      const number = state.patients.length + 1
      const branch = API_BRANCHES.find((entry) => entry.id === homeBranchId)
      const patient = apiPatient({ ...fields, id: `p-${number}`, mrn: `PT-${String(number).padStart(6, '0')}`, homeBranch: { id: branch.id, name: branch.name }, createdAt: new Date().toISOString() })
      for (const key of Object.keys(patient)) if (patient[key] === '') patient[key] = null
      state.patients.push(patient)
      return clone(patient)
    },
    update: async (id, body) => {
      record('patients.update', id, body)
      const patient = findPatient(id)
      if (body.version !== patient.version) throw new ApiError(409, 'PATIENT_CHANGED', 'Someone else changed this patient while you were editing.')
      const { version, homeBranchId, ...fields } = body
      const branch = API_BRANCHES.find((entry) => entry.id === homeBranchId) ?? patient.homeBranch
      Object.assign(patient, fields, { homeBranch: { id: branch.id, name: branch.name }, version: version + 1 })
      return clone(patient)
    },
    setStatus: async (id, status, note) => {
      record('patients.setStatus', id, status, note)
      Object.assign(findPatient(id), { status, statusNote: note })
      return clone(findPatient(id))
    },
  }

  const appointmentsApi = {
    list: async (params = {}) => {
      record('appointments.list', params)
      const rows = state.appointments.filter((entry) =>
        (!params.patientId || entry.patient.id === params.patientId) &&
        (!params.date || entry.date === params.date) &&
        (!params.branchId || entry.branch.id === params.branchId) &&
        (!params.status || entry.status === params.status))
      return { data: clone(rows), meta: { page: 1, pageSize: params.pageSize ?? 25, total: rows.length } }
    },
    get: async (id) => clone(findAppointment(id)),
    create: async (body) => {
      record('appointments.create', body)
      if (!body.waitingQueue && taken(body.practitionerId, body.date, body.time)) throw new ApiError(409, 'SLOT_TAKEN', 'That slot has just been booked by someone else. Choose another time.')
      const status = body.arrivedNow || body.waitingQueue ? 'arrived' : body.status
      const appointment = apiAppointment(state, { patientId: body.patientId, practitionerId: body.practitionerId, date: body.date, time: body.time ?? '10:00', status, type: body.type, channel: body.channel, reason: body.reason, waitingQueue: Boolean(body.waitingQueue), queueToken: status === 'arrived' ? (body.waitingQueue ? 'W-01' : 'A-01') : null })
      state.appointments.push(appointment)
      event(appointment, body.channel === 'walk_in' ? 'walk_in' : 'booked', null)
      return clone(appointment)
    },
    confirm: async (id) => move(id, 'confirm'),
    checkIn: async (id, note) => {
      const appointment = move(id, 'checkIn', { note })
      Object.assign(findAppointment(id), { queueToken: 'A-01', arrivedAt: '10:05' })
      return { ...appointment, queueToken: 'A-01', arrivedAt: '10:05' }
    },
    start: async (id) => move(id, 'start'),
    complete: async (id) => move(id, 'complete'),
    cancel: async (id, reason, note) => {
      record('appointments.cancel', id, reason, note)
      const result = move(id, 'cancel', { reason, note })
      findAppointment(id).closedReason = reason
      return result
    },
    noShow: async (id, reason, note) => move(id, 'noShow', { reason, note }),
    reschedule: async (id, body) => {
      record('appointments.reschedule', id, body)
      const appointment = findAppointment(id)
      if (taken(appointment.practitioner.id, body.date, body.time, id)) throw new ApiError(409, 'SLOT_TAKEN', 'That slot has just been booked by someone else. Choose another time.')
      const from = { date: appointment.date, time: appointment.time }
      const result = move(id, 'reschedule', { reason: body.reason, note: body.note, from, to: { date: body.date, time: body.time } })
      Object.assign(appointment, { date: body.date, time: body.time })
      return { ...result, date: body.date, time: body.time }
    },
  }

  const practitionersApi = {
    list: async () => clone(state.practitioners),
    get: async (id) => {
      const practitioner = state.practitioners.find((entry) => entry.id === id)
      if (!practitioner) throw notFound('Therapist')
      return clone(practitioner)
    },
    candidates: async () => clone(state.candidates),
    create: async (body) => {
      record('practitioners.create', body)
      const practitioner = apiPractitioner({ ...body, id: `dr-${state.practitioners.length + 1}`, availability: [] })
      state.practitioners.push(practitioner)
      return clone(practitioner)
    },
    update: async (id, body) => {
      record('practitioners.update', id, body)
      const practitioner = state.practitioners.find((entry) => entry.id === id)
      Object.assign(practitioner, body)
      return clone(practitioner)
    },
    setAvailability: async (id, windows) => {
      record('practitioners.setAvailability', id, windows)
      const practitioner = state.practitioners.find((entry) => entry.id === id)
      practitioner.availability = windows.map((window) => ({ ...window, branchName: API_BRANCHES.find((b) => b.id === window.branchId)?.name }))
      return { ...clone(practitioner), hoursWarnings: clone(state.hoursWarnings) }
    },
    slots: async (id, { branchId, from, days = 7, excludeAppointmentId }) => {
      const practitioner = state.practitioners.find((entry) => entry.id === id)
      return {
        practitionerId: id,
        branchId,
        slotMinutes: practitioner.slotMinutes,
        days: Array.from({ length: days }, (_, index) => {
          const date = addDays(from, index)
          const closed = state.closures[`${branchId}:${date}`]
          if (closed) return { date, slots: [], closed }
          const slots = []
          for (const window of practitioner.availability.filter((entry) => entry.branchId === branchId && entry.weekday === weekdayOf(date))) {
            for (let minute = toMinutes(window.start); minute + practitioner.slotMinutes <= toMinutes(window.end); minute += practitioner.slotMinutes) {
              const time = toTime(minute)
              slots.push({ time, state: taken(id, date, time, excludeAppointmentId) ? 'booked' : 'available' })
            }
          }
          return { date, slots }
        }),
      }
    },
  }

  const branchesApi = { list: async () => clone(API_BRANCHES) }

  const clinicalApi = createClinicalApi(state)
  const incidentsApi = createIncidentsApi(state)

  return { api: { patientsApi, appointmentsApi, practitionersApi, branchesApi, clinicalApi, incidentsApi }, state }
}

// The in-memory sample patients (test/fixtures/patients) as API records with the same ids, for tests of
// screens that combine API patients with in-memory clinical or billing records.
export const fixturePatientsForApi = () =>
  PATIENTS.map((patient) =>
    apiPatient({
      id: patient.id,
      mrn: patient.mrn,
      fullName: patient.name,
      mobile: patient.mobile.replace(/\D/g, '').slice(-10),
      gender: patient.gender.toLowerCase(),
      bloodGroup: patient.bloodGroup,
      status: patient.status.toLowerCase(),
      dateOfBirth: patient.dob ?? `${2026 - patient.age}-01-01`,
    }),
  )
