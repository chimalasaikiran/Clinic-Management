import { describe, expect, it } from 'vitest'
import {
  validateClinicProfile,
  validateOperatingModel,
  validatePracticeContact,
  validateSpecialties,
} from './validation'

describe('validateClinicProfile', () => {
  const valid = {
    clinicName: 'Apex Health Institute',
    location: 'Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    facilityType: 'Outpatient Practice',
  }

  it('returns no errors when every field is filled', () => {
    expect(validateClinicProfile(valid)).toEqual({})
  })

  it('reports each missing field', () => {
    const errors = validateClinicProfile({ clinicName: ' ', location: '', city: '', state: '', facilityType: '' })
    expect(Object.keys(errors)).toEqual(['clinicName', 'location', 'city', 'state', 'facilityType'])
  })
})

describe('validatePracticeContact', () => {
  it('requires a phone number but not an email', () => {
    expect(validatePracticeContact({ phone: '9876543210', email: '' })).toEqual({})
    expect(validatePracticeContact({ phone: '', email: '' }).phone).toBeDefined()
  })

  it('validates the email only when one is provided', () => {
    expect(validatePracticeContact({ phone: '9876543210', email: 'not-an-email' }).email).toBeDefined()
    expect(validatePracticeContact({ phone: '9876543210', email: 'front@clinic.com' })).toEqual({})
  })
})

describe('validateOperatingModel', () => {
  it('requires both a classification and an operating structure', () => {
    expect(Object.keys(validateOperatingModel({ classification: '', structure: '' }))).toEqual([
      'classification',
      'structure',
    ])
    expect(validateOperatingModel({ classification: 'general', structure: 'solo' })).toEqual({})
  })
})

describe('validateSpecialties', () => {
  it('requires at least one specialty', () => {
    expect(validateSpecialties([]).specialties).toBeDefined()
    expect(validateSpecialties(['cardiology'])).toEqual({})
  })
})
