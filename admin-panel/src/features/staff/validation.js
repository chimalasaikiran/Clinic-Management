import { isBlank, isEmail, isIndianMobile } from '../../lib/validators'

export function validatePerson(values) {
  const errors = {}
  const isDoctor = values.classification === 'doctor'

  if (isBlank(values.fullName)) errors.fullName = 'Enter the full name.'
  if (!isBlank(values.mobile) && !isIndianMobile(values.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.'
  if (!isBlank(values.email) && !isEmail(values.email)) errors.email = 'Enter a valid email address.'
  if (isBlank(values.department)) errors.department = 'Choose a primary department.'
  if (isBlank(values.designation)) errors.designation = 'Enter the professional title.'

  if (isDoctor) {
    if (isBlank(values.council)) errors.council = 'Choose the medical council.'
    if (isBlank(values.councilNumber)) errors.councilNumber = 'Enter the council registration number.'
    if (values.qualifications.length === 0) errors.qualifications = 'Add at least one qualification.'
  }
  return errors
}

export function validateBranchAssignment({ selectedIds }) {
  return selectedIds.length === 0 ? { branches: 'Select at least one facility to deploy to.' } : {}
}

export function validateAccountSetup({ email, mobile }) {
  const errors = {}
  if (isBlank(email)) errors.email = 'Enter the institutional work email.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'
  if (isBlank(mobile)) errors.mobile = 'Enter the mobile number for 2FA.'
  else if (!isIndianMobile(mobile.replace(/^\+91/, ''))) errors.mobile = 'Enter a valid 10-digit mobile number.'
  return errors
}

export function validateLeave({ start, end, reason }) {
  const errors = {}
  if (isBlank(start)) errors.start = 'Pick a start date.'
  if (isBlank(end)) errors.end = 'Pick an end date.'
  else if (!isBlank(start) && end < start) errors.end = 'End date cannot be before the start date.'
  if (isBlank(reason)) errors.reason = 'Add an operational justification.'
  return errors
}

export function validateAttendance({ date, status, time }) {
  const errors = {}
  if (isBlank(date)) errors.date = 'Pick the attendance date.'
  const needsTime = status === 'Present' || status === 'Late'
  if (needsTime && isBlank(time)) errors.time = 'Enter the arrival time.'
  return errors
}

export function validateCorrection({ reason }) {
  return isBlank(reason) || reason.trim().length < 10 ? { reason: 'Explain the correction (at least 10 characters) for the audit trail.' } : {}
}
