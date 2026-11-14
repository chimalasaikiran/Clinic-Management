import { describe, expect, it } from 'vitest'
import { SEED_APPOINTMENTS } from '../patients/data/seedVisits'
import { SEED_ALERTS, SEED_CARE_PLANS, SEED_ORDERS } from '../patients/data/seedClinical'
import { SEED_ENCOUNTERS } from '../patients/data/seedVisits'
import { PATIENTS } from '../patients/data/patients'
import { SEED_DAY_APPOINTMENTS } from '../appointments/data/seedDay'
import { ROLE_SCOPES } from './constants'
import { hubSummary, safetyExceptions, workAction, workItems } from './hub'
import { applyReview, buildCarePlan, buildIncident, defaultDates, duplicatePlans, goalsOf, validateCarePlan, validateIncident, validateReview } from './logic'

const records = { patients: PATIENTS, appointments: [...SEED_APPOINTMENTS, ...SEED_DAY_APPOINTMENTS], encounters: SEED_ENCOUNTERS, alerts: SEED_ALERTS, orders: SEED_ORDERS, carePlans: SEED_CARE_PLANS, incidents: [] }
const scope = (id) => ROLE_SCOPES.find((entry) => entry.id === id)

const validPlan = () => ({
  title: 'Post-CABG Secondary Prevention Plan', leadId: 'rahul-mehta', category: 'Secondary Prevention & Cardiac Rehab', diagnoses: [{ icd: 'I25.10', name: 'Atherosclerotic heart disease' }],
  rationale: 'Stabilise haemodynamics and titrate cardioprotective therapy.', ...defaultDates('2026-10-12'),
  goals: [{ title: 'Blood pressure', target: '< 130/80 mmHg', protocol: 'Home log', cadence: 'Every 30 Days' }],
  interventions: [{ type: 'follow-up', label: 'Clinical follow-up', title: '30-day review', due: '14 Nov 2026' }], redFlags: 'Chest pain at rest', whatsapp: true,
})

describe('hub figures', () => {
  it('counts what the records show', () => {
    expect(hubSummary(records)).toEqual({ inConsultation: 0, pendingDocumentation: 0, awaitingReview: 1, mandatory: 2, followUpsDue: 0 })
  })

  it('lists only critical and high alerts as mandatory exceptions, with their patient', () => {
    const exceptions = safetyExceptions(records)
    expect(exceptions.map((entry) => entry.alert.id)).toEqual(['ALT-88102', 'ALT-88103'])
    expect(exceptions[0].patient.name).toBe('Ananya Sharma')
  })

  it("builds the work queue from today's chamber appointments in time order", () => {
    const items = workItems(records)
    expect(items.map((item) => item.appointment.time)).toEqual([...items.map((item) => item.appointment.time)].sort())
    expect(items.some((item) => item.status === 'No-show')).toBe(false)
    expect(items.find((item) => item.status === 'Arrived').dwell.label).toBe('Ready for Rooming')
  })
})

describe('access scopes', () => {
  const arrived = workItems(records).find((item) => item.status === 'Arrived')

  it('lets a clinician call the next token and keeps the owner view read-only', () => {
    expect(workAction(arrived, scope('attending'))?.kind).toBe('start')
    expect(workAction(arrived, scope('owner'))).toBeNull()
  })

  it('lets triage nurses call patients but not sign notes', () => {
    const inRoom = { status: 'In Progress', appointment: { queueToken: 'A-1' }, encounter: { status: 'In Progress' } }
    expect(workAction(arrived, scope('nurse'))?.kind).toBe('start')
    expect(workAction(inRoom, scope('nurse'))?.kind).toBe('view')
    expect(workAction(inRoom, scope('dual'))?.kind).toBe('sign')
  })
})

describe('care plan', () => {
  it('needs diagnoses, rationale, ordered dates, a goal and an intervention', () => {
    const errors = validateCarePlan({ ...validPlan(), title: '', diagnoses: [], rationale: 'short', interim: '2026-10-01', goals: [], interventions: [] })
    expect(Object.keys(errors)).toEqual(['title', 'diagnoses', 'rationale', 'interim', 'goals', 'interventions'])
    expect(validateCarePlan(validPlan())).toEqual({})
  })

  it('flags an active plan in the same category as a possible duplicate', () => {
    expect(duplicatePlans([{ id: 'X', status: 'On Track', category: 'Secondary Prevention & Cardiac Rehab', title: 'Other' }], validPlan())).toHaveLength(1)
    expect(duplicatePlans([{ id: 'X', status: 'Draft', category: 'Secondary Prevention & Cardiac Rehab', title: 'Other' }], validPlan())).toHaveLength(0)
  })

  it('creates the plan with numbered goals and staged interventions', () => {
    const plan = buildCarePlan(validPlan(), { patientId: 'pt-000184', plans: SEED_CARE_PLANS, leadName: 'Dr. Rahul Mehta' })
    expect(plan).toMatchObject({ id: 'CP-2026-CABG'.replace('CABG', '001'), status: 'On Track', compliance: 0, nextReview: '2026-11-11' })
    expect(plan.goals[0]).toMatchObject({ id: 'G1', status: 'Pending Baseline' })
    expect(plan.interventions[0].state).toBe('Staged')
  })
})

describe('progress review', () => {
  const plan = SEED_CARE_PLANS[0]
  const review = (extra = {}) => ({ observation: 'Walks 25 minutes daily without symptoms.', nextReview: '2026-12-14', escalate: false, barriers: [], goalStatus: { '01': 'Improving / On Target', '02': 'Unchanged', '03': 'Achieved' }, goalNote: {}, adherence: ['Completed', 'Partially Completed', 'Not Completed'], ...extra })

  it('falls back to the milestones as goals for older plans', () => {
    expect(goalsOf(plan).map((goal) => goal.title)).toEqual(plan.milestones.map((milestone) => milestone.title))
  })

  it('requires an observation, and a status per goal plus a future review date to complete', () => {
    expect(validateReview(review({ observation: '' }), { complete: false }).observation).toBeTruthy()
    expect(validateReview(review({ goalStatus: { '01': '', '02': 'Unchanged', '03': 'Achieved' } }), { complete: true }).goals).toBeTruthy()
    expect(validateReview(review({ nextReview: '2026-10-01' }), { complete: true }).nextReview).toBeTruthy()
  })

  it('will not complete a follow-up with a worsening goal unless it is escalated', () => {
    const worsening = review({ goalStatus: { '01': 'Worsening', '02': 'Unchanged', '03': 'Achieved' } })
    expect(validateReview(worsening, { complete: true }).escalate).toMatch(/escalated/)
    expect(validateReview({ ...worsening, escalate: true }, { complete: true }).escalate).toBeUndefined()
  })

  it('derives compliance and plan status, and only moves the review date on completion', () => {
    const saved = applyReview({ ...plan, goals: undefined }, { ...review(), goalStatus: { '01': 'Improving / On Target', '02': 'Unchanged', '03': 'Achieved' } }, { complete: false, by: 'Dr. Test' })
    expect(saved).toMatchObject({ compliance: 67, status: 'On Track', nextReview: plan.nextReview })
    expect(saved.progress[0].title).toBe('Progress saved')
    const done = applyReview(plan, review(), { complete: true, by: 'Dr. Test' })
    expect(done.nextReview).toBe('2026-12-14')
    expect(done.interventions[2].state).toBe('Not Completed')
    expect(applyReview(plan, review({ goalStatus: { '01': 'Worsening', '02': 'Unchanged', '03': 'Achieved' } }), { complete: false, by: 'x' }).status).toBe('At Risk')
  })
})

describe('incident report', () => {
  const valid = () => ({ category: 'medication', severity: '1', date: '2026-10-12', time: '11:20', zone: 'Chamber 101 (Cardiology OPD)', branch: 'Kondapur Satellite Clinic', associate: true, patientId: 'pt-000184', headline: 'Near-miss: wrong antibiotic staged', chronology: 'The order was staged and recalled before it reached the pharmacy counter.', actions: '', factors: [], witnesses: [], anonymous: false, notifyQuality: true, logRegister: true })

  it('needs a category, severity, narrative and a patient when one is associated', () => {
    const errors = validateIncident({ ...valid(), category: '', severity: '', headline: 'short', chronology: 'short', patientId: '' })
    expect(Object.keys(errors)).toEqual(['category', 'severity', 'patientId', 'headline', 'chronology'])
  })

  it('rejects a future occurrence', () => {
    expect(validateIncident({ ...valid(), date: '2026-10-13' }).date).toMatch(/future/)
  })

  it('demands corrective actions for moderate harm or worse', () => {
    expect(validateIncident({ ...valid(), severity: '4' }).actions).toBeTruthy()
    expect(validateIncident({ ...valid(), severity: '4', actions: 'Patient observed for 24 hours.' }).actions).toBeUndefined()
  })

  it('numbers the report and hides the reporter when it is anonymous', () => {
    expect(buildIncident(valid(), { incidents: [], patient: { id: 'pt-000184' }, reporter: 'Dr. Siddharth Verma' })).toMatchObject({ id: 'INC-2026-0001', patientId: 'pt-000184', reporter: 'Dr. Siddharth Verma' })
    expect(buildIncident({ ...valid(), anonymous: true, associate: false }, { incidents: [{ id: 'INC-2026-0001' }], patient: null, reporter: 'x' })).toMatchObject({ id: 'INC-2026-0002', patientId: null, reporter: 'Anonymous (safe harbor)' })
  })
})
