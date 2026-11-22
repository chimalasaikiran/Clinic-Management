import { ApiError } from '../../lib/api'

// An in-memory stand-in for the configuration endpoints (backend/src/modules/configuration), for page tests. It
// returns the same shapes and keeps the rules the screens depend on: unique codes and names, optimistic versions,
// a primary branch that stays active, closures that cannot repeat a date. The real rules are tested against the
// database in backend/test/integration/configuration.test.ts.

const clone = (value) => JSON.parse(JSON.stringify(value))
const STAMP = '2026-11-01T09:00:00.000Z'

export const apiBranch = (overrides = {}) => ({
  id: 'b-main', code: 'MAIN', name: 'Main Clinic', addressLine1: '12 Jubilee Hills Road', addressLine2: '', city: 'Hyderabad', state: 'Telangana', pinCode: '500033', country: 'India',
  phone: '04023456789', email: 'main@aura.test', facilityType: 'Multi-specialty Clinic', status: 'active', isPrimary: true, version: 1, createdAt: STAMP, updatedAt: STAMP,
  departments: [], hours: [{ weekday: 1, start: '09:00', end: '13:00', label: 'Morning OPD' }, { weekday: 1, start: '17:00', end: '20:00', label: 'Evening OPD' }],
  ...overrides,
})

export const apiDepartment = (overrides = {}) => ({
  id: 'd-card', code: 'CARD', name: 'Cardiology', type: 'Clinical', description: 'Outpatient cardiology.', status: 'active', version: 1, createdAt: STAMP, updatedAt: STAMP,
  branchIds: ['b-main'],
  ...overrides,
})

const BRANCHES = [apiBranch(), apiBranch({ id: 'b-kdp', code: 'KDP', name: 'Kondapur Clinic', addressLine1: 'Hitec City Road', pinCode: '500084', isPrimary: false, hours: [] })]
const DEPARTMENTS = [apiDepartment(), apiDepartment({ id: 'd-gen', code: 'GEN', name: 'General Medicine', branchIds: ['b-main', 'b-kdp'] })]
const PEOPLE = [
  { id: 's-1', staffCode: 'STF-001', fullName: 'Dr. Ananya Rao', type: 'doctor', designation: 'Consultant Cardiologist', status: 'active', department: 'Cardiology' },
  { id: 's-2', staffCode: 'STF-002', fullName: 'Priya Sharma', type: 'staff', designation: 'Head Nurse', status: 'active', department: 'General Medicine' },
]

const ORGANISATION = {
  id: 'org-1', displayName: 'Aura Health', facilityType: 'Multi-specialty Clinic', location: '12 Jubilee Hills Road', city: 'Hyderabad', state: 'Telangana', status: 'active',
  phone: '04023456789', email: 'hello@aura.test', logoId: null, classification: 'multi-specialty', structure: 'collaborative', specialties: ['Cardiology', 'General Medicine'], acceptsInsurance: null, version: 1, createdAt: STAMP,
}

export const SAVED_PARTNERS = [
  { id: 'p-star', name: 'Star Health', type: 'insurer', listed: true, active: true },
  { id: 'p-mdi', name: 'Medi Assist', type: 'tpa', listed: true, active: true },
]

const fail = (status, code, message) => new ApiError(status, code, message)

export function createConfigApi({ organisation = ORGANISATION, branches = BRANCHES, departments = DEPARTMENTS, people = PEOPLE, closures = [], partners = [], agreements = [], today = '2026-11-20' } = {}) {
  const state = { organisation: clone(organisation), branches: clone(branches), departments: clone(departments), people: clone(people), closures: clone(closures), partners: clone(partners), agreements: clone(agreements), calls: [] }
  let sequence = 0
  const next = (prefix) => `${prefix}-${++sequence}`
  const record = (name, ...args) => state.calls.push([name, ...args])

  const branchOf = (id) => {
    const branch = state.branches.find((entry) => entry.id === id)
    if (!branch) throw fail(404, 'NOT_FOUND', 'Branch not found.')
    return branch
  }
  const departmentOf = (id) => {
    const department = state.departments.find((entry) => entry.id === id)
    if (!department) throw fail(404, 'NOT_FOUND', 'Department not found.')
    return department
  }
  const branchView = (branch) => ({
    ...clone(branch),
    departments: state.departments.filter((entry) => entry.branchIds.includes(branch.id)).map(({ id, code, name, status }) => ({ id, code, name, status })),
    today: { appointments: 0, staff: 0 },
  })
  const branchDetail = (id) => ({
    ...branchView(branchOf(id)),
    closures: clone(state.closures.filter((entry) => entry.branchId === id).sort((a, b) => a.date.localeCompare(b.date))),
    capabilities: { doctors: 0, services: 0, pharmacies: 0, stores: 0, staff: 0 },
  })
  const same = (a, b) => a?.toLowerCase() === b?.toLowerCase()
  const departmentView = (department) => {
    const { branchIds, ...rest } = department
    const staff = state.people.filter((person) => same(person.department, department.name))
    return { ...clone(rest), branches: state.branches.filter((branch) => branchIds.includes(branch.id)).map(({ id, code, name, status }) => ({ id, code, name, status })), counts: { staff: staff.length, doctors: 0, services: 0 } }
  }
  const departmentDetail = (id) => {
    const department = departmentOf(id)
    return { ...departmentView(department), staff: clone(state.people.filter((person) => same(person.department, department.name))), doctors: [], services: [] }
  }
  const profile = () => ({ ...clone(state.organisation), counts: { branches: state.branches.length, activeBranches: state.branches.filter((entry) => entry.status === 'active').length, departments: state.departments.filter((entry) => entry.status === 'active').length, members: 1 } })
  const partnerRef = (id) => {
    const partner = state.partners.find((entry) => entry.id === id)
    return partner ? { id: partner.id, name: partner.name, type: partner.type } : null
  }
  const agreementView = (agreement) => ({ ...clone(agreement), insurer: partnerRef(agreement.insurerId), tpa: agreement.tpaId ? partnerRef(agreement.tpaId) : null, branches: state.branches.filter((branch) => agreement.branchIds.includes(branch.id)).map(({ id, name }) => ({ id, name })) })
  const overview = () => ({ acceptsInsurance: state.organisation.acceptsInsurance, partners: clone(state.partners), agreements: state.agreements.map(agreementView) })
  const agreementOf = (id) => {
    const agreement = state.agreements.find((entry) => entry.id === id)
    if (!agreement) throw fail(404, 'NOT_FOUND', 'Agreement not found.')
    return agreement
  }
  const checkVersion = (record, version, code) => {
    if (record.version !== version) throw fail(409, code, 'Someone else changed this record. Reload it and try again.')
    record.version += 1
  }
  const assertDepartmentUnique = (code, name, exceptId) => {
    const clash = state.departments.find((entry) => entry.id !== exceptId && ((code && entry.code === code) || same(entry.name, name)))
    if (clash) throw fail(409, 'DEPARTMENT_EXISTS', clash.code === code ? `Another department already uses the code ${code}.` : `A department called “${clash.name}” already exists.`)
  }

  const api = {
    organisation: async () => profile(),
    updateOrganisation: async ({ version, ...fields }) => {
      record('updateOrganisation', { version, ...fields })
      checkVersion(state.organisation, version, 'ORGANISATION_CHANGED')
      Object.assign(state.organisation, fields)
      return profile()
    },
    saveContact: async (body) => (record('saveContact', body), Object.assign(state.organisation, body), profile()),
    saveOperations: async (body) => (record('saveOperations', body), Object.assign(state.organisation, body), profile()),
    saveSpecialties: async (body) => {
      record('saveSpecialties', body)
      state.organisation.specialties = body.specialties
      for (const name of body.specialties) if (!state.departments.some((entry) => same(entry.name, name))) state.departments.push(apiDepartment({ id: next('d'), code: `DEP-${sequence}`, name, branchIds: state.branches.map((branch) => branch.id) }))
      return profile()
    },
    completeSetup: async () => {
      record('completeSetup')
      if (!state.organisation.phone || !state.organisation.classification || !state.organisation.specialties.length) throw fail(422, 'SETUP_INCOMPLETE', 'Finish the earlier steps first.')
      state.organisation.status = 'active'
      return profile()
    },
    uploadLogo: async (file) => (record('uploadLogo', file.name), (state.organisation.logoId = next('logo')), profile()),
    logoUrl: () => '/logo.png',

    branches: async () => state.branches.map(branchView),
    branch: async (id) => branchDetail(id),
    createBranch: async (body) => {
      record('createBranch', body)
      const code = body.code.toUpperCase()
      if (state.branches.some((entry) => entry.code === code)) throw fail(409, 'BRANCH_CODE_TAKEN', `Another branch already uses the code ${code}.`)
      const { roleIds: _roleIds, ...fields } = body
      const branch = apiBranch({ ...fields, id: next('b'), code, isPrimary: false, hours: [] })
      state.branches.push(branch)
      return branchDetail(branch.id)
    },
    updateBranch: async (id, { version, ...fields }) => {
      record('updateBranch', id, { version, ...fields })
      const branch = branchOf(id)
      if (branch.isPrimary && fields.status && fields.status !== 'active') throw fail(422, 'PRIMARY_BRANCH', 'The primary branch stays active.')
      checkVersion(branch, version, 'BRANCH_CHANGED')
      Object.assign(branch, fields)
      return branchDetail(id)
    },
    setHours: async (id, sessions) => {
      record('setHours', id, sessions)
      branchOf(id).hours = clone(sessions).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
      return branchDetail(id)
    },
    addClosure: async (id, body) => {
      record('addClosure', id, body)
      branchOf(id)
      if (body.date < today) throw fail(422, 'DATE_IN_PAST', 'Choose today or a later date.')
      if (state.closures.some((entry) => entry.branchId === id && entry.date === body.date)) throw fail(409, 'CLOSURE_EXISTS', 'That date already has an exception. Remove it first to change it.')
      state.closures.push({ id: next('c'), branchId: id, ...body, createdAt: STAMP, createdBy: 'Siddharth Verma' })
      return { closures: branchDetail(id).closures, bookedThatDay: 0 }
    },
    removeClosure: async (id, closureId) => {
      record('removeClosure', id, closureId)
      state.closures = state.closures.filter((entry) => entry.id !== closureId)
      return { closures: branchDetail(id).closures, bookedThatDay: 0 }
    },

    departments: async (query = {}) => state.departments.filter((entry) => !query.status || entry.status === query.status).sort((a, b) => a.name.localeCompare(b.name)).map(departmentView),
    department: async (id) => departmentDetail(id),
    createDepartment: async (body) => {
      record('createDepartment', body)
      const code = body.code.toUpperCase()
      assertDepartmentUnique(code, body.name)
      const department = apiDepartment({ id: next('d'), code, name: body.name, type: body.type, description: body.description, status: body.status, branchIds: body.branchIds })
      state.departments.push(department)
      return departmentDetail(department.id)
    },
    updateDepartment: async (id, { version, branchIds, ...fields }) => {
      record('updateDepartment', id, { version, branchIds, ...fields })
      const department = departmentOf(id)
      if (!same(fields.name, department.name)) assertDepartmentUnique(null, fields.name, id)
      checkVersion(department, version, 'DEPARTMENT_CHANGED')
      for (const person of state.people) if (same(person.department, department.name)) person.department = fields.name
      Object.assign(department, fields, { branchIds })
      return departmentDetail(id)
    },
    addDepartmentMembers: async (id, body) => {
      record('addDepartmentMembers', id, body)
      const department = departmentOf(id)
      for (const person of state.people) if (body.staffIds.includes(person.id)) person.department = department.name
      return departmentDetail(id)
    },

    insurance: async () => overview(),
    setAcceptance: async (accepts) => (record('setAcceptance', accepts), (state.organisation.acceptsInsurance = accepts), overview()),
    addPartner: async (body) => {
      record('addPartner', body)
      const existing = state.partners.find((entry) => entry.type === body.type && same(entry.name, body.name))
      if (existing) existing.active = true
      else state.partners.push({ id: next('p'), active: true, ...body })
      return overview()
    },
    setPartnerActive: async (id, active) => {
      record('setPartnerActive', id, active)
      state.partners.find((entry) => entry.id === id).active = active
      return overview()
    },
    uploadAgreement: async (file) => {
      record('uploadAgreement', file.name)
      return { id: next('doc'), fileName: file.name, size: file.size }
    },
    documentUrl: (id) => `/documents/${id}`,
    createAgreement: async (body) => {
      record('createAgreement', body)
      if (state.agreements.some((entry) => same(entry.reference, body.reference))) throw fail(409, 'REFERENCE_TAKEN', 'Another agreement already uses this reference.')
      const agreement = { id: next('a'), code: `AGR-000${sequence}`, status: 'draft', version: 1, activatedAt: null, activatedBy: null, createdBy: 'Siddharth Verma', createdAt: STAMP, updatedAt: STAMP, notes: '', document: body.documentId ? { id: body.documentId, fileName: 'agreement.pdf', size: 1024 } : null, ...clone(body) }
      state.agreements.unshift(agreement)
      return agreementView(agreement)
    },
    updateAgreement: async (id, { version, ...body }) => {
      record('updateAgreement', id, { version, ...body })
      const agreement = agreementOf(id)
      if (agreement.status !== 'draft') throw fail(409, 'AGREEMENT_LOCKED', 'Only a draft agreement can be changed.')
      checkVersion(agreement, version, 'AGREEMENT_CHANGED')
      Object.assign(agreement, clone(body), body.documentId ? { document: { id: body.documentId, fileName: 'agreement.pdf', size: 1024 } } : {})
      return agreementView(agreement)
    },
    activateAgreement: async (id, version) => {
      record('activateAgreement', id, version)
      const agreement = agreementOf(id)
      checkVersion(agreement, version, 'AGREEMENT_CHANGED')
      Object.assign(agreement, { status: 'active', activatedAt: STAMP, activatedBy: 'Siddharth Verma' })
      state.organisation.acceptsInsurance = true
      return agreementView(agreement)
    },
    endAgreement: async (id, version) => {
      record('endAgreement', id, version)
      const agreement = agreementOf(id)
      checkVersion(agreement, version, 'AGREEMENT_CHANGED')
      agreement.status = 'ended'
      return agreementView(agreement)
    },
  }
  return { api, state }
}
