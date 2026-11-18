import { describe, expect, it } from 'vitest'
import {
  addMonths, attendanceNote, attendanceSummary, DEFAULT_PT_SLABS, daysInMonth, dueInstalment, grossPay, installmentAmount, payDateFor, payslip, professionalTax, statutoryLines,
  type StatutoryRules,
} from '../../src/modules/payroll/payroll.logic'
import { adjustmentDecisionSchema, adjustmentSchema, advanceActionSchema, profileSchema, settingsSchema } from '../../src/modules/payroll/payroll.schemas'

const RULES: StatutoryRules = {
  epfEnabled: true, epfRateBp: 1200, epfCap: 180_000, esicEnabled: true, esicRateBp: 75, esicCeiling: 2_100_000,
  ptEnabled: true, ptState: 'Telangana', ptSlabs: DEFAULT_PT_SLABS, tdsEnabled: true, tdsRateBp: 1000,
}
const STAFF = '01930000-0000-7000-8000-000000000001'
const rupees = (value: number) => value * 100

describe('statutory deductions', () => {
  it('caps EPF, applies the professional-tax slab and ESIC only up to the wage ceiling', () => {
    expect(statutoryLines(RULES, 'full_time', rupees(85_000))).toEqual([
      { code: 'epf', label: 'EPF (12%, capped at ₹1,800)', amount: rupees(1800) },
      { code: 'pt', label: 'Professional tax (Telangana)', amount: rupees(200) },
    ])
    expect(statutoryLines(RULES, 'part_time', rupees(18_000)).map((line) => [line.code, line.amount])).toEqual([['epf', rupees(1800)], ['pt', rupees(150)], ['esic', rupees(135)]])
    expect(statutoryLines(RULES, 'full_time', rupees(12_000)).map((line) => [line.code, line.amount])).toEqual([['epf', rupees(1440)], ['esic', rupees(90)]])
  })

  it('withholds only TDS from consultants and contract locums', () => {
    expect(statutoryLines(RULES, 'consultant', rupees(36_000))).toEqual([{ code: 'tds', label: 'TDS (Sec 194J, 10%)', amount: rupees(3600) }])
    expect(statutoryLines(RULES, 'contract_locum', rupees(40_000)).map((line) => line.code)).toEqual(['tds'])
  })

  it('follows the organisation settings', () => {
    const rules = { ...RULES, epfCap: 0, esicEnabled: false, ptEnabled: false, tdsEnabled: false }
    expect(statutoryLines(rules, 'full_time', rupees(85_000))).toEqual([{ code: 'epf', label: 'EPF (12%)', amount: rupees(10_200) }])
    expect(statutoryLines(rules, 'consultant', rupees(85_000))).toEqual([])
    expect(statutoryLines(RULES, 'full_time', 0)).toEqual([])
  })

  it('takes the highest professional-tax slab the gross is above', () => {
    expect(professionalTax(DEFAULT_PT_SLABS, rupees(15_000))).toBe(0)
    expect(professionalTax(DEFAULT_PT_SLABS, rupees(15_001))).toBe(rupees(150))
    expect(professionalTax([...DEFAULT_PT_SLABS].reverse(), rupees(20_001))).toBe(rupees(200))
  })
})

describe('months and pay dates', () => {
  it('moves across years and knows the length of each month', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect([daysInMonth('2026-02'), daysInMonth('2028-02'), daysInMonth('2026-09')]).toEqual([28, 29, 30])
    expect(payDateFor('2026-12', 5)).toBe('2027-01-05')
  })
})

describe('attendance', () => {
  it('counts a date once, as worked when any branch says so, and only absences as unpaid', () => {
    const summary = attendanceSummary('2026-09', [
      { date: '2026-09-01', status: 'present' },
      { date: '2026-09-02', status: 'absent' },
      { date: '2026-09-02', status: 'late' },
      { date: '2026-09-03', status: 'absent' },
      { date: '2026-09-04', status: 'leave' },
    ])
    expect(summary).toMatchObject({ days: 30, present: 1, late: 1, absent: 1, leave: 1, unrecorded: 26, paidDays: 29 })
    expect(attendanceNote(summary)).toBe('2 days present · 1 days leave · 1 days absent · 26 days not recorded')
  })
})

describe('pay', () => {
  it('prorates a monthly salary by paid days and multiplies unit rates', () => {
    expect(grossPay('monthly', rupees(32_000), 26, 30)).toBe(2_773_333)
    expect(grossPay('monthly', rupees(30_000), 31, 30)).toBe(rupees(30_000))
    expect(grossPay('visit', rupees(1500), 24, 30)).toBe(rupees(36_000))
  })

  it('works statutory deductions on gross after adjustments and takes advances last', () => {
    const slip = payslip({
      model: 'monthly', employment: 'full_time', rate: rupees(20_000), quantity: 30, days: 30, rules: RULES,
      adjustments: [{ direction: 'addition', amount: rupees(2000) }, { direction: 'deduction', amount: rupees(500) }],
      advances: [{ amount: rupees(1000) }],
    })
    expect(slip).toMatchObject({ gross: rupees(20_000), additions: rupees(2000), deductions: rupees(500), statutoryTotal: rupees(2000), advance: rupees(1000), net: rupees(18_500) })
    expect(slip.statutory.map((line) => line.code)).toEqual(['epf', 'pt'])
  })
})

describe('advance recovery', () => {
  it('splits into whole-rupee instalments with the remainder last', () => {
    expect([1, 2, 3].map((number) => installmentAmount(rupees(10_000), 3, number))).toEqual([rupees(3333), rupees(3333), rupees(3334)])
  })

  it('takes the next instalment once active and due, and nothing after the last', () => {
    const advance = { id: 'a', status: 'active', principal: rupees(30_000), installments: 3, startMonth: '2026-09', recovered: [{ number: 1, amount: rupees(10_000) }] }
    expect(dueInstalment(advance, '2026-10')).toEqual({ advanceId: 'a', number: 2, amount: rupees(10_000) })
    expect(dueInstalment(advance, '2026-08')).toBeNull()
    expect(dueInstalment({ ...advance, status: 'awaiting_acknowledgement' }, '2026-10')).toBeNull()
    expect(dueInstalment({ ...advance, recovered: [...advance.recovered, { number: 2, amount: 1 }, { number: 3, amount: 1 }] }, '2026-12')).toBeNull()
  })
})

describe('payroll request validation', () => {
  it('turns rupees and percentages into paise and basis points', () => {
    const settings = settingsSchema.parse({
      epfEnabled: true, epfRate: 12, epfCap: 1800, esicEnabled: true, esicRate: 0.75, esicCeiling: 21000, ptEnabled: true, ptState: 'Telangana',
      ptSlabs: [{ above: 15000, amount: 150 }], tdsEnabled: true, tdsRate: 10, payDay: 5, version: null,
    })
    expect(settings).toMatchObject({ epfRate: 1200, epfCap: 180_000, esicRate: 75, ptSlabs: [{ above: 1_500_000, amount: 15_000 }] })
  })

  it('keeps only bank name, IFSC and the last four digits', () => {
    const valid = { staffId: STAFF, employment: 'full_time', model: 'monthly', rate: 32000, bankName: 'HDFC Bank', ifsc: 'hdfc0001234', accountLast4: '4421' }
    expect(profileSchema.parse(valid)).toMatchObject({ ifsc: 'HDFC0001234', rate: 3_200_000 })
    expect(profileSchema.safeParse({ ...valid, accountLast4: '123456789012' }).success).toBe(false)
    expect(profileSchema.safeParse({ ...valid, ifsc: 'HDFC1234' }).success).toBe(false)
  })

  it('needs a category of the right kind and a reason to reject', () => {
    const adjustment = { staffId: STAFF, month: '2026-09', direction: 'deduction', category: 'Clinic bonus', amount: 500, reason: 'Recovery' }
    expect(adjustmentSchema.safeParse(adjustment).success).toBe(false)
    expect(adjustmentSchema.parse({ ...adjustment, category: 'Unpaid leave' })).toMatchObject({ amount: 50_000, label: '' })
    expect(adjustmentDecisionSchema.safeParse({ ids: [STAFF], decision: 'rejected', comment: '' }).success).toBe(false)
    expect(advanceActionSchema.safeParse({ action: 'reject', note: '', version: 1 }).success).toBe(false)
  })
})
