import { digitsOf } from '../patients/format'

// Lead times are entered and shown in clinic time (IST), whatever the device's own zone.
export const CLINIC_ZONE = 'Asia/Kolkata'

export const LIVE_NOTE = 'Live lead records · Changes are saved and added to the activity history'

const invert = (map) => Object.fromEntries(Object.entries(map).map(([id, label]) => [label, id]))

export const STAGES = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', closed: 'Closed' }
export const SOURCES = { website: 'Website inquiry', phone: 'Phone inquiry', front_desk: 'Front desk referral', walk_in: 'Walk-in' }
export const INTERACTIONS = { phone_call: 'Phone call', whatsapp: 'WhatsApp message', sms: 'SMS', email: 'Email', in_person: 'In person' }
export const OUTCOMES = { connected: 'Connected', no_answer: 'No answer', interested: 'Interested', not_interested: 'Not interested' }
export const DISPOSITIONS = { defer: 'Defer', unresponsive: 'Unresponsive', not_interested: 'Not interested' }
const DUE = { overdue: 'Overdue', due_today: 'Due today', upcoming: 'Upcoming', none: 'None' }

export const stageId = (label) => invert(STAGES)[label] ?? ''
export const sourceId = (label) => invert(SOURCES)[label] ?? ''
export const dueId = (label) => invert(DUE)[label] ?? ''
export const interactionId = (label) => invert(INTERACTIONS)[label]
export const outcomeId = (label) => invert(OUTCOMES)[label]
export const dispositionId = (label) => invert(DISPOSITIONS)[label]

const clock = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// An instant as the { date, time } the Growth screens print, in clinic time.
export function stampOf(iso) {
  if (!iso) return null
  const part = Object.fromEntries(clock.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]))
  return { date: `${part.year}-${part.month}-${part.day}`, time: `${part.hour}:${part.minute}` }
}

export const clinicNow = (now = new Date()) => stampOf(now.toISOString())

// "9848022110" -> "98480 22110"
export const displayMobile = (mobile) => (mobile?.length === 10 ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : mobile ?? '')

// The API's lead in the shape the Growth screens were built around.
export function toLeadView(lead) {
  return {
    id: lead.id,
    number: lead.number,
    name: lead.fullName,
    phone: displayMobile(lead.mobile),
    mobile: lead.mobile,
    email: lead.email ?? '',
    interest: lead.interest ?? '',
    summary: lead.interest || 'General enquiry',
    source: SOURCES[lead.source],
    stage: STAGES[lead.stage],
    ownerId: lead.owner.membershipId,
    owner: lead.owner.name,
    branchId: lead.branch.id,
    branch: lead.branch.name,
    created: stampOf(lead.createdAt),
    lastActivity: stampOf(lead.lastActivityAt),
    nextAction: lead.nextAction ?? '',
    due: stampOf(lead.nextDueAt),
    dueState: DUE[lead.dueState],
    patient: lead.patient ? { id: lead.patient.id, mrn: lead.patient.mrn, name: lead.patient.fullName } : null,
    campaign: lead.campaign ?? null,
    patientId: lead.patient?.id ?? null,
    convertedAt: stampOf(lead.convertedAt),
    journey: lead.journey ?? null,
    activities: (lead.activities ?? []).map((entry) => ({ id: entry.id, at: stampOf(entry.occurredAt), title: entry.title, text: entry.text, actor: entry.actor })),
    version: lead.version,
  }
}

// Register filters (kept in the address as the labels people see) as API query parameters.
export function listQuery(filters, branchId) {
  return {
    q: filters.q || undefined,
    stage: stageId(filters.stage) || undefined,
    source: sourceId(filters.source) || undefined,
    ownerId: filters.owner || undefined,
    due: dueId(filters.due) || undefined,
    sort: filters.sort || undefined,
    branchId: branchId || undefined,
  }
}

// Counts for the register's summary cards and the Growth home pipeline.
export function leadSummary(meta) {
  const byStage = meta?.summary?.byStage ?? {}
  return {
    new: byStage.new ?? 0,
    qualified: byStage.qualified ?? 0,
    converted: byStage.converted ?? 0,
    overdue: meta?.summary?.overdue ?? 0,
    followUpsDue: meta?.summary?.followUpsDue ?? 0,
    pipeline: Object.fromEntries(Object.entries(STAGES).map(([id, label]) => [label, byStage[id] ?? 0])),
  }
}

// Form values to the create / update body.
export function leadPayload(values) {
  return {
    fullName: values.name.trim(),
    mobile: digitsOf(values.phone),
    email: values.email.trim(),
    interest: values.interest.trim(),
    branchId: values.branchId,
    ownerMembershipId: values.ownerId,
    confirmedNotDuplicate: values.reviewed,
    campaignId: values.campaignId || null,
  }
}

// Owners who can work leads at `branchId`, as select options.
export const ownerOptions = (owners, branchId) => (owners ?? [])
  .filter((owner) => owner.branches === 'all' || owner.branches.includes(branchId))
  .map((owner) => ({ value: owner.membershipId, label: owner.name }))

export function validateLead(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter the lead’s full name.'
  if (!/^[6-9]\d{9}$/.test(digitsOf(values.phone).replace(/^(?:91|0)(?=\d{10}$)/, ''))) errors.phone = 'Enter a valid 10-digit mobile number.'
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Enter a valid email address or leave it empty.'
  if (!values.branchId) errors.branch = 'Choose a branch.'
  if (!values.ownerId) errors.owner = 'Choose an owner.'
  if (values.nextDate && !values.nextAction?.trim()) errors.nextAction = 'Describe the next action for this follow-up.'
  return errors
}

export function validateInteraction(values) {
  const errors = {}
  if (!values.outcome) errors.outcome = 'Choose one outcome.'
  if (!values.notes.trim()) errors.notes = 'Add notes for this interaction.'
  if (!values.owner) errors.owner = 'Choose the activity owner.'
  if (values.decision === 'reschedule') {
    if (!values.nextAction.trim()) errors.nextAction = 'Describe the next action.'
    if (!values.nextDate) errors.nextDate = 'Choose the next follow-up date.'
    if (!values.reason.trim()) errors.reason = 'Give a reschedule reason.'
  }
  return errors
}
