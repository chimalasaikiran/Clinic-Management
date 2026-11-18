import { describe, expect, it } from 'vitest'
import { compliance, completionProblem, planStatus, reviewSummary } from '../../src/modules/clinical/care-plans.logic'
import { createReferralSchema } from '../../src/modules/clinical/referrals.schemas'
import { createIncidentSchema } from '../../src/modules/clinical/incidents.schemas'
import { createOrderSchema } from '../../src/modules/clinical/orders.schemas'
import { createPrescriptionSchema } from '../../src/modules/clinical/prescriptions.schemas'
import { hypertensive } from '../../src/modules/clinical/prescriptions.service'

const goal = (id: string, status: string) => ({ id, title: `Goal ${id}`, status })

describe('care plan reviews', () => {
  it('counts on-target and achieved goals among the rated ones', () => {
    expect(compliance(['Improving / On Target', 'Worsening', 'Achieved', 'Unable to Assess'])).toBe(67)
    expect(compliance(['Pending Baseline', 'Unable to Assess'])).toBe(0)
    expect(compliance([])).toBe(0)
  })

  it('puts a plan at risk when any goal worsens and marks it achieved when every goal is', () => {
    expect(planStatus(['Achieved', 'Worsening'])).toBe('at_risk')
    expect(planStatus(['Achieved', 'Achieved'])).toBe('achieved')
    expect(planStatus(['Unchanged', 'Achieved'])).toBe('on_track')
    expect(planStatus([])).toBe('on_track')
  })

  it('completes a follow-up only with every goal rated, a future review date, and worsening goals escalated', () => {
    const today = '2026-11-17'
    expect(completionProblem([goal('1', 'Pending Baseline')], '2026-12-01', today, false)).toMatch(/every goal/)
    expect(completionProblem([goal('1', 'Unchanged')], today, today, false)).toMatch(/after today/)
    expect(completionProblem([goal('1', 'Unchanged')], undefined, today, false)).toMatch(/after today/)
    expect(completionProblem([goal('1', 'Worsening')], '2026-12-01', today, false)).toMatch(/escalated/)
    expect(completionProblem([goal('1', 'Worsening')], '2026-12-01', today, true)).toBeNull()
    expect(completionProblem([goal('1', 'Achieved'), goal('2', 'Unable to Assess')], '2026-12-01', today, false)).toBeNull()
  })

  it('summarises the goal statuses for the review history', () => {
    expect(reviewSummary([goal('1', 'Achieved'), goal('2', 'Unchanged')])).toBe('Goal 1: Achieved; Goal 2: Unchanged')
    expect(reviewSummary([])).toBe('no goals rated')
  })
})

describe('prescription rules', () => {
  it('treats blood pressure from 130/80 up as a precaution for NSAIDs', () => {
    expect(hypertensive({ systolic: 130, diastolic: 70 })).toBe(true)
    expect(hypertensive({ systolic: 118, diastolic: 80 })).toBe(true)
    expect(hypertensive({ systolic: 129, diastolic: 79 })).toBe(false)
    expect(hypertensive(null)).toBe(false)
  })

  const medicine = { medicineCode: 'naproxen', name: 'Naproxen Sodium', strength: '250 mg', form: 'Tablet', route: 'Oral', drugClass: 'nsaid', dose: 1, frequency: 'Twice daily (1-0-1)', frequencyPerDay: 2, food: 'After food', durationDays: 5, indication: 'Back pain' }

  it('needs at least one item, and a branch when there is no encounter', () => {
    expect(createPrescriptionSchema.safeParse({ branchId: '01a1e7fa-deb7-71fa-8ee5-dbaa553f1efa', indication: 'Back pain', items: [] }).success).toBe(false)
    expect(createPrescriptionSchema.safeParse({ indication: 'Back pain', items: [medicine] }).success).toBe(false)
    expect(createPrescriptionSchema.safeParse({ branchId: '01a1e7fa-deb7-71fa-8ee5-dbaa553f1efa', indication: 'Back pain', items: [medicine] }).success).toBe(true)
  })

  it('refuses doses outside 1 to 20', () => {
    const parsed = createPrescriptionSchema.safeParse({ branchId: '01a1e7fa-deb7-71fa-8ee5-dbaa553f1efa', indication: 'Back pain', items: [{ ...medicine, dose: 21 }] })
    expect(parsed.success).toBe(false)
  })
})

describe('request validation', () => {
  const branchId = '01a1e7fa-deb7-71fa-8ee5-dbaa553f1efa'

  it('only accepts known investigation categories', () => {
    const item = { code: 'LAB-HBA1C-01', name: 'HbA1c', category: 'Laboratory', destination: 'In-house laboratory', priority: 'Routine (Outpatient OPD)' }
    expect(createOrderSchema.safeParse({ branchId, indication: 'Diabetes follow-up', items: [item] }).success).toBe(true)
    expect(createOrderSchema.safeParse({ branchId, indication: 'Diabetes follow-up', items: [{ ...item, category: 'Astrology' }] }).success).toBe(false)
  })

  it('needs a destination for an outgoing referral and a referring clinician for an incoming one', () => {
    const shared = { priority: 'High / Expedited (48h)', model: 'Second Opinion', specialty: 'Cardiology', indication: 'Chest pain', narrative: 'Exertional chest pain for two weeks.' }
    expect(createReferralSchema.safeParse({ direction: 'outgoing', ...shared }).success).toBe(false)
    expect(createReferralSchema.safeParse({ direction: 'outgoing', ...shared, facility: 'City Heart Centre' }).success).toBe(true)
    expect(createReferralSchema.safeParse({ direction: 'incoming', ...shared, facility: 'Cardiology OPD' }).success).toBe(false)
    expect(createReferralSchema.safeParse({ direction: 'outgoing', ...shared, priority: 'Whenever' }).success).toBe(false)
  })

  it('needs corrective actions for moderate-or-worse incidents', () => {
    const report = { category: 'medication', severity: 4, date: '2026-11-17', time: '10:30', branchId, zone: 'Pharmacy Dispensary', headline: 'Wrong strength dispensed', chronology: 'A 500 mg strength was handed over instead of 250 mg and noticed at home.' }
    expect(createIncidentSchema.safeParse(report).success).toBe(false)
    expect(createIncidentSchema.safeParse({ ...report, actions: 'Patient recalled; correct strength issued.' }).success).toBe(true)
    expect(createIncidentSchema.safeParse({ ...report, severity: 2 }).success).toBe(true)
  })
})
