import { ApiError } from '../../lib/api'
import { API_BRANCHES } from './patientsApi'

// An in-memory stand-in for /v1/leads, enough for the Growth screens: it keeps leads and their activity, applies
// the register filters and refuses stale versions. `calls` records each request. The real rules (owners, branch
// scope, due states in clinic time, conversion in one transaction) are tested in backend/test/integration/leads.test.ts.

const clone = (value) => structuredClone(value)
const HOUR = 3_600_000

export const LEAD_OWNERS = [
  { membershipId: 'm-1', name: 'Meera Shah', branches: 'all' },
  { membershipId: 'm-2', name: 'Priya Nair', branches: ['b-main'] },
]

const branchOf = (id) => {
  const branch = API_BRANCHES.find((entry) => entry.id === id)
  return { id: branch.id, name: branch.name }
}
const ownerOf = (id) => ({ membershipId: id, name: LEAD_OWNERS.find((owner) => owner.membershipId === id)?.name ?? 'Former member' })

function dueStateOf(lead, now = new Date()) {
  if (!lead.nextDueAt) return 'none'
  const due = new Date(lead.nextDueAt)
  if (due < now) return 'overdue'
  const day = (instant) => instant.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  return day(due) === day(now) ? 'due_today' : 'upcoming'
}

export const apiLead = (overrides = {}) => ({
  id: 'l-1',
  number: 'LD-000001',
  fullName: 'Nisha Menon',
  mobile: '9848022110',
  email: null,
  interest: 'Knee pain',
  source: 'phone',
  stage: 'new',
  nextAction: null,
  nextDueAt: null,
  convertedAt: null,
  lastActivityAt: '2026-11-18T05:00:00.000Z',
  createdAt: '2026-11-18T05:00:00.000Z',
  version: 1,
  branch: branchOf('b-main'),
  owner: ownerOf('m-1'),
  patient: null,
  campaign: null,
  dueState: 'none',
  activities: [{ id: 'act-1', kind: 'created', title: 'Phone inquiry recorded', text: 'New enquiry about Knee pain.', details: null, occurredAt: '2026-11-18T05:00:00.000Z', actor: 'Meera Shah', owner: null }],
  journey: null,
  ...overrides,
})

// A lead whose follow-up was due an hour ago.
export const overdueLead = (overrides = {}) => apiLead({ nextAction: 'Call back about slots', nextDueAt: new Date(Date.now() - HOUR).toISOString(), stage: 'qualified', ...overrides })

export function createLeadsApi({ leads = [overdueLead()], owners = LEAD_OWNERS, patients = [] } = {}) {
  const state = { leads: clone(leads), calls: [] }
  const record = (name, ...args) => state.calls.push([name, ...args])
  const view = (lead) => clone({ ...lead, dueState: dueStateOf(lead) })
  const find = (id) => {
    const lead = state.leads.find((entry) => entry.id === id)
    if (!lead) throw new ApiError(404, 'NOT_FOUND', 'Lead not found.')
    return lead
  }
  const fresh = (lead, version) => {
    if (version !== lead.version) throw new ApiError(409, 'LEAD_CHANGED', 'Someone else changed this lead while you were working on it.')
  }
  const log = (lead, kind, title, text, at = new Date().toISOString()) => {
    lead.activities.unshift({ id: `act-${lead.activities.length + 1}`, kind, title, text, details: null, occurredAt: at, actor: 'Meera Shah', owner: null })
    lead.version += 1
    lead.lastActivityAt = new Date().toISOString()
  }
  const dueAt = (date, time) => new Date(`${date}T${time}:00+05:30`).toISOString()

  const api = {
    async list(query = {}) {
      record('list', query)
      const inScope = state.leads.filter((lead) => !query.branchId || lead.branch.id === query.branchId)
      const needle = (query.q ?? '').toLowerCase()
      const rows = inScope.filter((lead) =>
        (!needle || `${lead.fullName} ${lead.number} ${lead.mobile} ${lead.interest ?? ''}`.toLowerCase().includes(needle)) &&
        (!query.stage || lead.stage === query.stage) &&
        (!query.source || lead.source === query.source) &&
        (!query.ownerId || lead.owner.membershipId === query.ownerId) &&
        (!query.due || (query.due === 'open' ? Boolean(lead.nextDueAt) : dueStateOf(lead) === query.due)))
      const byStage = Object.fromEntries(['new', 'contacted', 'qualified', 'converted', 'closed'].map((stage) => [stage, inScope.filter((lead) => lead.stage === stage).length]))
      const overdue = inScope.filter((lead) => dueStateOf(lead) === 'overdue').length
      const dueToday = inScope.filter((lead) => dueStateOf(lead) === 'due_today').length
      const page = query.page ?? 1
      const pageSize = query.pageSize ?? 25
      return {
        // List rows carry no activity history or journey, like the real list.
        data: rows.slice((page - 1) * pageSize, page * pageSize).map((lead) => ({ ...view(lead), activities: undefined, journey: undefined })),
        meta: { page, pageSize, total: rows.length, summary: { byStage, overdue, dueToday, followUpsDue: overdue + dueToday } },
      }
    },
    async get(id) {
      record('get', id)
      return view(find(id))
    },
    async owners(branchId) {
      return clone(owners.filter((owner) => !branchId || owner.branches === 'all' || owner.branches.includes(branchId)))
    },
    async duplicates(mobile, excludeId) {
      return state.leads.filter((lead) => lead.mobile === mobile && lead.id !== excludeId).map(view)
    },
    async performance(query) {
      record('performance', query)
      const rows = state.leads.filter((lead) => (!query.branchId || lead.branch.id === query.branchId) && (!query.source || lead.source === query.source))
      const count = (test) => rows.filter(test).length
      return {
        from: query.from, to: query.to, branchId: query.branchId ?? null, total: rows.length,
        bySource: Object.fromEntries(['website', 'phone', 'front_desk', 'walk_in'].map((source) => [source, count((lead) => lead.source === source)])),
        byStage: Object.fromEntries(['new', 'contacted', 'qualified', 'converted', 'closed'].map((stage) => [stage, count((lead) => lead.stage === stage)])),
        converted: count((lead) => lead.stage === 'converted'), booked: count((lead) => Boolean(lead.journey?.appointment)), consulted: count((lead) => Boolean(lead.journey?.consultation)),
        byCampaign: [...new Map(rows.filter((lead) => lead.campaign).map((lead) => [lead.campaign.id, lead.campaign])).values()].map((campaign) => {
          const tagged = rows.filter((lead) => lead.campaign?.id === campaign.id)
          return { ...campaign, total: tagged.length, converted: tagged.filter((lead) => lead.stage === 'converted').length, booked: 0, consulted: 0 }
        }),
        untagged: count((lead) => !lead.campaign),
      }
    },
    async create(body) {
      record('create', body)
      if (!body.confirmedNotDuplicate && state.leads.some((lead) => lead.mobile === body.mobile)) {
        throw new ApiError(409, 'POSSIBLE_DUPLICATE', 'Another lead already uses this mobile number.', [{ field: 'mobile', issue: 'existing lead' }])
      }
      const number = state.leads.length + 1
      const now = new Date().toISOString()
      const lead = apiLead({
        id: `l-${number}`, number: `LD-${String(number).padStart(6, '0')}`, fullName: body.fullName, mobile: body.mobile, email: body.email || null, interest: body.interest || null, source: body.source, stage: body.stage,
        branch: branchOf(body.branchId), owner: ownerOf(body.ownerMembershipId), nextAction: body.nextDueDate ? body.nextAction : null, nextDueAt: body.nextDueDate ? dueAt(body.nextDueDate, body.nextDueTime ?? '10:00') : null,
        campaign: body.campaignId ? { id: body.campaignId, code: 'CMP-0001', name: 'Knee care camp' } : null,
        createdAt: now, lastActivityAt: now, activities: [{ id: 'act-1', kind: 'created', title: 'Recorded', text: 'New enquiry.', details: null, occurredAt: now, actor: 'Meera Shah', owner: null }],
      })
      state.leads.push(lead)
      return view(lead)
    },
    async update(id, body) {
      record('update', id, body)
      const lead = find(id)
      fresh(lead, body.version)
      const changes = []
      if (body.stage !== lead.stage) changes.push(`Stage: ${lead.stage} → ${body.stage}`)
      if (body.ownerMembershipId !== lead.owner.membershipId) changes.push(`Owner: ${lead.owner.name} → ${ownerOf(body.ownerMembershipId).name}`)
      Object.assign(lead, { fullName: body.fullName, mobile: body.mobile, email: body.email || null, interest: body.interest || null, stage: body.stage, branch: branchOf(body.branchId), owner: ownerOf(body.ownerMembershipId) })
      if (body.stage === 'closed') Object.assign(lead, { nextDueAt: null, nextAction: null })
      log(lead, 'updated', changes.length ? 'Lead updated' : 'Lead saved', changes.join('; ') || 'Saved without changes.')
      return view(lead)
    },
    async recordInteraction(id, body) {
      record('recordInteraction', id, body)
      const lead = find(id)
      fresh(lead, body.version)
      if (body.decision === 'complete') Object.assign(lead, { nextDueAt: null, nextAction: null })
      if (body.decision === 'reschedule') Object.assign(lead, { nextDueAt: dueAt(body.nextDueDate, body.nextDueTime), nextAction: body.nextAction, owner: ownerOf(body.ownerMembershipId) })
      const labels = { phone_call: 'Phone call', whatsapp: 'WhatsApp message', sms: 'SMS', email: 'Email', in_person: 'In person' }
      const outcomes = { connected: 'Connected', no_answer: 'No answer', interested: 'Interested', not_interested: 'Not interested' }
      log(lead, 'interaction', `${labels[body.type]} · ${outcomes[body.outcome]}`, body.notes, dueAt(body.occurredDate, body.occurredTime))
      return view(lead)
    },
    async setDisposition(id, body) {
      record('setDisposition', id, body)
      const lead = find(id)
      fresh(lead, body.version)
      if (body.disposition === 'defer') Object.assign(lead, { nextDueAt: dueAt(body.nextDueDate, body.nextDueTime), nextAction: body.nextAction, owner: ownerOf(body.ownerMembershipId) })
      else Object.assign(lead, { stage: 'closed', nextDueAt: null, nextAction: null })
      log(lead, 'disposition', `Re-engagement · ${body.disposition}`, body.nextAction)
      return view(lead)
    },
    async convert(id, body) {
      record('convert', id, body)
      const lead = find(id)
      fresh(lead, body.version)
      const patient = patients.find((entry) => entry.id === body.patientId)
      Object.assign(lead, { stage: 'converted', patient: { id: patient.id, mrn: patient.mrn, fullName: patient.fullName }, convertedAt: new Date().toISOString(), nextDueAt: null, nextAction: null, journey: { appointment: null, consultation: null } })
      log(lead, 'converted', 'Lead converted', `Linked to patient ${patient.fullName} (${patient.mrn}).`)
      return view(lead)
    },
    async convertToNewPatient(id, body) {
      record('convertToNewPatient', id, body)
      const lead = find(id)
      fresh(lead, body.leadVersion)
      const patient = { id: `p-new-${id}`, mrn: 'PT-000099', fullName: body.fullName }
      Object.assign(lead, { stage: 'converted', patient, convertedAt: new Date().toISOString(), nextDueAt: null, nextAction: null, journey: { appointment: null, consultation: null } })
      log(lead, 'converted', 'Lead converted', `Registered as new patient ${patient.fullName} (${patient.mrn}) and linked.`)
      return view(lead)
    },
  }
  return { api, state }
}
