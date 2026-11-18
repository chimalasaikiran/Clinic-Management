import { ApiError } from '../../lib/api'
import { localToday } from '../../features/patients/format'
import { API_BRANCHES } from './patientsApi'

// An in-memory stand-in for the staff endpoints, for page tests. The real rules are tested against the
// database in backend/test/integration/staff-clinical.test.ts.

export const apiStaff = (overrides = {}) => ({
  id: 's-1',
  staffCode: 'STF-001',
  type: 'doctor',
  fullName: 'Dr. Ananya Rao',
  email: 'a.rao@aura.test',
  mobile: '9849023114',
  department: 'Cardiology & Vascular',
  designation: 'Consultant Interventional Cardiologist',
  council: 'National Medical Commission (NMC)',
  councilNumber: 'NMC-TS-2018-49021',
  qualifications: ['MBBS', 'MD'],
  engagement: 'full_time',
  status: 'active',
  onLeave: null,
  branches: [{ id: 'b-main', name: 'Main Clinic', city: 'Hyderabad', isPrimary: true }],
  account: { linked: false, invitationPending: false, invitedEmail: null },
  practitioner: null,
  version: 1,
  createdAt: '2026-10-01T09:00:00.000Z',
  ...overrides,
})

const clone = (value) => JSON.parse(JSON.stringify(value))
const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found.`)
const timed = (status) => status === 'present' || status === 'late'

export function createStaffApi({ people = [apiStaff()], attendance = {}, leaves = {} } = {}) {
  const state = { people: clone(people), attendance: clone(attendance), leaves: clone(leaves), calls: [] }
  const record = (name, ...args) => state.calls.push([name, ...args])
  const find = (id) => {
    const person = state.people.find((entry) => entry.id === id)
    if (!person) throw notFound('Staff member')
    return person
  }
  const recordsOf = (id) => (state.attendance[id] = state.attendance[id] ?? [])
  const leavesOf = (id) => (state.leaves[id] = state.leaves[id] ?? [])

  const api = {
    list: async (params = {}) => {
      record('staff.list', params)
      const needle = (params.query ?? '').toLowerCase()
      const rows = state.people.filter((person) =>
        (!needle || `${person.fullName} ${person.staffCode} ${person.councilNumber ?? ''}`.toLowerCase().includes(needle)) &&
        (!params.type || person.type === params.type) &&
        (!params.department || person.department === params.department) &&
        (!params.branchId || person.branches.some((branch) => branch.id === params.branchId)) &&
        (!params.status || (params.status === 'on_leave' ? Boolean(person.onLeave) : person.status === params.status)))
      return { data: clone(rows), meta: { page: params.page ?? 1, pageSize: params.pageSize ?? 25, total: rows.length } }
    },
    summary: async () => {
      const total = state.people.length
      const doctors = state.people.filter((person) => person.type === 'doctor').length
      return { total, doctors, staff: total - doctors, active: state.people.filter((person) => person.status === 'active').length, inactive: state.people.filter((person) => person.status !== 'active').length, onLeave: state.people.filter((person) => person.onLeave).length, departments: [...new Set(state.people.map((person) => person.department))].sort() }
    },
    get: async (id) => clone(find(id)),
    history: async (id) => (find(id), [{ id: '1', action: 'staff.created', at: '2026-10-01T09:00:00.000Z', actor: 'Siddharth Verma', details: {} }]),
    create: async (body) => {
      record('staff.create', body)
      const number = state.people.length + 1
      const person = apiStaff({ ...body, id: `s-${number}`, staffCode: `STF-${String(number).padStart(3, '0')}`, branches: [], account: { linked: false, invitationPending: false, invitedEmail: null } })
      state.people.push(person)
      return clone(person)
    },
    update: async (id, body) => {
      record('staff.update', id, body)
      const person = find(id)
      if (body.version !== person.version) throw new ApiError(409, 'STAFF_CHANGED', 'Someone else changed this record.')
      const { version, ...fields } = body
      Object.assign(person, fields, { version: version + 1 })
      return clone(person)
    },
    setBranches: async (id, branchIds, primaryBranchId) => {
      record('staff.setBranches', id, branchIds, primaryBranchId)
      const person = find(id)
      person.branches = branchIds.map((branchId) => {
        const branch = API_BRANCHES.find((entry) => entry.id === branchId)
        return { id: branch.id, name: branch.name, city: branch.city, isPrimary: branchId === primaryBranchId }
      })
      return clone(person)
    },
    invite: async (id, email, roleIds) => {
      record('staff.invite', id, email, roleIds)
      const person = find(id)
      person.account = { linked: false, invitationPending: true, invitedEmail: email }
      return { result: 'invited', staff: clone(person) }
    },
    attendance: async (id, month, branchId) => {
      const rows = recordsOf(id).filter((entry) => entry.date.startsWith(month) && (!branchId || entry.branch.id === branchId))
      const counts = { present: 0, late: 0, absent: 0, leave: 0, unavailable: 0 }
      for (const row of rows) counts[row.status] += 1
      return { month, counts, records: clone(rows) }
    },
    recordAttendance: async (id, body) => {
      record('staff.recordAttendance', id, body)
      const person = find(id)
      if (body.date > localToday()) throw new ApiError(422, 'DATE_IN_FUTURE', 'Attendance can only be recorded for today or earlier.')
      if (recordsOf(id).some((entry) => entry.date === body.date && entry.branch.id === body.branchId)) throw new ApiError(409, 'ATTENDANCE_EXISTS', 'Attendance is already recorded for this person, branch and date.')
      const branch = person.branches.find((entry) => entry.id === body.branchId)
      const row = { id: `att-${recordsOf(id).length + 1}`, date: body.date, status: body.status, time: timed(body.status) ? body.time : null, note: body.note || null, branch: { id: branch.id, name: branch.name }, recordedBy: 'Siddharth Verma', recordedAt: new Date().toISOString(), version: 1, corrections: [] }
      recordsOf(id).unshift(row)
      return clone(row)
    },
    correctAttendance: async (id, recordId, body) => {
      record('staff.correctAttendance', id, recordId, body)
      const row = recordsOf(id).find((entry) => entry.id === recordId)
      row.corrections.unshift({ id: `c-${row.corrections.length + 1}`, fromStatus: row.status, toStatus: body.status, fromTime: row.time, toTime: timed(body.status) ? body.time : null, reason: body.reason, by: 'Siddharth Verma', at: new Date().toISOString() })
      Object.assign(row, { status: body.status, time: timed(body.status) ? body.time : null, version: row.version + 1 })
      return clone(row)
    },
    leaves: async (id) => (find(id), clone(leavesOf(id))),
    createLeave: async (id, body) => {
      record('staff.createLeave', id, body)
      const person = find(id)
      const branch = body.branchId ? person.branches.find((entry) => entry.id === body.branchId) : null
      const leave = { id: `l-${leavesOf(id).length + 1}`, kind: body.kind, title: body.title, startDate: body.startDate, endDate: body.endDate, startTime: body.startTime ?? null, endTime: body.endTime ?? null, branch: branch ? { id: branch.id, name: branch.name } : null, reason: body.reason, status: 'scheduled', createdBy: 'Siddharth Verma', createdAt: new Date().toISOString(), cancelledBy: null, cancelledAt: null }
      leavesOf(id).unshift(leave)
      return { leave: clone(leave), affectedAppointments: 0 }
    },
    cancelLeave: async (id, leaveId) => {
      record('staff.cancelLeave', id, leaveId)
      const leave = leavesOf(id).find((entry) => entry.id === leaveId)
      Object.assign(leave, { status: 'cancelled', cancelledBy: 'Siddharth Verma', cancelledAt: new Date().toISOString() })
      return clone(leave)
    },
  }
  return { api, state }
}
