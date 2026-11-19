import type { Gender, LeadSource, LeadStage, WorkflowTrigger } from '../../generated/prisma/client'

// ─── Audiences ───────────────────────────────────────────────────────────────

export interface AudienceRules {
  include: 'leads' | 'patients' | 'both'
  leadStages: LeadStage[]
  leadSources: LeadSource[]
  // Matches leads whose recorded interest contains this text.
  leadInterest: string | null
  leadCreatedWithinDays: number | null
  // A completed visit in the last N days.
  patientVisitedWithinDays: number | null
  // At least one completed visit, and none in the last N days.
  patientNotVisitedForDays: number | null
  patientMinAge: number | null
  patientMaxAge: number | null
  patientGender: Gender | null
}

// Someone an audience reaches: a lead, or a patient.
export interface Member {
  kind: 'lead' | 'patient'
  id: string
  branchId: string | null
  preferredName: string
  mobile: string | null
  email: string | null
  interest: string | null
  notify: { whatsapp: boolean; sms: boolean } | null
}

const STAGE_WORDS: Record<string, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted' }
const SOURCE_WORDS: Record<string, string> = { website: 'website', phone: 'phone', front_desk: 'front desk', walk_in: 'walk-in' }
const GENDER_WORDS: Record<string, string> = { male: 'male', female: 'female', other: 'other' }

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

// The rules in words, for the audience preview and the broadcast confirmation.
export function describeRules(rules: AudienceRules): string[] {
  const lines: string[] = []
  if (rules.include !== 'patients') {
    const parts = [`Leads at ${rules.leadStages.map((stage) => STAGE_WORDS[stage]).join(', ')}`]
    if (rules.leadSources.length) parts.push(`from ${rules.leadSources.map((source) => SOURCE_WORDS[source]).join(' or ')}`)
    if (rules.leadInterest) parts.push(`interested in “${rules.leadInterest}”`)
    if (rules.leadCreatedWithinDays) parts.push(`recorded in the last ${rules.leadCreatedWithinDays} days`)
    lines.push(parts.join(' '))
  }
  if (rules.include !== 'leads') {
    const parts = ['Active patients']
    if (rules.patientVisitedWithinDays) parts.push(`with a completed visit in the last ${rules.patientVisitedWithinDays} days`)
    if (rules.patientNotVisitedForDays) parts.push(`${rules.patientVisitedWithinDays ? 'and' : 'with'} no visit for ${rules.patientNotVisitedForDays} days`)
    if (rules.patientMinAge !== null || rules.patientMaxAge !== null) parts.push(`aged ${rules.patientMinAge ?? 0}–${rules.patientMaxAge ?? '120'}`)
    if (rules.patientGender) parts.push(`(${GENDER_WORDS[rules.patientGender]})`)
    lines.push(parts.join(' '))
  }
  return lines
}

// "2026-11-19" minus whole years; 29 February becomes 28 February in a common year.
function yearsBefore(date: string, years: number) {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const target = year - years
  const leap = (target % 4 === 0 && target % 100 !== 0) || target % 400 === 0
  const safeDay = month === 2 && day === 29 && !leap ? 28 : day
  return `${target}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

// Dates of birth for an age range on `today`: at least `min` years old, younger than `max + 1`.
export function birthDateWindow(today: string, min: number | null, max: number | null) {
  return {
    ...(min !== null ? { lte: yearsBefore(today, min) } : {}),
    ...(max !== null ? { gt: yearsBefore(today, max + 1) } : {}),
  }
}

// One entry per address on a channel. Patients come first, so a converted lead is reached as the patient.
export function byAddress<T>(members: Member[], address: (member: Member) => string | null, wrap: (member: Member, address: string) => T) {
  const seen = new Map<string, T>()
  let noAddress = 0
  const ordered = [...members].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'patient' ? -1 : 1))
  for (const member of ordered) {
    const value = address(member)
    if (!value) {
      noAddress += 1
      continue
    }
    if (!seen.has(value)) seen.set(value, wrap(member, value))
  }
  return { entries: [...seen.values()], noAddress }
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const CAMPAIGN_CHANNEL_LABELS = { paid_search: 'Paid search', meta_ads: 'Meta Ads', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', phone: 'Phone' } as const
export const CAMPAIGN_STATUS_LABELS = { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', paused: 'Paused', completed: 'Completed' } as const
// Campaigns on these channels can send broadcasts through the connected messaging channel of the same name.
export const BROADCAST_CHANNELS: readonly string[] = ['whatsapp', 'sms', 'email']

export interface AttributedLead {
  stage: LeadStage
  patientId: string | null
  convertedAt: Date | null
  // The clinic-time date of conversion, for comparing with invoice dates.
  convertedOn: string | null
}

// Revenue billed to converted leads' patients on or after the day they converted.
export function attributedRevenue(leads: AttributedLead[], invoices: Array<{ patientId: string; invoiceDate: string; total: number }>) {
  let total = 0
  for (const lead of leads) {
    if (lead.stage !== 'converted' || !lead.patientId || !lead.convertedOn) continue
    for (const invoice of invoices) if (invoice.patientId === lead.patientId && invoice.invoiceDate >= lead.convertedOn) total += invoice.total
  }
  return Math.round(total * 100) / 100
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<WorkflowTrigger, string> = {
  no_show: 'Appointment marked no-show',
  lead_not_booked: 'Lead not yet converted',
  revisit_due: 'Visit completed',
}

// Filled for each event; other variables need a fixed value on the workflow.
export const TRIGGER_VARIABLES: Record<WorkflowTrigger, string[]> = {
  no_show: ['appointment_date', 'appointment_time'],
  lead_not_booked: ['service_name'],
  revisit_due: ['appointment_date', 'appointment_time'],
}

// Filled by ClinicOS for everyone.
export const AUTOMATIC_VARIABLES = ['preferred_name', 'clinic_name']

// Template variables that nothing would fill: neither ClinicOS, the event, nor a fixed value.
export function unfilledVariables(variables: string[], fixed: Record<string, string>, provided: string[] = []) {
  return variables.filter((name) => !AUTOMATIC_VARIABLES.includes(name) && !provided.includes(name) && !fixed[name]?.trim())
}

// The event times a workflow acts on now: due (event + delay) between switching it on and now.
export function eventWindow(activatedAt: Date, delayHours: number, now: Date) {
  const delay = delayHours * 3_600_000
  return { gte: new Date(activatedAt.getTime() - delay), lte: new Date(now.getTime() - delay) }
}

// A unique constraint stopped a second worker recording the same thing.
export const isUniqueViolation = (error: unknown) => typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

export const delayLabel = (hours: number) => (hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`)
