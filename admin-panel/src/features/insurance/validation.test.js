import { describe, expect, it } from 'vitest'
import { agreementFileError, validateAcceptance, validateAgreement, validateUnlistedPartner } from './validation'

describe('validateAcceptance', () => {
  it('requires an answer', () => {
    expect(validateAcceptance({ acceptance: '', methods: [], partnerIds: [] })).toEqual({ acceptance: 'Choose whether your clinic accepts insurance.' })
  })

  it('needs a billing method and a partner when insurance is accepted', () => {
    expect(Object.keys(validateAcceptance({ acceptance: 'yes', methods: [], partnerIds: [] }))).toEqual(['methods', 'partners'])
    expect(validateAcceptance({ acceptance: 'yes', methods: ['cashless'], partnerIds: ['hdfc-ergo'] })).toEqual({})
  })

  it('needs nothing else when insurance is declined', () => {
    expect(validateAcceptance({ acceptance: 'no', methods: [], partnerIds: [] })).toEqual({})
  })
})

describe('validateUnlistedPartner', () => {
  it('rejects blanks and duplicates, ignoring case', () => {
    expect(validateUnlistedPartner({ name: '', type: '' }, [])).toEqual({ name: 'Enter the partner name.', type: 'Choose insurer or TPA.' })
    expect(validateUnlistedPartner({ name: 'vidal health tpa ', type: 'TPA' }, ['Vidal Health TPA']).name).toBe('This partner is already in the list.')
  })
})

describe('validateAgreement', () => {
  const valid = { insurerId: 'hdfc-ergo', reference: 'BLR-001', startDate: '2026-12-01', endDate: '2027-11-30', branchIds: ['bangalore-central'], services: ['opd'] }

  it('accepts a complete agreement', () => {
    expect(validateAgreement(valid)).toEqual({})
  })

  it('requires the end date to follow the start date', () => {
    expect(validateAgreement({ ...valid, endDate: '2026-12-01' }).endDate).toBe('End date must be after the start date.')
  })

  it('requires a branch and a service', () => {
    expect(validateAgreement({ ...valid, branchIds: [], services: [] })).toEqual({ branches: 'Choose at least one branch.', services: 'Choose at least one service.' })
  })
})

describe('agreementFileError', () => {
  it('accepts PDFs up to 10 MB', () => {
    expect(agreementFileError({ name: 'agreement.pdf', type: 'application/pdf', size: 1024 })).toBe('')
    expect(agreementFileError({ name: 'scan.png', type: 'image/png', size: 1024 })).toBe('Upload the agreement as a PDF.')
    expect(agreementFileError({ name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toBe('The file is larger than 10 MB.')
  })
})
