import { isBlank, isEmail, isIndianMobile } from '../../lib/validators'
import { TODAY } from './format'

const MIN_NOTE_LENGTH = 10
const PIN_PATTERN = /^\d{6}$/

const needsNote = (value, message) => (isBlank(value) || value.trim().length < MIN_NOTE_LENGTH ? message : undefined)
const inRange = (value, min, max) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max

export function validatePatient(values, { duplicateResolved = true } = {}) {
  const errors = {}
  if (isBlank(values.title)) errors.title = 'Choose a title.'
  if (isBlank(values.fullName)) errors.fullName = 'Enter the full legal name.'
  if (isBlank(values.mobile)) errors.mobile = 'Enter the primary mobile number.'
  else if (!isIndianMobile(values.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.'
  if (!isBlank(values.altMobile) && !isIndianMobile(values.altMobile)) errors.altMobile = 'Enter a valid 10-digit number.'
  if (!isBlank(values.email) && !isEmail(values.email)) errors.email = 'Enter a valid email address.'
  if (!isBlank(values.aadhaarLast4) && !/^\d{4}$/.test(values.aadhaarLast4)) errors.aadhaarLast4 = 'Enter the last 4 digits only.'
  if (isBlank(values.pin)) errors.pin = 'Enter the PIN code.'
  else if (!PIN_PATTERN.test(values.pin.trim())) errors.pin = 'PIN code must be 6 digits.'
  if (isBlank(values.dob)) errors.dob = 'Enter the date of birth.'
  else if (values.dob > TODAY) errors.dob = 'Date of birth cannot be in the future.'
  if (isBlank(values.gender)) errors.gender = 'Select a gender.'
  if (!isBlank(values.emergencyPhone) && !isIndianMobile(values.emergencyPhone.replace(/^\+91/, ''))) errors.emergencyPhone = 'Enter a valid 10-digit number.'
  if (!duplicateResolved) errors.duplicate = 'Resolve the duplicate match before registering.'
  return errors
}

export function validateBooking({ department, doctorId, serviceCode, slot, reason }) {
  const errors = {}
  if (isBlank(department)) errors.department = 'Choose a department.'
  if (isBlank(doctorId)) errors.doctorId = 'Choose a consulting doctor.'
  if (isBlank(serviceCode)) errors.serviceCode = 'Choose a service.'
  if (isBlank(slot)) errors.slot = 'Select an available time slot.'
  if (isBlank(reason)) errors.reason = 'Enter the reason for the visit.'
  return errors
}

// Cancel, no-show and reschedule all need a reason class and a short audit note.
export function validateWorkflowReason({ reasonId, note }) {
  const errors = {}
  if (isBlank(reasonId)) errors.reasonId = 'Select a reason.'
  const noteError = needsNote(note, 'Add an operational note (at least 10 characters) for the audit ledger.')
  if (noteError) errors.note = noteError
  return errors
}

export function validateReschedule({ date, slot, reasonId, note }) {
  const errors = validateWorkflowReason({ reasonId, note })
  if (isBlank(date)) errors.date = 'Pick a new date.'
  if (isBlank(slot)) errors.slot = 'Pick a new time slot.'
  return errors
}

export function validateCheckIn({ time, channel }) {
  const errors = {}
  if (isBlank(time)) errors.time = 'Enter the arrival time.'
  if (isBlank(channel)) errors.channel = 'Choose how arrival was verified.'
  return errors
}

export function validateVitals(values) {
  const errors = {}
  if (!inRange(values.systolic, 50, 300)) errors.systolic = 'Enter systolic between 50 and 300.'
  if (!inRange(values.diastolic, 30, 200)) errors.diastolic = 'Enter diastolic between 30 and 200.'
  else if (!errors.systolic && Number(values.diastolic) >= Number(values.systolic)) errors.diastolic = 'Diastolic must be lower than systolic.'
  if (!inRange(values.pulse, 20, 250)) errors.pulse = 'Enter a pulse between 20 and 250.'
  if (!inRange(values.resp, 4, 80)) errors.resp = 'Enter a rate between 4 and 80.'
  if (!inRange(values.temp, 90, 110)) errors.temp = 'Enter a temperature between 90 and 110 °F.'
  if (!inRange(values.spo2, 50, 100)) errors.spo2 = 'Enter SpO₂ between 50 and 100.'
  if (!inRange(values.weight, 1, 400)) errors.weight = 'Enter the weight in kg.'
  if (!inRange(values.height, 30, 250)) errors.height = 'Enter the height in cm.'
  return errors
}

export function bmiOf(weightKg, heightCm) {
  const weight = Number(weightKg)
  const height = Number(heightCm) / 100
  return weight > 0 && height > 0 ? Math.round((weight / (height * height)) * 10) / 10 : null
}

export function bmiClass(bmi) {
  if (bmi === null) return ''
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal weight'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

export function bpStage(systolic, diastolic) {
  if (systolic >= 140 || diastolic >= 90) return 'Stage 2 Hypertension'
  if (systolic >= 130 || diastolic >= 80) return 'Stage 1 Hypertension'
  if (systolic >= 120) return 'Elevated'
  return 'Normal'
}

export function validateMedication({ medicineId, strength, dose, frequencyId, durationDays }) {
  const errors = {}
  if (isBlank(medicineId)) errors.medicineId = 'Choose a medication from the formulary.'
  if (isBlank(strength)) errors.strength = 'Choose a strength.'
  if (!inRange(dose, 1, 20)) errors.dose = 'Enter a dose between 1 and 20.'
  if (isBlank(frequencyId)) errors.frequencyId = 'Choose a frequency.'
  if (!durationDays) errors.durationDays = 'Choose a duration.'
  return errors
}

// Allergy cross-check: returns the allergies that conflict with the chosen medicine class.
export function allergyConflicts(drugClass, allergies) {
  return allergies.filter((allergy) => allergy.drugClass === drugClass)
}

export function validatePrescription({ items }) {
  return items.length ? {} : { items: 'Add at least one medication before authorizing.' }
}

export function validateOrder({ indication, items }) {
  const errors = {}
  if (isBlank(indication)) errors.indication = 'Enter the clinical indication and justification.'
  if (!items.length) errors.items = 'Select at least one investigation.'
  return errors
}

export function validateReferral({ target, priority, indication, narrative }) {
  const errors = {}
  if (isBlank(target)) errors.target = 'Choose a destination specialist or facility.'
  if (isBlank(priority)) errors.priority = 'Choose a priority tier.'
  if (isBlank(indication)) errors.indication = 'Enter the primary clinical indication.'
  const narrativeError = needsNote(narrative, 'Add a clinical narrative (at least 10 characters).')
  if (narrativeError) errors.narrative = narrativeError
  return errors
}

export function validateFollowUp({ staff, representative, outcome, notes }) {
  const errors = {}
  if (isBlank(representative)) errors.representative = 'Enter the receiving representative.'
  if (isBlank(staff)) errors.staff = 'Enter the recording staff member.'
  if (isBlank(outcome)) errors.outcome = 'Select a contact outcome.'
  const notesError = needsNote(notes, 'Record the conversation (at least 10 characters).')
  if (notesError) errors.notes = notesError
  return errors
}

export function validateInbound({ checks }) {
  return checks.every(Boolean) ? {} : { checks: 'Complete the clinical review checklist before accepting.' }
}

export function validateInvoice({ lines }) {
  return lines.length ? {} : { lines: 'Add at least one billable line.' }
}

export function validatePayment({ amount, allocated }) {
  const errors = {}
  if (!(Number(amount) > 0)) errors.amount = 'Enter the amount received.'
  else if (Number(allocated) > Number(amount)) errors.allocation = 'Allocated amount exceeds the payment received.'
  return errors
}

export function validateRefund({ amount, available, reason, justification }) {
  const errors = {}
  if (!(Number(amount) > 0)) errors.amount = 'Enter the refund amount.'
  else if (Number(amount) > available) errors.amount = 'Refund exceeds the refundable balance.'
  if (isBlank(reason)) errors.reason = 'Select a statutory reason.'
  const justificationError = needsNote(justification, 'Add a justification (at least 10 characters).')
  if (justificationError) errors.justification = justificationError
  return errors
}

export function validateFamilyMember(values) {
  const errors = {}
  if (isBlank(values.name)) errors.name = 'Enter the full legal name.'
  if (isBlank(values.relationship)) errors.relationship = 'Choose the relationship.'
  if (isBlank(values.mobile)) errors.mobile = 'Enter the primary mobile number.'
  else if (!isIndianMobile(values.mobile.replace(/^\+91/, ''))) errors.mobile = 'Enter a valid 10-digit mobile number.'
  if (!isBlank(values.email) && !isEmail(values.email)) errors.email = 'Enter a valid email address.'
  if (values.legalProxy && isBlank(values.documentId)) errors.documentId = 'A legal proxy needs a verified document identifier.'
  return errors
}

export function validateMessage({ recipientId, body, purpose }) {
  const errors = {}
  if (isBlank(recipientId)) errors.recipientId = 'Choose a recipient.'
  if (isBlank(purpose)) errors.purpose = 'Choose the message purpose.'
  if (isBlank(body)) errors.body = 'Write the message to send.'
  return errors
}

export function validateDiagnosis({ icd, description }) {
  const errors = {}
  if (isBlank(icd)) errors.icd = 'Search and select a diagnosis from the catalogue.'
  if (isBlank(description)) errors.description = 'Add the clinical description.'
  return errors
}

export function validateMitigation({ dispositionId, justification }) {
  const errors = {}
  if (isBlank(dispositionId)) errors.dispositionId = 'Select a clinical disposition.'
  const justificationError = needsNote(justification, 'Add a clinical justification (at least 10 characters).')
  if (justificationError) errors.justification = justificationError
  return errors
}

export function validateResultReview({ outcome, note }) {
  const errors = {}
  if (isBlank(outcome)) errors.outcome = 'Select the clinical assessment outcome.'
  const noteError = needsNote(note, 'Add a clinical note (at least 10 characters).')
  if (noteError) errors.note = noteError
  return errors
}
