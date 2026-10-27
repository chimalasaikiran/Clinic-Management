import { describe, expect, it } from 'vitest'
import { validateAccount, validateOtp } from './validation'

const validAccount = { fullName: 'Siddharth Verma', email: 'sid@clinic.com', mobile: '9876543210' }

describe('validateAccount', () => {
  it('returns no errors for valid input', () => {
    expect(validateAccount(validAccount)).toEqual({})
  })

  it('requires every field', () => {
    expect(Object.keys(validateAccount({ fullName: '', email: '', mobile: '' }))).toEqual([
      'fullName',
      'email',
      'mobile',
    ])
  })

  it('flags an invalid email and mobile number separately from missing ones', () => {
    const errors = validateAccount({ ...validAccount, email: 'sid@', mobile: '12345' })
    expect(errors.email).toMatch(/valid email/i)
    expect(errors.mobile).toMatch(/10-digit/)
  })
})

describe('validateOtp', () => {
  it('accepts a complete code', () => {
    expect(validateOtp(['8', '4', '2', '1', '0', '9'])).toEqual({})
  })

  it('rejects an incomplete code', () => {
    expect(validateOtp(['8', '4', '', '', '', '']).code).toMatch(/6-digit/)
  })
})
