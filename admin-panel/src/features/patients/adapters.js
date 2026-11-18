import { ageFrom, digitsOf, formatDate, formatTime, initialsOf, localToday } from './format'

// Translations between the API's records and the shapes the patient and appointment screens display.

export const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' }
export const GENDER_VALUES = { Male: 'male', Female: 'female', Other: 'other' }

export const STATUS_LABELS = {
  pending: 'Pending Confirmation',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}
export const STATUS_VALUES = Object.fromEntries(Object.entries(STATUS_LABELS).map(([value, label]) => [label, value]))

export const TYPE_LABELS = { consultation: 'Consultation', follow_up: 'Follow-up', procedure: 'Procedure', diagnostic_review: 'Diagnostic Review' }
export const TYPE_VALUES = Object.fromEntries(Object.entries(TYPE_LABELS).map(([value, label]) => [label, value]))

export const CHANNEL_LABELS = { reception: 'Reception / In-Person Intake', phone: 'Phone Call', portal: 'Patient Portal', referral: 'Referral Desk', walk_in: 'Walk-in · Reception / In-Person Intake' }
export const CHANNEL_VALUES = { 'Reception / In-Person Intake': 'reception', 'Phone Call': 'phone', 'Patient Portal': 'portal', 'Referral Desk': 'referral' }

const ACTION_TEXT = {
  booked: 'Appointment booked',
  walk_in: 'Walk-in registered',
  confirm: 'Appointment confirmed',
  reschedule: 'Appointment rescheduled',
  checkIn: 'Patient arrived',
  start: 'Encounter started',
  complete: 'Visit completed',
  cancel: 'Appointment cancelled',
  noShow: 'Marked as no-show',
}

// "+91 98452 11029" for a stored 10-digit number.
export const formatMobile = (digits) => (digits ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : '')

export function toPatientView(patient) {
  const address = [patient.addressLine, patient.area, patient.city, patient.state, patient.pinCode].filter(Boolean).join(', ')
  return {
    id: patient.id,
    mrn: patient.mrn,
    title: patient.title,
    name: patient.fullName,
    initials: initialsOf(patient.fullName),
    tone: 'slate',
    age: ageFrom(patient.dateOfBirth, localToday()),
    dob: patient.dateOfBirth,
    gender: GENDER_LABELS[patient.gender],
    abha: patient.abhaNumber ?? 'Not linked',
    mobile: formatMobile(patient.mobile),
    // The SMS OTP gateway is not connected, so numbers are recorded as given.
    contactNote: 'Not OTP-verified',
    email: patient.email ?? '',
    address,
    branch: patient.homeBranch?.name ?? '',
    branchId: patient.homeBranch?.id ?? '',
    lastVisit: patient.lastVisit?.date ?? null,
    lastDoctor: patient.lastVisit ? `${patient.lastVisit.practitioner} · ${patient.lastVisit.department}` : '',
    status: patient.status === 'active' ? 'Active' : 'Inactive',
    statusNote: patient.statusNote ?? undefined,
    bloodGroup: patient.bloodGroup ?? 'Unknown',
    regDate: patient.createdAt.slice(0, 10),
    language: patient.language ?? '',
    emergencyName: patient.emergencyName ?? '',
    emergencyRelation: patient.emergencyRelation ?? '',
    emergencyPhone: formatMobile(patient.emergencyPhone),
    careTeam: null,
    consent: 'Consent not recorded',
    version: patient.version,
    record: patient,
  }
}

// Register / edit form values from a stored patient.
export function formValuesFromPatient(patient, blank) {
  return {
    ...blank,
    title: patient.title,
    fullName: patient.fullName,
    alias: patient.alias ?? '',
    aadhaarLast4: patient.aadhaarLast4 ?? '',
    abha: patient.abhaNumber ?? '',
    mobile: patient.mobile,
    altMobile: patient.altMobile ?? '',
    email: patient.email ?? '',
    house: patient.addressLine ?? '',
    area: patient.area ?? '',
    city: patient.city ?? '',
    state: patient.state ?? '',
    pin: patient.pinCode,
    dob: patient.dateOfBirth,
    gender: GENDER_LABELS[patient.gender],
    bloodGroup: patient.bloodGroup ?? '',
    language: patient.language ?? blank.language,
    emergencyName: patient.emergencyName ?? '',
    emergencyRelation: patient.emergencyRelation ?? '',
    emergencyPhone: patient.emergencyPhone ?? '',
    whatsapp: patient.notifyWhatsapp,
    sms: patient.notifySms,
    branchId: patient.homeBranch.id,
    intakeUnit: patient.intakeUnit ?? blank.intakeUnit,
  }
}

// API body for creating or updating a patient from the form.
export function patientPayload(values) {
  return {
    title: values.title,
    fullName: values.fullName.trim(),
    alias: values.alias,
    aadhaarLast4: values.aadhaarLast4,
    abhaNumber: values.abha,
    mobile: digitsOf(values.mobile).slice(-10),
    altMobile: values.altMobile ? digitsOf(values.altMobile).slice(-10) : '',
    email: values.email,
    addressLine: values.house,
    area: values.area,
    city: values.city,
    state: values.state,
    pinCode: values.pin.trim(),
    dateOfBirth: values.dob,
    gender: GENDER_VALUES[values.gender],
    bloodGroup: values.bloodGroup,
    language: values.language,
    emergencyName: values.emergencyName,
    emergencyRelation: values.emergencyRelation,
    emergencyPhone: values.emergencyPhone ? digitsOf(values.emergencyPhone).slice(-10) : '',
    notifyWhatsapp: values.whatsapp,
    notifySms: values.sms,
    homeBranchId: values.branchId,
    intakeUnit: values.intakeUnit,
  }
}

const doctorName = (practitioner) => (practitioner.credentials ? `${practitioner.displayName}, ${practitioner.credentials}` : practitioner.displayName)

function auditFrom(event) {
  const moved = event.from && event.to ? ` from ${formatDate(event.from.date)} ${formatTime(event.from.time)} to ${formatDate(event.to.date)} ${formatTime(event.to.time)}` : ''
  const reason = event.reason ? ` — ${event.reason}` : ''
  return {
    time: `${formatDate(event.date)}, ${formatTime(event.time)}`,
    text: `${ACTION_TEXT[event.action] ?? event.action}${moved}${reason}`,
    by: [event.actor, event.note].filter(Boolean).join(' · '),
  }
}

export function toAppointmentView(appointment) {
  return {
    id: appointment.id,
    reference: appointment.reference,
    patientId: appointment.patient.id,
    patientName: appointment.patient.fullName,
    patientMrn: appointment.patient.mrn,
    date: appointment.date,
    time: appointment.time,
    endTime: appointment.endTime,
    minutes: appointment.durationMinutes,
    type: TYPE_LABELS[appointment.type],
    mode: 'In-Person Clinical Consultation',
    // Visits are booked by type and slot length; fees are set in billing, not at booking.
    service: `${TYPE_LABELS[appointment.type]} · ${appointment.practitioner.department}`,
    serviceNote: appointment.closedReason ?? undefined,
    doctorId: appointment.practitioner.id,
    doctor: doctorName(appointment.practitioner),
    doctorShort: appointment.practitioner.displayName,
    specialty: appointment.practitioner.specialty,
    department: appointment.practitioner.department,
    room: appointment.practitioner.room ?? '—',
    branchId: appointment.branch.id,
    branch: appointment.branch.name,
    campus: appointment.branch.city,
    status: STATUS_LABELS[appointment.status],
    rawStatus: appointment.status,
    reason: appointment.reason,
    note: appointment.internalNote ?? '',
    channel: CHANNEL_LABELS[appointment.channel],
    walkIn: appointment.channel === 'walk_in',
    waitingQueue: appointment.waitingQueue,
    bookedBy: appointment.bookedBy,
    queueToken: appointment.queueToken ?? undefined,
    arrivedAt: appointment.arrivedAt ?? undefined,
    audit: (appointment.events ?? []).map(auditFrom),
    version: appointment.version,
  }
}

// Booking-side tariff: appointments carry no price until the billing module prices the visit.
export const TARIFF_NOTE = 'Priced in billing'
