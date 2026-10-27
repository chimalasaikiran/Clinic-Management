import { isBlank, isEmail, isIndianMobile } from '../../lib/validators'

export function validateClinicProfile({ clinicName, location, city, state, facilityType }) {
  const errors = {}

  if (isBlank(clinicName)) errors.clinicName = 'Enter the clinic or organization name.'
  if (isBlank(location)) errors.location = 'Enter the primary location.'
  if (isBlank(city)) errors.city = 'Enter the city.'
  if (isBlank(state)) errors.state = 'Select a state or territory.'
  if (!facilityType) errors.facilityType = 'Choose a facility classification.'

  return errors
}

export function validatePracticeContact({ phone, email }) {
  const errors = {}

  if (isBlank(phone)) errors.phone = 'Enter the clinic phone number.'
  else if (!isIndianMobile(phone)) errors.phone = 'Enter a valid 10-digit phone number.'

  if (!isBlank(email) && !isEmail(email)) errors.email = 'Enter a valid email address.'

  return errors
}

export function validateOperatingModel({ classification, structure }) {
  const errors = {}

  if (!classification) errors.classification = 'Select a clinic classification.'
  if (!structure) errors.structure = 'Select an operational structure.'

  return errors
}

export function validateSpecialties(selectedIds) {
  if (selectedIds.length === 0) return { specialties: 'Select at least one specialty.' }
  return {}
}
