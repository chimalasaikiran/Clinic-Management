import { describe, expect, it } from 'vitest'
import { toCarePlanView, toOrderRequest, toOrderView, toPrescriptionRequest, toReferralView } from './clinicalAdapters'

const at = (date, time = '09:00') => ({ date, time, at: `${date}T${time}:00.000Z` })

describe('order view', () => {
  const order = (overrides = {}) => ({
    id: 'o-1', reference: 'ORD-000001', patientId: 'p-1', encounterId: null, encounterReference: null, orderingName: 'Dr. Rahul Mehta (Cardiology)', kind: 'lab', category: 'Laboratory',
    title: 'HbA1c', indication: 'Follow-up', performing: 'In-house laboratory', urgent: false, status: 'ordered', accession: null, specimenNote: null, result: null, review: null,
    created: at('2026-11-17'), version: 1, branch: { id: 'b-1', name: 'Main' }, items: [{ id: 'i-1', name: 'HbA1c' }], events: [{ id: 'e-1', action: 'ordered', note: '', actor: 'Dr. Rahul Mehta', at: at('2026-11-17') }],
    ...overrides,
  })

  it('places the order on the stepper by status', () => {
    expect(toOrderView(order())).toMatchObject({ status: 'Ordered', stage: 0, specimen: null, findings: null })
    expect(toOrderView(order({ status: 'awaiting_review', result: { summary: 'HbA1c 6.1%', flag: 'normal' } }))).toMatchObject({ status: 'Awaiting Review', stage: 3, summary: 'HbA1c 6.1%', summaryTone: 'Normal', findings: null })
  })

  it('shows abnormal and critical results as findings, and who collected the specimen', () => {
    const view = toOrderView(order({
      status: 'awaiting_review', accession: 'ORD-000001-S1', result: { summary: 'HbA1c 11%', flag: 'critical' },
      events: [{ id: 'e-2', action: 'collected', note: '', actor: 'Nurse Priya', at: at('2026-11-17', '09:30') }, { id: 'e-1', action: 'ordered', note: '', actor: 'Dr. Rahul Mehta', at: at('2026-11-17') }],
    }))
    expect(view.findings).toEqual({ headline: 'Critical result', text: 'HbA1c 11%' })
    expect(view.specimen).toMatchObject({ accession: 'ORD-000001-S1', collectedBy: 'Nurse Priya', tests: ['HbA1c'] })
    expect(view.specimen.events.map((event) => event.title)).toEqual(['Order placed', 'Specimen collected'])
  })

  it('names the reviewer from the review', () => {
    const view = toOrderView(order({ status: 'reviewed', result: { summary: 'Normal', flag: 'normal' }, review: { outcome: 'normal', note: 'No action.', by: 'Dr. Ananya Rao', at: at('2026-11-18', '11:00') } }))
    expect(view).toMatchObject({ status: 'Completed & Reviewed', stage: 4, reviewedBy: 'Dr. Ananya Rao', reviewOutcome: 'normal', reviewNote: 'No action.' })
  })
})

describe('referral view', () => {
  it('keeps the creation entry out of the log and carries the response window', () => {
    const view = toReferralView({
      id: 'r-1', reference: 'REF-000001', patientId: 'p-1', encounterId: null, direction: 'incoming', status: 'awaiting_review', priority: 'Routine (within 2 weeks)', windowHours: 336, elapsedHours: 5,
      model: 'Second Opinion', specialty: 'Cardiology', indication: 'Murmur', narrative: 'New murmur.', questions: [], attachedRecords: ['ECG'], facility: 'Cardiology OPD', facilityNote: '',
      clinician: 'Dr. K. Rao', clinicianNote: 'City Hospital', outcome: 'Awaiting triage', created: at('2026-11-17'),
      events: [{ id: 'e-2', title: 'Phone call', text: 'Called', actor: 'Desk', at: at('2026-11-17', '10:00') }, { id: 'e-1', title: 'Referral received and logged for triage', text: '', actor: 'Desk', at: at('2026-11-17') }],
    })
    expect(view).toMatchObject({ direction: 'Incoming', status: 'Awaiting Review', sla: { windowHours: 336, elapsedHours: 5 }, attachments: 1 })
    expect(view.log.map((entry) => entry.title)).toEqual(['Phone call'])
    expect(view.checklist.length).toBeGreaterThan(0)
  })
})

describe('care plan view', () => {
  it('lists reviews newest first, ending with the activation', () => {
    const view = toCarePlanView({
      id: 'cp-1', reference: 'CP-000001', patientId: 'p-1', title: 'BP control', category: 'Chronic Disease Management', rationale: 'r', startDate: '2026-11-17', nextReview: '2026-12-17',
      targetDate: '2027-05-17', diagnoses: [], education: [], whatsapp: false, status: 'at_risk', compliance: 0, version: 2, lead: { id: 'dr-1', displayName: 'Dr. Rahul Mehta', room: '104' },
      createdBy: 'Siddharth Verma', created: at('2026-11-17'), updated: { date: '2026-11-18', by: 'Dr. Rahul Mehta' },
      goals: [{ id: 'g-1', title: 'BP', target: '<130/80', protocol: '', cadence: 'Every 30 Days', status: 'Worsening', observation: null }],
      interventions: [{ id: 'i-1', type: 'medication', title: 'Review drugs', due: '1 Dec', state: 'Staged' }],
      reviews: [{ id: 'rv-1', kind: 'escalated', observation: 'BP up.', summary: 'BP: Worsening', barriers: [], author: 'Dr. Rahul Mehta', at: at('2026-11-18') }],
    })
    expect(view).toMatchObject({ status: 'At Risk', lead: 'Dr. Rahul Mehta', updatedBy: 'Dr. Rahul Mehta', milestones: [{ no: '01', title: 'BP' }] })
    expect(view.interventions[0].detail).toBe('Medication review · Due 1 Dec')
    expect(view.progress.map((entry) => entry.title)).toEqual(['Escalated for attending review', 'Care plan activated'])
  })
})

describe('requests', () => {
  it('sends a prescription for an encounter, or for a branch when there is none', () => {
    const draft = { indication: 'Back pain', precautionAcknowledged: true, items: [{ medicineCode: 'naproxen', name: 'Naproxen', strength: '250 mg', form: 'Tablet', route: 'Oral', drugClass: 'nsaid', doseCount: 1, frequency: 'Twice daily', frequencyPerDay: 2, frequencyNote: 'After food', durationDays: 5, instructions: '', indication: 'Back pain', quantity: 10 }] }
    expect(toPrescriptionRequest(draft, { encounterId: 'e-1', branchId: 'b-1' })).toMatchObject({ encounterId: 'e-1', items: [{ dose: 1, food: 'After food', frequencyPerDay: 2 }] })
    const standalone = toPrescriptionRequest(draft, { branchId: 'b-1' })
    expect(standalone).toMatchObject({ branchId: 'b-1' })
    expect(standalone).not.toHaveProperty('encounterId')
    expect(standalone.items[0]).not.toHaveProperty('quantity')
  })

  it('sends only the catalogue fields of each investigation', () => {
    const request = toOrderRequest({ indication: 'Follow-up', items: [{ code: 'LAB-1', name: 'HbA1c', category: 'Laboratory', loinc: '4548-4', destination: 'Lab', priority: 'Urgent', extra: 'x' }] }, { branchId: 'b-1' })
    expect(request).toEqual({ branchId: 'b-1', indication: 'Follow-up', items: [{ code: 'LAB-1', name: 'HbA1c', category: 'Laboratory', loinc: '4548-4', destination: 'Lab', priority: 'Urgent' }] })
  })
})
