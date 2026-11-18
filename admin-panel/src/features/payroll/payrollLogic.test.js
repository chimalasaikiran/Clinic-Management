import { describe, expect, it } from 'vitest'
import { createPayrollApi, payrollSeed } from '../../test/fixtures/payrollApi'
import { toPayrollState } from './adapters'
import { setBranches } from './constants'
import { minus, rupees, signed } from './format'
import {
  addMonths, advanceExposure, branchSummary, installmentAmount, nextRunMonth, payDateFor, previewSchedule, professionalTax, projectedNet, recoveryStart, statutoryLines,
  totals, validateAdvance, validateProfile, validateSettings,
} from './payrollLogic'

const SETTINGS = payrollSeed().settings

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
    expect(payDateFor('2026-12', 5)).toBe('2027-01-05')
  })

  it('runs the month after the last processed one, never a future month', () => {
    expect(nextRunMonth([{ month: '2026-09' }], '2026-11-18')).toBe('2026-10')
    expect(nextRunMonth([{ month: '2026-11' }], '2026-11-18')).toBe('2026-11')
    expect(nextRunMonth([], '2026-11-18')).toBe('2026-10')
    expect(recoveryStart({ cycle: { month: '2026-10' }, open: true, history: [], today: '2026-11-18' })).toBe('2026-11')
  })
})

// The same cases as backend/test/unit/payroll.test.ts, so the preview matches what the server pays.
describe('statutory deductions', () => {
  it('caps EPF, applies the professional-tax slab and ESIC only up to the wage ceiling', () => {
    expect(statutoryLines(SETTINGS, 'full_time', 85000)).toEqual([
      { code: 'epf', label: 'EPF (12%, capped at ₹1,800)', amount: 1800 },
      { code: 'pt', label: 'Professional tax (Telangana)', amount: 200 },
    ])
    expect(statutoryLines(SETTINGS, 'part_time', 18000).map((line) => [line.code, line.amount])).toEqual([['epf', 1800], ['pt', 150], ['esic', 135]])
    expect(statutoryLines(SETTINGS, 'full_time', 12000).map((line) => [line.code, line.amount])).toEqual([['epf', 1440], ['esic', 90]])
  })

  it('withholds only TDS from consultants and contract locums, and follows the settings', () => {
    expect(statutoryLines(SETTINGS, 'consultant', 36000)).toEqual([{ code: 'tds', label: 'TDS (Sec 194J, 10%)', amount: 3600 }])
    expect(statutoryLines({ ...SETTINGS, epfCap: 0, esicEnabled: false, ptEnabled: false }, 'full_time', 85000)).toEqual([{ code: 'epf', label: 'EPF (12%)', amount: 10200 }])
    expect(professionalTax(SETTINGS.ptSlabs, 15000)).toBe(0)
    expect(professionalTax(SETTINGS.ptSlabs, 15001)).toBe(150)
  })

  it('projects net pay with deductions worked out again', () => {
    const slip = { employee: { employmentId: 'full_time' }, gross: 14000, adjustments: 0, advance: 500, net: 0 }
    // ₹16,000: EPF capped ₹1,800 + PT ₹150 + ESIC ₹120.
    expect(projectedNet(slip, 2000, SETTINGS)).toBe(16000 - 1800 - 150 - 120 - 500)
  })
})

describe('advances', () => {
  it('splits into whole-rupee instalments with the remainder last', () => {
    expect([1, 2, 3].map((number) => installmentAmount(10000, 3, number))).toEqual([3333, 3333, 3334])
    const schedule = previewSchedule({ principal: 10000, installments: 3, startMonth: '2026-12' }, 5)
    expect(schedule.map((row) => [row.label, row.dueDate, row.amount, row.closing])).toEqual([
      ['December 2026', '05 Jan 2027', 3333, 6667], ['January 2027', '05 Feb 2027', 3333, 3334], ['February 2027', '05 Mar 2027', 3334, 0],
    ])
  })

  it('limits an advance to twice the monthly base less what is outstanding, and caps each instalment', () => {
    const employee = { id: 'STF-001', name: 'Dr. Ananya Rao', monthlyBase: 85000 }
    const advances = [{ employeeId: 'STF-001', status: 'Active', progress: { outstanding: 50000 } }, { employeeId: 'STF-001', status: 'Settled', progress: { outstanding: 0 } }]
    expect(advanceExposure(employee, advances)).toMatchObject({ outstanding: 50000, limit: 170000, available: 120000 })
    const base = { employee, installments: 6, disbursalDate: '2026-11-25', category: 'Education', outstanding: 50000 }
    expect(validateAdvance({ ...base, principal: 120001 }).principal).toBe('Exceeds the available limit of ₹1,20,000.')
    expect(validateAdvance({ ...base, principal: 90000, installments: 3 }).installments).toBe('Each instalment must stay under 35% of monthly gross. Spread it over more months.')
    expect(validateAdvance({ ...base, principal: 90000 })).toEqual({})
    expect(validateAdvance({ ...base, employee: { ...employee, monthlyBase: null }, principal: 1000 }).employeeId).toMatch(/no processed payslip yet/)
  })
})

describe('validation', () => {
  it('needs an IFSC and only the last four digits of the account', () => {
    const profile = { employment: 'full_time', model: 'monthly', rate: '32000', bankName: 'HDFC Bank', ifsc: 'hdfc0001234', accountLast4: '4421' }
    expect(validateProfile(profile)).toEqual({})
    expect(validateProfile({ ...profile, ifsc: 'HDFC1234', accountLast4: '50100123444421' })).toEqual({ ifsc: 'Enter an 11-character IFSC, e.g. HDFC0001234.', accountLast4: 'Enter the last 4 digits of the account.' })
  })

  it('checks rates, the pay day and distinct professional-tax slabs', () => {
    const errors = validateSettings({ ...SETTINGS, epfRate: '120', payDay: '31', ptSlabs: [{ above: 15000, amount: 150 }, { above: '15000', amount: 200 }] })
    expect(errors).toEqual({ epfRate: 'Enter the EPF rate as a percentage from 0 to 100.', payDay: 'Choose a day from 1 to 28.', ptSlabs: 'Each slab needs a different threshold.' })
    expect(validateSettings(SETTINGS)).toEqual({})
  })
})

describe('payroll state adapter', () => {
  it('builds payslips of the open run from the server lines, and totals by branch', async () => {
    const seed = payrollSeed()
    const state = toPayrollState(await createPayrollApi(seed).api.state())
    setBranches(state.branches)
    expect(state.batch.status).toBe('Draft')
    expect(state.slips.map((slip) => slip.employee.name)).toEqual(['Dr. Ananya Rao', 'Dr. Ravi Kumar', 'Priya Sharma', 'Ramesh Kumar'])
    const ananya = state.slips[0]
    // Salary, the approved travel allowance, EPF and PT on the total, then instalment 2 of the advance.
    expect(ananya).toMatchObject({ gross: 85000, adjustments: 5400, statutoryTotal: 2000, advance: 10000, net: 85000 + 5400 - 2000 - 10000 })
    expect(ananya.advanceLines.map((line) => [line.advance.id, line.number, line.amount])).toEqual([['ADV-000001', 2, 10000]])
    expect(branchSummary(state.slips).map((row) => [row.branch.name, row.staff])).toEqual([['Main Clinic', 2], ['West Wing', 2]])
    expect(totals(state.slips).staff).toBe(4)
  })

  it('shows an advance as recovered, due this cycle and upcoming', async () => {
    const state = toPayrollState(await createPayrollApi(payrollSeed()).api.state())
    const advance = state.advances.find((entry) => entry.id === 'ADV-000001')
    expect(advance.progress).toMatchObject({ repaid: 10000, outstanding: 50000, current: { number: 2, amount: 10000 }, monthly: 10000 })
    expect(advance.progress.schedule.map((row) => row.state)).toEqual(['Recovered', 'This cycle', 'Upcoming', 'Upcoming', 'Upcoming', 'Upcoming'])
    expect(state.staff.find((employee) => employee.name === 'Meera Joshi')).toMatchObject({ hasProfile: false, bank: 'No bank details' })
    expect(state.history[0]).toMatchObject({ status: '1 of 2 paid', paid: false, net: 105400 })
  })
})
