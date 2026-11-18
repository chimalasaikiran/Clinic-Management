import { isBlank } from '../../lib/validators'
import { formatDate } from '../patients/format'
import { ADVANCE_LIMIT_MULTIPLE, PAYROLL_BRANCHES, RECOVERY_CAP } from './constants'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0)
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100

export const branchName = (id) => PAYROLL_BRANCHES.find((branch) => branch.id === id)?.name ?? 'No branch'

// ── months ──

// "2026-09" plus 2 -> "2026-11"
export function addMonths(month, count) {
  const [year, index] = month.split('-').map(Number)
  const total = year * 12 + index - 1 + count
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function monthsBetween(from, to) {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

export const monthLabel = (month) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`
export const daysInMonth = (month) => new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
export const firstDay = (month) => `${month}-01`
export const lastDay = (month) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`

// The month a new run is for: the one after the last processed run, or last month for the first run.
export function nextRunMonth(history, today) {
  const current = today.slice(0, 7)
  const next = history[0] ? addMonths(history[0].month, 1) : addMonths(current, -1)
  return next > current ? current : next
}

// Salaries for a month are paid on the organisation's pay day of the following month.
export const payDateFor = (month, payDay) => `${addMonths(month, 1)}-${String(payDay).padStart(2, '0')}`

// ── statutory deductions (the same rules the server applies) ──

const isContractor = (employment) => employment === 'consultant' || employment === 'contract_locum'
const ofRate = (amount, rate) => round2((amount * rate) / 100)

export function professionalTax(slabs, gross) {
  return [...slabs].sort((a, b) => b.above - a.above).find((slab) => gross > slab.above)?.amount ?? 0
}

// `settings` as the payroll state gives them: rates in percent, amounts in rupees; `employment` is the API value.
export function statutoryLines(settings, employment, gross) {
  if (gross <= 0) return []
  if (isContractor(employment)) return settings.tdsEnabled ? [{ code: 'tds', label: `TDS (Sec 194J, ${settings.tdsRate}%)`, amount: ofRate(gross, settings.tdsRate) }] : []
  const lines = []
  if (settings.epfEnabled) {
    const epf = ofRate(gross, settings.epfRate)
    lines.push({ code: 'epf', label: `EPF (${settings.epfRate}%${settings.epfCap > 0 ? `, capped at ₹${settings.epfCap.toLocaleString('en-IN')}` : ''})`, amount: settings.epfCap > 0 ? Math.min(epf, settings.epfCap) : epf })
  }
  if (settings.ptEnabled) {
    const pt = professionalTax(settings.ptSlabs, gross)
    if (pt > 0) lines.push({ code: 'pt', label: `Professional tax (${settings.ptState})`, amount: pt })
  }
  if (settings.esicEnabled && gross <= settings.esicCeiling) lines.push({ code: 'esic', label: `ESIC (${settings.esicRate}%)`, amount: ofRate(gross, settings.esicRate) })
  return lines.filter((line) => line.amount > 0)
}

// Net pay of a payslip if its adjustments changed by `delta`: statutory deductions are worked out again.
export function projectedNet(slip, delta, settings) {
  const taxable = slip.gross + slip.adjustments + delta
  const statutory = sum(statutoryLines(settings, slip.employee.employmentId, taxable), (line) => line.amount)
  return round2(taxable - statutory - slip.advance)
}

// ── advances ──

// Whole-rupee instalments; the last one takes the remainder, so they add up to the principal.
export function installmentAmount(principal, installments, number) {
  const base = Math.floor(principal / installments)
  return number === installments ? round2(principal - base * (installments - 1)) : base
}

// The repayment plan of a new advance, one instalment a month from `startMonth`.
export function previewSchedule({ principal, installments, startMonth }, payDay) {
  let closing = principal
  return Array.from({ length: installments }, (_, index) => {
    const amount = installmentAmount(principal, installments, index + 1)
    closing = round2(closing - amount)
    const month = addMonths(startMonth, index)
    return { number: index + 1, month, label: monthLabel(month), dueDate: formatDate(payDateFor(month, payDay)), amount, closing, state: 'Upcoming' }
  })
}

// The first payroll month a new advance is recovered in: the month after the open run, or after the next run.
export const recoveryStart = ({ cycle, open, history, today }) => addMonths(open ? cycle.month : nextRunMonth(history, today), 1)

// Repaid, outstanding and the schedule of a recorded advance, worked out by the adapter from its recoveries.
export const advanceProgress = (advance) => advance.progress

export const monthlyBase = (employee) => employee.monthlyBase

// An employee's advance limit and how much of it open advances already use.
export function advanceExposure(employee, advances) {
  const open = advances.filter((advance) => advance.employeeId === employee.id && advance.status !== 'Settled' && advance.status !== 'Rejected')
  const outstanding = sum(open, (advance) => advance.progress.outstanding)
  const limit = (employee.monthlyBase ?? 0) * ADVANCE_LIMIT_MULTIPLE
  return { open, outstanding, limit, available: Math.max(limit - outstanding, 0) }
}

// ── totals ──

export function totals(slips) {
  return {
    staff: slips.length,
    gross: round2(sum(slips, (slip) => slip.gross)),
    additions: round2(sum(slips, (slip) => slip.additions)),
    deductions: round2(sum(slips, (slip) => slip.deductions)),
    adjustments: round2(sum(slips, (slip) => slip.adjustments)),
    advance: round2(sum(slips, (slip) => slip.advance)),
    statutory: round2(sum(slips, (slip) => slip.statutoryTotal)),
    net: round2(sum(slips, (slip) => slip.net)),
  }
}

export const branchSummary = (slips) => PAYROLL_BRANCHES.map((branch) => ({ branch, ...totals(slips.filter((slip) => slip.employee.branchId === branch.id)) }))

// ── validation (the server checks the same rules) ──

export function validateAdjustment({ employeeId, direction, category, amount, reason }) {
  const errors = {}
  if (isBlank(employeeId)) errors.employeeId = 'Choose an employee.'
  if (isBlank(direction)) errors.direction = 'Choose addition or deduction.'
  if (isBlank(category)) errors.category = 'Choose a category.'
  if (!(Number(amount) > 0)) errors.amount = 'Enter an amount greater than zero.'
  if (isBlank(reason)) errors.reason = 'Give a reason for this adjustment.'
  return errors
}

export function validateAdvance({ employee, principal, installments, disbursalDate, category, outstanding = 0 }) {
  const errors = {}
  if (!employee) {
    errors.employeeId = 'Choose an employee.'
    return errors
  }
  if (!employee.monthlyBase) {
    errors.employeeId = `${employee.name} has no processed payslip yet, so there is no monthly pay to set an advance limit against.`
    return errors
  }
  const amount = Number(principal)
  const limit = employee.monthlyBase * ADVANCE_LIMIT_MULTIPLE - outstanding
  if (!(amount > 0)) errors.principal = 'Enter an amount greater than zero.'
  else if (amount > limit) errors.principal = `Exceeds the available limit of ₹${Math.max(limit, 0).toLocaleString('en-IN')}.`
  if (!(Number(installments) >= 1 && Number(installments) <= 12)) errors.installments = 'Choose 1 to 12 instalments.'
  else if (amount > 0 && installmentAmount(amount, Number(installments), 1) > employee.monthlyBase * RECOVERY_CAP) {
    errors.installments = `Each instalment must stay under ${RECOVERY_CAP * 100}% of monthly gross. Spread it over more months.`
  }
  if (isBlank(disbursalDate)) errors.disbursalDate = 'Pick a disbursal date.'
  if (isBlank(category)) errors.category = 'Choose a reason category.'
  return errors
}

export function validateProfile({ employment, model, rate, bankName, ifsc, accountLast4 }) {
  const errors = {}
  if (isBlank(employment)) errors.employment = 'Choose the employment type.'
  if (isBlank(model)) errors.model = 'Choose the pay model.'
  if (!(Number(rate) > 0)) errors.rate = 'Enter the pay rate.'
  if (isBlank(bankName)) errors.bankName = 'Enter the bank name.'
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc ?? '').trim().toUpperCase())) errors.ifsc = 'Enter an 11-character IFSC, e.g. HDFC0001234.'
  if (!/^\d{4}$/.test(String(accountLast4 ?? '').trim())) errors.accountLast4 = 'Enter the last 4 digits of the account.'
  return errors
}

export function validateSettings(values) {
  const errors = {}
  const percent = (key, label) => {
    const value = Number(values[key])
    if (values[key] === '' || !(value >= 0 && value <= 100)) errors[key] = `Enter the ${label} as a percentage from 0 to 100.`
  }
  percent('epfRate', 'EPF rate')
  percent('esicRate', 'ESIC rate')
  percent('tdsRate', 'TDS rate')
  for (const key of ['epfCap', 'esicCeiling']) if (values[key] === '' || !(Number(values[key]) >= 0)) errors[key] = 'Enter zero or more.'
  if (isBlank(values.ptState)) errors.ptState = 'Enter the state the professional tax is paid in.'
  const day = Number(values.payDay)
  if (!(Number.isInteger(day) && day >= 1 && day <= 28)) errors.payDay = 'Choose a day from 1 to 28.'
  const slabs = values.ptSlabs ?? []
  if (slabs.some((slab) => slab.above === '' || slab.amount === '' || !(Number(slab.above) >= 0) || !(Number(slab.amount) >= 0))) errors.ptSlabs = 'Enter a threshold and an amount for every slab.'
  else if (new Set(slabs.map((slab) => Number(slab.above))).size !== slabs.length) errors.ptSlabs = 'Each slab needs a different threshold.'
  return errors
}
