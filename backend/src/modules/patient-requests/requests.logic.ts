import type { SupportStatus } from '../../generated/prisma/client'

export interface Message {
  title: string
  body: string
}

// Patients read where the request went and what happened, nothing clinical. Staff messages name the patient,
// as booking notices do.

export const refillMessages = {
  requested: (patient: string, reference: string): Message => ({ title: 'New refill request', body: `${patient} asked for a refill of prescription ${reference}.` }),
  approved: (place: string, reference: string): Message => ({ title: 'Refill approved', body: `${place} approved your refill of ${reference}. Collect it at the clinic pharmacy.` }),
  declined: (place: string, reference: string): Message => ({ title: 'Refill request declined', body: `${place} could not approve your refill of ${reference}. Open it to see why.` }),
}

export const supportMessages = {
  opened: (patient: string, reference: string, subject: string): Message => ({ title: 'New help request', body: `${patient} (${reference}): ${subject}` }),
  patientReplied: (patient: string, reference: string): Message => ({ title: 'Patient replied to a help request', body: `${patient} replied on ${reference}.` }),
  answered: (place: string, reference: string): Message => ({ title: 'Reply to your help request', body: `${place} replied to ${reference}.` }),
  resolved: (place: string, reference: string): Message => ({ title: 'Help request resolved', body: `${place} marked ${reference} as resolved.` }),
}

// A patient's message reopens the request; a staff reply answers it, or resolves it when they say so.
export function statusAfterMessage(by: 'patient' | 'staff', resolve = false): SupportStatus {
  if (by === 'patient') return 'open'
  return resolve ? 'resolved' : 'answered'
}
