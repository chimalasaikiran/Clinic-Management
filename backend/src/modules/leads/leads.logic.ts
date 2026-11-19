import type { LeadStage } from '../../generated/prisma/client'
import { addDays, localDate, zonedInstant } from '../scheduling/clinic-time'

export type DueState = 'overdue' | 'due_today' | 'upcoming' | 'none'

export const STAGE_LABELS: Record<LeadStage, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', closed: 'Closed' }
export const SOURCE_LABELS = { website: 'Website inquiry', phone: 'Phone inquiry', front_desk: 'Front desk referral', walk_in: 'Walk-in' } as const
export const INTERACTION_LABELS = { phone_call: 'Phone call', whatsapp: 'WhatsApp message', sms: 'SMS', email: 'Email', in_person: 'In person' } as const
export const OUTCOME_LABELS = { connected: 'Connected', no_answer: 'No answer', interested: 'Interested', not_interested: 'Not interested' } as const
export const DISPOSITION_LABELS = { defer: 'Defer', unresponsive: 'Unresponsive', not_interested: 'Not interested' } as const

// Whether the open follow-up is late, due later today (clinic time) or further out.
export function dueState(nextDueAt: Date | null, now: Date, zone: string): DueState {
  if (!nextDueAt) return 'none'
  if (nextDueAt < now) return 'overdue'
  return localDate(nextDueAt, zone) === localDate(now, zone) ? 'due_today' : 'upcoming'
}

// The instants bounding each due state, for filtering in the database.
export function dueWindows(now: Date, zone: string) {
  const tomorrow = zonedInstant(addDays(localDate(now, zone), 1), 0, zone)
  return { now, endOfToday: tomorrow }
}

// "2026-11-19" + "14:30" in the clinic's zone.
export function clinicInstant(date: string, time: string, zone: string): Date {
  const [hour, minute] = time.split(':').map(Number) as [number, number]
  return zonedInstant(date, hour * 60 + minute, zone)
}

// The created-date cohort [from, to] (inclusive local dates) as instants.
export function cohortWindow(from: string, to: string, zone: string) {
  return { gte: zonedInstant(from, 0, zone), lt: zonedInstant(addDays(to, 1), 0, zone) }
}

interface Comparable {
  [key: string]: string | null
}

// "Owner: Meera Shah → Priya Nair; Email: — → a@b.in" for the fields that differ.
export function describeChanges(before: Comparable, after: Comparable, labels: Record<string, string>) {
  const changed = Object.keys(labels).filter((key) => (before[key] ?? null) !== (after[key] ?? null))
  return {
    changed,
    text: changed.map((key) => `${labels[key]}: ${before[key] || '—'} → ${after[key] || '—'}`).join('; '),
  }
}

export interface FunnelLead {
  stage: LeadStage
  patientId: string | null
  convertedAt: Date | null
}

export interface FunnelAppointment {
  patientId: string
  startsAt: Date
  status: string
}

// How far each converted lead got: an appointment booked on or after conversion, and a completed visit.
export function funnel(leads: FunnelLead[], appointments: FunnelAppointment[]) {
  let booked = 0
  let consulted = 0
  for (const lead of leads) {
    if (lead.stage !== 'converted' || !lead.patientId || !lead.convertedAt) continue
    const after = appointments.filter((entry) => entry.patientId === lead.patientId && entry.startsAt >= lead.convertedAt! && entry.status !== 'cancelled')
    if (after.length) booked += 1
    if (after.some((entry) => entry.status === 'completed')) consulted += 1
  }
  return { converted: leads.filter((lead) => lead.stage === 'converted').length, booked, consulted }
}
