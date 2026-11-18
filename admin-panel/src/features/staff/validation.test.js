import { describe, expect, it } from 'vitest'
import { validateAccountSetup, validateAttendance, validateBranchAssignment, validateCorrection, validateLeave, validatePerson } from './validation'

const doctor = {
  classification: 'doctor',
  fullName: 'Dr. Sarita V. Nambiar',
  mobile: '9845012844',
  email: 's.nambiar@stjude.org',
  department: 'Cardiology & Vascular',
  designation: 'Senior Consultant',
  council: 'National Medical Commission (NMC)',
  councilNumber: 'NMC-TS-2016-89412',
  qualifications: ['MBBS'],
}

describe('validatePerson', () => {
  it('accepts a complete doctor', () => {
    expect(validatePerson(doctor)).toEqual({})
  })

  it('requires credentials for doctors but not for staff', () => {
    const blankCredentials = { ...doctor, council: '', councilNumber: '', qualifications: [] }
    expect(Object.keys(validatePerson(blankCredentials))).toEqual(['council', 'councilNumber', 'qualifications'])
    expect(validatePerson({ ...blankCredentials, classification: 'staff' })).toEqual({})
  })

  it('treats mobile and email as optional but validates them when present', () => {
    expect(validatePerson({ ...doctor, mobile: '', email: '' })).toEqual({})
    const errors = validatePerson({ ...doctor, mobile: '123', email: 'nope' })
    expect(errors.mobile).toMatch(/10-digit/)
    expect(errors.email).toMatch(/valid email/)
  })
})

describe('validateBranchAssignment', () => {
  it('needs at least one facility', () => {
    expect(validateBranchAssignment({ selectedIds: [] }).branches).toMatch(/at least one facility/)
    expect(validateBranchAssignment({ selectedIds: ['main'] })).toEqual({})
  })
})

describe('validateAccountSetup', () => {
  it('requires a valid sign-in email', () => {
    expect(Object.keys(validateAccountSetup({ email: '' }))).toEqual(['email'])
    expect(validateAccountSetup({ email: 'nope' }).email).toMatch(/valid email/)
    expect(validateAccountSetup({ email: 'a@b.co' })).toEqual({})
  })
})

describe('validateLeave', () => {
  it('needs dates in order and a reason', () => {
    expect(Object.keys(validateLeave({ start: '', end: '', reason: '' }))).toEqual(['start', 'end', 'reason'])
    expect(validateLeave({ start: '2026-10-20', end: '2026-10-18', reason: 'x' }).end).toMatch(/before the start/)
    expect(validateLeave({ start: '2026-10-18', end: '2026-10-20', reason: 'Conclave' })).toEqual({})
  })
})

describe('validateAttendance', () => {
  it('needs a time only for present and late entries', () => {
    expect(validateAttendance({ date: '2026-10-16', status: 'Present', time: '' }).time).toMatch(/arrival time/)
    expect(validateAttendance({ date: '2026-10-16', status: 'Absent', time: '' })).toEqual({})
    expect(validateAttendance({ date: '', status: 'Absent', time: '' }).date).toMatch(/Pick/)
  })
})

describe('validateCorrection', () => {
  it('asks for a meaningful reason', () => {
    expect(validateCorrection({ reason: 'ok' }).reason).toMatch(/at least 10/)
    expect(validateCorrection({ reason: 'Biometric gate delay' })).toEqual({})
  })
})
