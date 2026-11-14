import { describe, expect, it } from 'vitest'
import {
  validateBranch,
  validateDepartment,
  validateException,
  validateGrant,
  validateInventoryLocation,
  validatePrice,
  validateService,
} from './validation'

const validBranch = {
  name: 'Kondapur Specialty Clinic',
  code: 'KDP-01',
  facilityType: 'Specialty & Surgical Hub',
  addressLine1: 'Plot No. 42, Hitec City Main Road',
  city: 'Hyderabad',
  state: 'Telangana',
  pin: '500084',
  phone: '4023456789',
  email: 'kondapur@carepointhealth.in',
}

describe('validateBranch', () => {
  it('accepts a complete branch', () => {
    expect(validateBranch(validBranch)).toEqual({})
  })

  it('requires the mandatory fields', () => {
    const errors = validateBranch({ ...validBranch, name: '', code: '', pin: '', email: '' })
    expect(Object.keys(errors)).toEqual(['name', 'code', 'pin', 'email'])
  })

  it('rejects a malformed code, PIN and email', () => {
    const errors = validateBranch({ ...validBranch, code: 'k d', pin: '0123', email: 'nope' })
    expect(errors.code).toMatch(/3–10/)
    expect(errors.pin).toMatch(/6-digit/)
    expect(errors.email).toMatch(/valid email/)
  })

  it('accepts a landline with an area code', () => {
    expect(validateBranch({ ...validBranch, phone: '040 2345 6789' }).phone).toBeUndefined()
    expect(validateBranch({ ...validBranch, phone: '12' }).phone).toMatch(/valid phone/)
  })
})

describe('validateException', () => {
  it('needs a date and a reason', () => {
    expect(validateException({ date: '', reason: ' ' })).toEqual({
      date: 'Pick a date.',
      reason: 'Add a reason for the exception.',
    })
    expect(validateException({ date: '2026-12-25', reason: 'Christmas' })).toEqual({})
  })
})

describe('validateGrant', () => {
  it('needs a selection and a justification', () => {
    expect(Object.keys(validateGrant({ selectedCount: 0, justification: '' }))).toEqual(['selection', 'justification'])
    expect(validateGrant({ selectedCount: 2, justification: 'Q4 rotation' })).toEqual({})
  })
})

describe('validateInventoryLocation', () => {
  it('requires a name and a well-formed code', () => {
    expect(validateInventoryLocation({ name: '', code: '' })).toEqual({ name: 'Enter a location name.', code: 'Enter a location code.' })
    expect(validateInventoryLocation({ name: 'Store', code: 'a b' }).code).toMatch(/3–16/)
    expect(validateInventoryLocation({ name: 'Store', code: 'st-trauma-01' })).toEqual({})
  })
})

describe('validateDepartment', () => {
  it('requires a name, a code and at least one location', () => {
    expect(Object.keys(validateDepartment({ name: '', code: '', locationCount: 0 }))).toEqual(['name', 'code', 'locations'])
    expect(validateDepartment({ name: 'Cardiology', code: 'DEP-CARD', locationCount: 1 })).toEqual({})
  })
})

describe('validateService', () => {
  it('requires a name, a department and an authorized location', () => {
    expect(Object.keys(validateService({ name: '', department: '', locationCount: 0 }))).toEqual(['name', 'department', 'locations'])
    expect(validateService({ name: 'ECG', department: 'Cardiology', locationCount: 2 })).toEqual({})
  })
})

describe('validatePrice', () => {
  it('accepts a positive amount with an effective date', () => {
    expect(validatePrice({ price: '900', effectiveFrom: '2026-10-01' })).toEqual({})
    expect(validatePrice({ price: '899.50', effectiveFrom: '2026-10-01' })).toEqual({})
  })

  it('rejects blank, zero and non-numeric prices', () => {
    expect(validatePrice({ price: '', effectiveFrom: '' })).toEqual({ price: 'Enter the service price.', effectiveFrom: 'Pick an effective date.' })
    expect(validatePrice({ price: '0', effectiveFrom: '2026-10-01' }).price).toMatch(/greater than zero/)
    expect(validatePrice({ price: 'abc', effectiveFrom: '2026-10-01' }).price).toMatch(/greater than zero/)
  })
})
