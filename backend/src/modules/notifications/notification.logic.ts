export type AppointmentNotice = 'booked' | 'confirmed' | 'rescheduled' | 'cancelled' | 'checked_in'
export type ChangedBy = 'patient' | 'clinic'

export interface NoticeFacts {
  patientName: string
  doctorName: string
  branchName: string
  // Already written in the clinic's time zone.
  when: string
  token: string | null
}

export interface Message {
  title: string
  body: string
}

// What the patient reads in the app. No visit reason and nothing clinical: a notification may be seen over a shoulder.
export function patientMessage(kind: AppointmentNotice, facts: NoticeFacts): Message {
  const { doctorName, branchName, when, token } = facts
  switch (kind) {
    case 'booked':
      return { title: 'Appointment booked', body: `${when} with ${doctorName} at ${branchName}.` }
    case 'confirmed':
      return { title: 'Appointment confirmed', body: `${when} with ${doctorName} at ${branchName}.` }
    case 'rescheduled':
      return { title: 'Appointment moved', body: `Now ${when} with ${doctorName} at ${branchName}.` }
    case 'cancelled':
      return { title: 'Appointment cancelled', body: `Your appointment on ${when} at ${branchName} was cancelled.` }
    case 'checked_in':
      return { title: 'You are checked in', body: token ? `Your token is ${token} at ${branchName}.` : `You are checked in at ${branchName}.` }
  }
}

// What staff read when a patient changes a booking themselves; null when there is nothing for them to act on.
export function staffMessage(kind: AppointmentNotice, facts: NoticeFacts): Message | null {
  const { patientName, doctorName, branchName, when } = facts
  const detail = `${patientName}, ${when} with ${doctorName} at ${branchName}.`
  switch (kind) {
    case 'booked':
      return { title: 'New booking from the patient app', body: detail }
    case 'rescheduled':
      return { title: 'Patient moved a booking', body: `Now ${detail}` }
    case 'cancelled':
      return { title: 'Patient cancelled a booking', body: detail }
    default:
      return null
  }
}

export type RecordNotice = 'consultation_signed' | 'prescription_issued' | 'prescription_stopped' | 'result_ready' | 'care_plan_started'

// What the patient reads when a record is released. It says where to look, never what the record contains.
export function recordMessage(kind: RecordNotice, place: string): Message {
  switch (kind) {
    case 'consultation_signed':
      return { title: 'Consultation summary ready', body: `Your visit summary from ${place} is ready to read.` }
    case 'prescription_issued':
      return { title: 'New prescription', body: `${place} has issued a prescription for you.` }
    case 'prescription_stopped':
      return { title: 'Prescription stopped', body: `${place} has stopped one of your prescriptions. Open it for details.` }
    case 'result_ready':
      return { title: 'Test result ready', body: `A test result from ${place} has been reviewed by your doctor.` }
    case 'care_plan_started':
      return { title: 'New care plan', body: `${place} has started a care plan for you.` }
  }
}

export function noticeTime(instant: Date, timeZone: string): string {
  // Assembled from parts: the punctuation Node puts between them differs from one version to the next.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(instant).map((part) => [part.type, part.value]),
  )
  const day = `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`
  const clock = new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(instant)
  return `${day} at ${clock}`
}
