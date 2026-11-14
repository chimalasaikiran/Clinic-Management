import { describe, expect, it } from 'vitest'
import { validateAccount, validateOtp, validateSignIn } from './validation'

const validAccount = { fullName: 'Siddharth Verma', email: 'sid@clinic.com', password: 'clinic2026' }

describe('validateAccount', () => {
  it('returns no errors for valid input', () => {
    expect(validateAccount(validAccount)).toEqual({})
  })

  it('requires every field', () => {
    expect(Object.keys(validateAccount({ fullName: '', email: '', password: '' }))).toEqual([
      'fullName',
      'email',
      'password',
    ])
  })

  it('flags an invalid email and a weak password separately from missing ones', () => {
    const errors = validateAccount({ ...validAccount, email: 'sid@', password: 'short1' })
    expect(errors.email).toMatch(/valid email/i)
    expect(errors.password).toMatch(/at least 8 characters/)
  })
})

describe('validateSignIn', () => {
  it('accepts an email and any non-empty password', () => {
    expect(validateSignIn({ email: 'sid@clinic.com', password: 'x' })).toEqual({})
  })

  it('requires both fields and a valid email', () => {
    expect(Object.keys(validateSignIn({ email: '', password: '' }))).toEqual(['email', 'password'])
    expect(validateSignIn({ email: 'sid', password: 'x' }).email).toMatch(/valid email/i)
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
