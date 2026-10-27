import { describe, expect, it } from 'vitest'
import { isBlank, isEmail, isIndianMobile } from './validators'

describe('isBlank', () => {
  it('treats empty and whitespace-only values as blank', () => {
    expect(isBlank('')).toBe(true)
    expect(isBlank('   ')).toBe(true)
    expect(isBlank(undefined)).toBe(true)
    expect(isBlank(' Apex ')).toBe(false)
  })
})

describe('isEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isEmail('doctor@clinic.com')).toBe(true)
    expect(isEmail('  doctor@clinic.co.in ')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isEmail('doctor')).toBe(false)
    expect(isEmail('doctor@clinic')).toBe(false)
    expect(isEmail('doctor @clinic.com')).toBe(false)
  })
})

describe('isIndianMobile', () => {
  it('accepts ten digits starting with 6-9, ignoring spaces and dashes', () => {
    expect(isIndianMobile('9876543210')).toBe(true)
    expect(isIndianMobile('98765 43210')).toBe(true)
    expect(isIndianMobile('98765-43210')).toBe(true)
  })

  it('rejects wrong length or leading digit', () => {
    expect(isIndianMobile('987654321')).toBe(false)
    expect(isIndianMobile('5876543210')).toBe(false)
    expect(isIndianMobile('98765432101')).toBe(false)
    expect(isIndianMobile('98765abcde')).toBe(false)
  })
})
