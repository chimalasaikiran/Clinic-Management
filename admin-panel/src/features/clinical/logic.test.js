import { describe, expect, it } from 'vitest'
import { SEED_CARE_PLANS } from '../../test/fixtures/patients'
import { WORKLIST } from '../../test/fixtures/worklist'
import { hubSummary, safetyExceptions, workAction, workItems } from './hub'
import { defaultDates, duplicatePlans, goalsOf, validateCarePlan, validateIncident, validateReview } from './logic'

// Building plans, applying reviews and numbering incidents happen on the server; see
// backend/test/unit/clinical-records.test.ts and backend/test/integration/orders-referrals-care.test.ts.
const CLINICIAN = { sign: true, triage: true }
const DESK = { sign: false, triage: true }
const VIEWER = { sign: false, triage: false }

const validPlan = () => ({
  title: 'Post-CABG Secondary Prevention Plan', leadId: 'rahul-mehta', category: 'Secondary Prevention & Cardiac Rehab', diagnoses: [{ icd: 'I25.10', name: 'Atherosclerotic heart disease' }],
  rationale: 'Stabilise haemodynamics and titrate cardioprotective therapy.', ...defaultDates('2026-10-12'),
  goals: [{ title: 'Blood pressure', target: '< 130/80 mmHg', protocol: 'Home log', cadence: 'Every 30 Days' }],
  interventions: [{ type: 'follow-up', label: 'Clinical follow-up', title: '30-day review', due: '14 Nov 2026' }], redFlags: 'Chest pain at rest', whatsapp: true,
})

describe('hub figures', () => {
  it('counts the queue, open encounters, serious alerts, results to review and follow-ups from the worklist', () => {
    expect(hubSummary(WORKLIST)).toEqual({ inConsultation: 1, pendingDocumentation: 1, awaitingReview: 0, mandatory: 1, followUpsDue: 0 })
    expect(hubSummary({ ...WORKLIST, ordersAwaitingReview: 2, followUpsDue: 3 })).toMatchObject({ awaitingReview: 2, followUpsDue: 3 })
  })

  it('lists serious alerts with their patient', () => {
    const exceptions = safetyExceptions(WORKLIST)
    expect(exceptions.map((entry) => entry.alert.id)).toEqual(['alt-1'])
    expect(exceptions[0]).toMatchObject({ alert: { severity: 'Critical' }, patient: { name: 'Ananya Sharma', mrn: 'PT-000184' } })
  })

  it("builds the work queue from today's appointments, leaving out cancelled ones", () => {
    const items = workItems(WORKLIST, '09:10')
    expect(items.map((item) => item.status)).toEqual(['Arrived', 'In Progress'])
    expect(items[0]).toMatchObject({ token: 'A-01', chamber: 'Chamber 104', alert: { id: 'alt-1' }, dwell: { label: 'Ready for Rooming', note: 'Checked in 20m ago' } })
    expect(items[1].dwell).toMatchObject({ label: 'In Consultation', note: 'Encounter ENC-000009' })
  })
})

describe('access', () => {
  const [arrived, inRoom] = workItems(WORKLIST, '09:10')

  it('lets clinicians call the next token and sign, and keeps view-only roles read-only', () => {
    expect(workAction(arrived, CLINICIAN)?.kind).toBe('start')
    expect(workAction(inRoom, CLINICIAN)?.kind).toBe('sign')
    expect(workAction(arrived, VIEWER)).toBeNull()
  })

  it('lets the desk open visits but not sign notes', () => {
    expect(workAction(arrived, DESK)).toBeNull()
    expect(workAction(inRoom, DESK)?.kind).toBe('view')
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
})
