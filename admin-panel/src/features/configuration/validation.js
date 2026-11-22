import { isBlank, isEmail, isIndianMobile } from '../../lib/validators'

const PIN_PATTERN = /^[1-9]\d{5}$/
const BRANCH_CODE_PATTERN = /^[A-Z0-9-]{3,10}$/

export function validateBranch(values) {
  const errors = {}

  if (isBlank(values.name)) errors.name = 'Enter the branch name.'

  if (isBlank(values.code)) errors.code = 'Enter a branch code.'
  else if (!BRANCH_CODE_PATTERN.test(values.code.trim().toUpperCase())) {
    errors.code = 'Use 3–10 letters, numbers or hyphens.'
  }

  if (isBlank(values.facilityType)) errors.facilityType = 'Choose a facility type.'
  if (isBlank(values.addressLine1)) errors.addressLine1 = 'Enter the street address.'
  if (isBlank(values.city)) errors.city = 'Enter the city.'
  if (isBlank(values.state)) errors.state = 'Enter the state.'

  if (isBlank(values.pin)) errors.pin = 'Enter the PIN code.'
  else if (!PIN_PATTERN.test(values.pin.trim())) errors.pin = 'Enter a valid 6-digit PIN code.'

  if (isBlank(values.phone)) errors.phone = 'Enter the branch phone number.'
  else if (!isIndianMobile(values.phone) && !/^\d{8,11}$/.test(values.phone.replace(/[\s-]/g, ''))) {
    errors.phone = 'Enter a valid phone number.'
  }

  if (isBlank(values.email)) errors.email = 'Enter the branch email.'
  else if (!isEmail(values.email)) errors.email = 'Enter a valid email address.'

  return errors
}

export function validateException({ date, reason }) {
  const errors = {}
  if (isBlank(date)) errors.date = 'Pick a date.'
  if (isBlank(reason)) errors.reason = 'Add a reason for the exception.'
  return errors
}

export function validateGrant({ selectedCount, justification }) {
  const errors = {}
  if (selectedCount === 0) errors.selection = 'Select at least one person or role to grant access.'
  if (isBlank(justification)) errors.justification = 'Add an administrative justification.'
  return errors
}

export function validateInventoryLocation({ name, code }) {
  const errors = {}
  if (isBlank(name)) errors.name = 'Enter a location name.'
  if (isBlank(code)) errors.code = 'Enter a location code.'
  else if (!/^[A-Z0-9-]{3,16}$/.test(code.trim().toUpperCase())) errors.code = 'Use 3–16 letters, numbers or hyphens.'
  return errors
}

export function validateDepartment({ name, code, locationCount }) {
  const errors = {}
  if (isBlank(name)) errors.name = 'Enter the department name.'
  if (isBlank(code)) errors.code = 'Enter a department code.'
  else if (!/^[A-Z0-9-]{2,20}$/.test(code.trim().toUpperCase())) errors.code = 'Use 2–20 letters, numbers or hyphens.'
  if (locationCount === 0) errors.locations = 'Choose at least one clinic location.'
  return errors
}

export function validateService({ name, department, locationCount }) {
  const errors = {}
  if (isBlank(name)) errors.name = 'Enter the service name.'
  if (isBlank(department)) errors.department = 'Choose the primary department.'
  if (locationCount === 0) errors.locations = 'Authorize at least one branch location.'
  return errors
}

export function validatePrice({ price, effectiveFrom }) {
  const errors = {}
  if (isBlank(price)) errors.price = 'Enter the service price.'
  else if (!/^\d+(\.\d{1,2})?$/.test(price.trim()) || Number(price) <= 0) errors.price = 'Enter an amount greater than zero.'
  if (isBlank(effectiveFrom)) errors.effectiveFrom = 'Pick an effective date.'
  return errors
}
