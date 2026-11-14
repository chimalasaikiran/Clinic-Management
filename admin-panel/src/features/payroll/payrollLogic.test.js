import { describe, expect, it } from 'vitest'
import { ADJUSTMENTS, ADVANCES, CYCLE_HISTORY, EMPLOYEES } from './data/seed'
import { minus, rupees, signed } from './format'
import {
  addMonths,
  advanceProgress,
  advanceSchedule,
  approvalBlockers,
  branchSummary,
  grossPay,
  payDateFor,
  payslip,
  statutoryDeductions,
  sum,
  totals,
  validateAdjustment,
  validateAdvance,
} from './payrollLogic'

const employee = (id) => EMPLOYEES.find((entry) => entry.id === id)
const advance = (id) => ADVANCES.find((entry) => entry.id === id)
const records = { adjustments: ADJUSTMENTS, advances: ADVANCES }

describe('formatting', () => {
  it('uses Indian digit grouping and a true minus sign', () => {
    expect(rupees(1284500)).toBe('₹12,84,500')
    expect(signed(8500)).toBe('+₹8,500')
    expect(signed(-12000)).toBe('−₹12,000')
    expect(minus(0)).toBe('—')
  })
})

describe('months', () => {
  it('adds months across a year end and derives the pay date', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(payDateFor('2026-12')).toBe('05 Jan 2027')
  })
})

describe('gross pay', () => {
  it('prorates monthly salaries by paid days and multiplies unit rates', () => {
    expect(grossPay(employee('STF-1093'))).toBe(27733)
    expect(grossPay(employee('STF-1122'))).toBe(36000)
  })
})

describe('statutory deductions', () => {
  it('withholds TDS for consultants', () => {
    expect(statutoryDeductions(employee('STF-1122'), 36000)).toEqual([{ label: 'TDS (Sec 194J, 10%)', amount: 3600 }])
  })

  it('caps EPF and adds ESIC only below the wage ceiling', () => {
    expect(sum(statutoryDeductions(employee('STF-1048'), 90400), (line) => line.amount)).toBe(2000)
    expect(statutoryDeductions(employee('STF-1048'), 18000).map((line) => line.amount)).toEqual([1800, 150, 135])
  })
})

describe('advances', () => {
  it('splits the principal and absorbs rounding in the last instalment', () => {
    const rows = advanceSchedule({ principal: 10000, installments: 3, startMonth: '2026-09', status: 'Active' })
    expect(rows.map((row) => row.amount)).toEqual([3333, 3333, 3334])
    expect(rows.at(-1).closing).toBe(0)
  })

  it('recovers only the current instalment of an active advance', () => {
    const progress = advanceProgress(advance('ADV-2026-0041'))
    expect(progress.repaid).toBe(10000)
    expect(progress.current.number).toBe(2)
    expect(progress.outstanding).toBe(50000)
    expect(advanceProgress(advance('ADV-2026-0045')).current).toBeUndefined()
    expect(advanceProgress(advance('ADV-2026-0046')).outstanding).toBe(0)
  })
})

describe('payslip', () => {
  it('nets gross, approved adjustments, advance recovery and statutory deductions', () => {
    const slip = payslip(employee('STF-1048'), records)
    expect(slip).toMatchObject({ gross: 85000, additions: 5400, advance: 10000, statutoryTotal: 2000, net: 78400 })
  })

  it('ignores adjustments that are not approved', () => {
    expect(payslip(employee('STF-1122'), records).additions).toBe(0)
  })

  it('rolls branch rows up to the batch total', () => {
    const slips = EMPLOYEES.map((entry) => payslip(entry, records))
    expect(sum(branchSummary(slips), (row) => row.net)).toBe(totals(slips).net)
  })
})

describe('approval blockers', () => {
  it('lists staff not ready, unverified banks and pending adjustments', () => {
    const employees = EMPLOYEES.map((entry) => ({ ...entry, included: entry.status !== 'On hold' }))
    expect(approvalBlockers({ employees, adjustments: ADJUSTMENTS })).toEqual([
      '2 included staff are not marked ready',
      '1 included staff has unverified bank details',
      '1 adjustment awaiting approval',
    ])
  })
})

describe('history seed', () => {
  it('keeps branch rows in step with each cycle total', () => {
    for (const cycle of CYCLE_HISTORY) {
      expect(sum(cycle.branches, (row) => row.gross)).toBe(cycle.gross)
      expect(sum(cycle.branches, (row) => row.net)).toBe(cycle.gross + cycle.adjustments - cycle.statutory - cycle.advances)
    }
  })
})

describe('validation', () => {
  it('requires every adjustment field', () => {
    expect(Object.keys(validateAdjustment({ amount: '0' }))).toEqual(['employeeId', 'direction', 'category', 'amount', 'reason'])
  })

  it('keeps an advance within the limit and the recovery cap', () => {
    const ananya = employee('STF-1048')
    const valid = { employee: ananya, principal: '60000', installments: '6', disbursalDate: '2026-09-25', category: 'Other' }
    expect(validateAdvance(valid)).toEqual({})
    expect(validateAdvance({ ...valid, principal: '160000', outstanding: 50000 }).principal).toBe('Exceeds the available limit of ₹1,20,000.')
    expect(validateAdvance({ ...valid, installments: '1' }).installments).toMatch(/under 35%/)
  })
})
