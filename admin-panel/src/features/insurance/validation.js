import { isBlank } from '../../lib/validators'
import { MAX_AGREEMENT_SIZE } from './data/options'

export function validateAcceptance({ acceptance, methods, partnerIds }) {
  const errors = {}
  if (!acceptance) errors.acceptance = 'Choose whether your clinic accepts insurance.'
  if (acceptance !== 'yes') return errors
  if (!methods.length) errors.methods = 'Choose cashless billing, reimbursement support or both.'
  if (!partnerIds.length) errors.partners = 'Select at least one insurer or TPA.'
  return errors
}

export function validateUnlistedPartner({ name, type }, existingNames) {
  const errors = {}
  if (isBlank(name)) errors.name = 'Enter the partner name.'
  else if (existingNames.some((existing) => existing.toLowerCase() === name.trim().toLowerCase())) errors.name = 'This partner is already in the list.'
  if (isBlank(type)) errors.type = 'Choose insurer or TPA.'
  return errors
}

export function validateAgreement({ insurerId, reference, startDate, endDate, branchIds, services }) {
  const errors = {}
  if (isBlank(insurerId)) errors.insurerId = 'Choose the insurer for this agreement.'
  if (isBlank(reference)) errors.reference = 'Enter the agreement reference.'
  if (isBlank(startDate)) errors.startDate = 'Pick the proposed start date.'
  if (isBlank(endDate)) errors.endDate = 'Pick the proposed end date.'
  else if (startDate && endDate <= startDate) errors.endDate = 'End date must be after the start date.'
  if (!branchIds.length) errors.branches = 'Choose at least one branch.'
  if (!services.length) errors.services = 'Choose at least one service.'
  return errors
}

// Returns an error message for an unacceptable agreement file, or '' when it is fine.
export function agreementFileError(file) {
  if (!file) return ''
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Upload the agreement as a PDF.'
  if (file.size > MAX_AGREEMENT_SIZE) return 'The file is larger than 10 MB.'
  return ''
}
