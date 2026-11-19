import { ApiError } from '../../lib/api'

// An in-memory stand-in for the audience, campaign and workflow endpoints, enough for the Growth screens. `state.calls`
// records each request. Counting, consent, broadcasts and the workflow worker are tested in
// backend/test/integration/campaigns.test.ts.

const clone = (value) => structuredClone(value)
const NOW = () => new Date().toISOString()
const OWNERS = [{ membershipId: 'm-1', name: 'Meera Shah' }, { membershipId: 'm-2', name: 'Priya Nair' }]
const BRANCH = { id: 'b-main', name: 'Main Clinic' }
const reach = (reachable, optedOut = 0) => ({ addresses: reachable + optedOut, reachable, optedOut, noConsent: 0, noAddress: 0 })

export const apiAudience = (overrides = {}) => ({
  id: 'a-1', code: 'AU-0001', name: 'Knee enquiries', purpose: 'Knee camp invitations', status: 'ready', version: 1,
  rules: { include: 'leads', leadStages: ['new', 'contacted'], leadSources: [], leadInterest: 'knee', leadCreatedWithinDays: null, patientVisitedWithinDays: null, patientNotVisitedForDays: null, patientMinAge: null, patientMaxAge: null, patientGender: null },
  description: ['Leads at New, Contacted interested in “knee”'], branch: BRANCH, createdAt: '2026-11-18T05:00:00.000Z', updatedAt: '2026-11-18T05:00:00.000Z', createdBy: 'Meera Shah', updatedBy: 'Meera Shah',
  campaigns: [{ id: 'cmp-1', code: 'CMP-0001', name: 'Knee care camp' }],
  ...overrides,
})

export const apiCampaign = (overrides = {}) => ({
  id: 'cmp-1', code: 'CMP-0001', name: 'Knee care camp', objective: 'Knee pain enquiries', channel: 'whatsapp', status: 'active', budget: 45000, startDate: '2026-11-01', endDate: '2026-11-30',
  cta: 'Book a screening', landingUrl: 'https://aura.example/knee', version: 1, createdAt: '2026-11-01T05:00:00.000Z', updatedAt: '2026-11-01T05:00:00.000Z',
  branch: BRANCH, owner: OWNERS[0], audience: { id: 'a-1', code: 'AU-0001', name: 'Knee enquiries', status: 'ready' }, leadCount: 2, spent: 12000, converted: 1,
  spendEntries: [{ id: 's-1', spentOn: '2026-11-10', amount: 12000, note: 'Meta invoice 1182', createdAt: '2026-11-10T05:00:00.000Z', recordedBy: 'Meera Shah' }],
  events: [{ id: 'e-1', kind: 'created', text: 'Campaign created as Active with a budget of ₹45,000.', createdAt: '2026-11-01T05:00:00.000Z', actor: 'Meera Shah' }],
  broadcasts: [],
  attribution: { leads: 2, converted: 1, booked: 1, consulted: 0, revenue: 0, recent: [{ id: 'l-1', number: 'LD-000001', fullName: 'Nisha Menon', stage: 'converted', source: 'phone', createdAt: '2026-11-12T05:00:00.000Z', convertedAt: '2026-11-13T05:00:00.000Z' }] },
  ...overrides,
})

export const apiWorkflow = (overrides = {}) => ({
  id: 'wf-1', code: 'WF-0001', name: 'No-show recovery', trigger: 'no_show', triggerLabel: 'Appointment marked no-show', delayHours: 4, delayLabel: '4 hours', eventVariables: ['appointment_date', 'appointment_time'],
  variables: {}, weeklyCap: 2, status: 'draft', activatedAt: null, activatedBy: null, version: 1, changeNote: 'Workflow created.', createdAt: '2026-11-18T05:00:00.000Z', updatedAt: '2026-11-18T05:00:00.000Z',
  branch: BRANCH, owner: OWNERS[0], updatedBy: 'Meera Shah',
  template: { id: 't-1', code: 'MT-0001', name: 'Follow-up check-in', category: 'Follow-up', channel: 'whatsapp', subject: null, body: 'Hello {{preferred_name}}, are you still looking for help with {{service_name}}?', status: 'approved', providerRef: 'follow_up_v1', version: 2 },
  problems: [], lastWeek: { queued: 0, skipped: 0 },
  ...overrides,
})

export const apiRun = (overrides = {}) => ({
  id: 'run-1', subjectKey: 'appointment:apt-1', dueAt: '2026-11-19T05:00:00.000Z', outcome: 'skipped', skipReason: 'CONSENT_REQUIRED', skipLabel: 'No recorded permission', workflowVersion: 2, createdAt: '2026-11-19T05:01:00.000Z',
  workflow: { id: 'wf-1', code: 'WF-0001', name: 'No-show recovery', trigger: 'no_show' }, lead: null, patient: { id: 'p-1', mrn: 'PT-000001', fullName: 'Ananya Sharma' }, appointment: { id: 'apt-1', reference: 'APT-000004', startsAt: '2026-11-18T05:00:00.000Z' }, message: null,
  ...overrides,
})

export function createCampaignsApi({ audiences = [apiAudience()], campaigns = [apiCampaign()], workflows = [apiWorkflow()], runs = [] } = {}) {
  const state = { audiences: clone(audiences), campaigns: clone(campaigns), workflows: clone(workflows), runs: clone(runs), calls: [] }
  const record = (name, ...args) => state.calls.push([name, ...args])
  const find = (list, id, label) => {
    const entry = state[list].find((item) => item.id === id)
    if (!entry) throw new ApiError(404, 'NOT_FOUND', `${label} not found.`)
    return entry
  }
  const fresh = (entry, version, code) => {
    if (version !== entry.version) throw new ApiError(409, code, 'Someone else changed this. Reload it and try again.')
  }
  const event = (campaign, text) => campaign.events.unshift({ id: `e-${campaign.events.length + 1}`, kind: 'updated', text, createdAt: NOW(), actor: 'Meera Shah' })

  const api = {
    async audiences(query = {}) {
      record('audiences', query)
      const rows = state.audiences.filter((entry) => (query.status ? entry.status === query.status : entry.status !== 'archived') && (!query.q || entry.name.toLowerCase().includes(query.q.toLowerCase())))
      return { data: clone(rows), meta: { page: 1, pageSize: 100, total: rows.length } }
    },
    async audience(id) {
      const audience = find('audiences', id, 'Audience')
      return clone({ ...audience, versions: [{ version: audience.version, changeNote: 'Audience created.', createdAt: audience.createdAt, actor: 'Meera Shah', description: audience.description }] })
    },
    async countAudience(body) {
      record('countAudience', body)
      return { leads: 3, patients: body.rules.include === 'leads' ? 0 : 1, channels: { whatsapp: reach(2, 1), sms: reach(1), email: reach(0) }, description: ['Leads at New'] }
    },
    async createAudience(body) {
      record('createAudience', body)
      const audience = apiAudience({ ...body, id: `a-${state.audiences.length + 1}`, code: `AU-${String(state.audiences.length + 1).padStart(4, '0')}`, branch: body.branchId ? BRANCH : null, campaigns: [] })
      state.audiences.push(audience)
      return api.audience(audience.id)
    },
    async updateAudience(id, body) {
      record('updateAudience', id, body)
      const audience = find('audiences', id, 'Audience')
      fresh(audience, body.version, 'AUDIENCE_CHANGED')
      Object.assign(audience, { name: body.name, purpose: body.purpose, status: body.status, rules: body.rules, version: audience.version + 1 })
      return api.audience(id)
    },

    async campaigns(query = {}) {
      record('campaigns', query)
      const rows = state.campaigns.filter((entry) => (!query.status || entry.status === query.status) && (!query.channel || entry.channel === query.channel) && (!query.q || entry.name.toLowerCase().includes(query.q.toLowerCase())))
      return { data: clone(rows.slice(0, query.pageSize ?? 100)), meta: { page: 1, pageSize: query.pageSize ?? 100, total: rows.length } }
    },
    async campaign(id) {
      return clone(find('campaigns', id, 'Campaign'))
    },
    async campaignOptions() {
      return clone(state.campaigns.filter((entry) => entry.status !== 'completed').map(({ id, code, name, status, channel }) => ({ id, code, name, status, channel })))
    },
    async owners() {
      return clone(OWNERS)
    },
    async createCampaign(body) {
      record('createCampaign', body)
      const campaign = apiCampaign({ ...body, id: `cmp-${state.campaigns.length + 1}`, code: `CMP-${String(state.campaigns.length + 1).padStart(4, '0')}`, audience: null, leadCount: 0, spent: 0, converted: 0, spendEntries: [], broadcasts: [], attribution: { leads: 0, converted: 0, booked: 0, consulted: 0, revenue: 0, recent: [] } })
      state.campaigns.push(campaign)
      return clone(campaign)
    },
    async updateCampaign(id, body) {
      record('updateCampaign', id, body)
      const campaign = find('campaigns', id, 'Campaign')
      fresh(campaign, body.version, 'CAMPAIGN_CHANGED')
      if ((body.budget !== campaign.budget || body.status !== campaign.status) && !body.changeNote) throw new ApiError(422, 'CHANGE_NOTE_REQUIRED', 'Give a reason for changing the budget or status.')
      if (body.budget !== campaign.budget) event(campaign, `Budget: ₹${campaign.budget.toLocaleString('en-IN')} → ₹${body.budget.toLocaleString('en-IN')}. Reason: ${body.changeNote}`)
      const { changeNote: _note, version: _version, ...fields } = body
      Object.assign(campaign, fields, { version: campaign.version + 1 })
      return clone(campaign)
    },
    async addSpend(id, body) {
      record('addSpend', id, body)
      const campaign = find('campaigns', id, 'Campaign')
      campaign.spendEntries.unshift({ id: `s-${campaign.spendEntries.length + 1}`, ...body, createdAt: NOW(), recordedBy: 'Meera Shah' })
      campaign.spent += body.amount
      return clone(campaign)
    },
    async previewBroadcast(id, body) {
      record('previewBroadcast', id, body)
      const campaign = find('campaigns', id, 'Campaign')
      return {
        campaign: { id, code: campaign.code, name: campaign.name }, audience: { id: 'a-1', code: 'AU-0001', name: 'Knee enquiries', version: 1, description: ['Leads at New'] }, template: { id: body.templateId, code: 'MT-0001', name: 'Follow-up check-in', version: 2, channel: 'whatsapp' },
        members: 3, addresses: 3, noAddress: 0, reachable: 2, skipped: [{ reason: 'CONSENT_WITHDRAWN', label: 'Opted out on this channel', count: 1 }], missingVariables: [],
        sample: `Hello Nisha, are you still looking for help with ${body.variables.service_name ?? '{{service_name}}'}?`, channelConnected: true, quietHoursNow: false,
      }
    },
    async launchBroadcast(id, body) {
      record('launchBroadcast', id, body)
      const campaign = find('campaigns', id, 'Campaign')
      const broadcast = {
        id: `bc-${campaign.broadcasts.length + 1}`, channel: 'whatsapp', status: 'scheduled', scheduledAt: NOW(), startedAt: null, completedAt: null, expectedRecipients: body.expectedRecipients, queuedCount: 0, skippedCount: 0, weeklyCap: 2, createdAt: NOW(), templateVersion: 2, audienceVersion: 1,
        template: { id: body.templateId, code: 'MT-0001', name: 'Follow-up check-in' }, audience: { id: 'a-1', code: 'AU-0001', name: 'Knee enquiries' }, createdBy: 'Meera Shah', messages: {}, skipped: [],
      }
      campaign.broadcasts.unshift(broadcast)
      return clone(broadcast)
    },
    async cancelBroadcast(id, broadcastId) {
      record('cancelBroadcast', id, broadcastId)
      const broadcast = find('campaigns', id, 'Campaign').broadcasts.find((entry) => entry.id === broadcastId)
      broadcast.status = 'cancelled'
      return clone(broadcast)
    },

    async workflows() {
      return clone(state.workflows)
    },
    async workflow(id) {
      return clone(find('workflows', id, 'Workflow'))
    },
    async createWorkflow(body) {
      record('createWorkflow', body)
      const workflow = apiWorkflow({ ...body, id: `wf-${state.workflows.length + 1}`, code: `WF-${String(state.workflows.length + 1).padStart(4, '0')}`, template: null, problems: ['Choose a message template.'] })
      state.workflows.push(workflow)
      return clone(workflow)
    },
    async updateWorkflow(id, body) {
      record('updateWorkflow', id, body)
      const workflow = find('workflows', id, 'Workflow')
      fresh(workflow, body.version, 'WORKFLOW_CHANGED')
      if (workflow.status === 'active') throw new ApiError(409, 'WORKFLOW_ACTIVE', 'Pause this workflow before changing it.')
      Object.assign(workflow, { name: body.name, delayHours: body.delayHours, weeklyCap: body.weeklyCap, variables: body.variables, version: workflow.version + 1 })
      return clone(workflow)
    },
    async activateWorkflow(id, version) {
      record('activateWorkflow', id, version)
      const workflow = find('workflows', id, 'Workflow')
      fresh(workflow, version, 'WORKFLOW_CHANGED')
      if (workflow.problems.length) throw new ApiError(422, 'WORKFLOW_NOT_READY', workflow.problems.join(' '))
      Object.assign(workflow, { status: 'active', activatedAt: NOW(), activatedBy: 'Meera Shah', version: workflow.version + 1 })
      return clone(workflow)
    },
    async pauseWorkflow(id, version) {
      record('pauseWorkflow', id, version)
      const workflow = find('workflows', id, 'Workflow')
      fresh(workflow, version, 'WORKFLOW_CHANGED')
      Object.assign(workflow, { status: 'paused', version: workflow.version + 1 })
      return clone(workflow)
    },
    async runs(query = {}) {
      record('runs', query)
      const rows = state.runs.filter((run) => (!query.workflowId || run.workflow.id === query.workflowId) && (!query.outcome || run.outcome === query.outcome) && (!query.problem || run.outcome === 'skipped' || ['failed', 'unknown'].includes(run.message?.status)))
      return { data: clone(rows.slice(0, query.pageSize ?? 100)), meta: { page: 1, pageSize: query.pageSize ?? 100, total: rows.length } }
    },
  }
  return { api, state }
}
