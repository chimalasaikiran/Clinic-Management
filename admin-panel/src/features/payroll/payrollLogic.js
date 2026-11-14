import { isBlank } from '../../lib/validators'
import { CURRENT_CYCLE, PAYROLL_BRANCHES } from './data/seed'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// An advance instalment may not take more than this share of an employee's monthly gross.
export const RECOVERY_CAP = 0.35
// Advances are capped at this multiple of monthly gross.
export const ADVANCE_LIMIT_MULTIPLE = 2

export const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0)

export const branchName = (id) => PAYROLL_BRANCHES.find((branch) => branch.id === id)?.name ?? id

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

export const monthLabel = (month) => `${LONG_MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`
const shortMonthLabel = (month) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`

// Salaries for a cycle are paid on the 5th of the following month.
export const payDateFor = (month) => `05 ${shortMonthLabel(addMonths(month, 1))}`

export function grossPay(employee, days = CURRENT_CYCLE.days) {
  if (employee.model === 'monthly') return Math.round((employee.rate * employee.paidDays) / days)
  return employee.rate * employee.units
}

// Employees pay EPF, Telangana professional tax and (below the wage ceiling) ESIC;
// consultants and contract locums have TDS withheld under Sec 194J instead.
export function statutoryDeductions(employee, gross) {
  if (gross <= 0) return []
  if (employee.employment === 'Consultant' || employee.employment === 'Contract locum') {
    return [{ label: 'TDS (Sec 194J, 10%)', amount: Math.round(gross * 0.1) }]
  }
  const lines = [{ label: 'EPF (12%, capped at ₹1,800)', amount: Math.min(Math.round(gross * 0.12), 1800) }]
  const professionalTax = gross > 20000 ? 200 : gross > 15000 ? 150 : 0
  if (professionalTax) lines.push({ label: 'Professional tax (Telangana)', amount: professionalTax })
  if (gross <= 21000) lines.push({ label: 'ESIC (0.75%)', amount: Math.round(gross * 0.0075) })
  return lines
}

// Equal monthly instalments; the last one absorbs any rounding remainder.
export function advanceSchedule(advance, cycleMonth = CURRENT_CYCLE.month) {
  const base = Math.floor(advance.principal / advance.installments)
  const current = monthsBetween(advance.startMonth, cycleMonth)
  let closing = advance.principal
  return Array.from({ length: advance.installments }, (_, index) => {
    const amount = index === advance.installments - 1 ? advance.principal - base * index : base
    closing -= amount
    const month = addMonths(advance.startMonth, index)
    let state = 'Upcoming'
    if (advance.status === 'Settled' || (advance.status === 'Active' && index < current)) state = 'Recovered'
    else if (advance.status === 'Active' && index === current) state = 'This cycle'
    return { number: index + 1, month, label: monthLabel(month), dueDate: payDateFor(month), amount, closing, state }
  })
}

export function advanceProgress(advance, cycleMonth = CURRENT_CYCLE.month) {
  const schedule = advanceSchedule(advance, cycleMonth)
  const repaid = sum(schedule.filter((row) => row.state === 'Recovered'), (row) => row.amount)
  const current = schedule.find((row) => row.state === 'This cycle')
  return { schedule, repaid, outstanding: advance.principal - repaid, current, monthly: schedule[0]?.amount ?? 0 }
}

export const advanceRecovery = (advance, cycleMonth = CURRENT_CYCLE.month) => advanceProgress(advance, cycleMonth).current?.amount ?? 0

export function payslip(employee, { adjustments, advances }, cycle = CURRENT_CYCLE) {
  const gross = grossPay(employee, cycle.days)
  const approved = adjustments.filter((entry) => entry.employeeId === employee.id && entry.status === 'Approved')
  const additions = sum(approved.filter((entry) => entry.direction === 'addition'), (entry) => entry.amount)
  const deductions = sum(approved.filter((entry) => entry.direction === 'deduction'), (entry) => entry.amount)
  const advanceLines = advances
    .filter((advance) => advance.employeeId === employee.id)
    .map((advance) => ({ advance, amount: advanceRecovery(advance, cycle.month) }))
    .filter((line) => line.amount > 0)
  const advance = sum(advanceLines, (line) => line.amount)
  const statutory = statutoryDeductions(employee, gross + additions - deductions)
  const statutoryTotal = sum(statutory, (line) => line.amount)
  return {
    employee,
    gross,
    additions,
    deductions,
    adjustments: additions - deductions,
    approvedAdjustments: approved,
    advance,
    advanceLines,
    statutory,
    statutoryTotal,
    net: gross + additions - deductions - advance - statutoryTotal,
  }
}

export function totals(slips) {
  return {
    staff: slips.length,
    gross: sum(slips, (slip) => slip.gross),
    additions: sum(slips, (slip) => slip.additions),
    deductions: sum(slips, (slip) => slip.deductions),
    adjustments: sum(slips, (slip) => slip.adjustments),
    advance: sum(slips, (slip) => slip.advance),
    statutory: sum(slips, (slip) => slip.statutoryTotal),
    net: sum(slips, (slip) => slip.net),
  }
}

export const branchSummary = (slips) =>
  PAYROLL_BRANCHES.map((branch) => ({ branch, ...totals(slips.filter((slip) => slip.employee.branchId === branch.id)) }))

export const inScope = (employee, scope) =>
  (!scope.branchIds.length || scope.branchIds.includes(employee.branchId)) &&
  (!scope.employment.length || scope.employment.includes(employee.employment))

// What must be resolved before the batch can be approved.
export function approvalBlockers({ employees, adjustments }) {
  const included = employees.filter((employee) => employee.included)
  const ids = new Set(included.map((employee) => employee.id))
  const blockers = []
  const review = included.filter((employee) => employee.status !== 'Ready')
  if (review.length) blockers.push(`${review.length} included staff ${review.length === 1 ? 'is' : 'are'} not marked ready`)
  const unverified = included.filter((employee) => !employee.bankVerified)
  if (unverified.length) blockers.push(`${unverified.length} included staff ${unverified.length === 1 ? 'has' : 'have'} unverified bank details`)
  const pending = adjustments.filter((entry) => ids.has(entry.employeeId) && entry.status === 'Pending approval')
  if (pending.length) blockers.push(`${pending.length} adjustment${pending.length === 1 ? '' : 's'} awaiting approval`)
  if (!included.length) blockers.push('No staff are included in this run')
  return blockers
}

// Monthly gross used for advance limits: the contract rate for salaried staff, this cycle's gross otherwise.
export const monthlyBase = (employee) => (employee.model === 'monthly' ? employee.rate : grossPay(employee))

// An employee's advance limit and how much of it is already used by open advances.
export function advanceExposure(employee, advances) {
  const open = advances.filter((advance) => advance.employeeId === employee.id && advance.status !== 'Settled')
  const outstanding = sum(open, (advance) => advanceProgress(advance).outstanding)
  const limit = monthlyBase(employee) * ADVANCE_LIMIT_MULTIPLE
  return { open, outstanding, limit, available: Math.max(limit - outstanding, 0) }
}

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
  const amount = Number(principal)
  const limit = monthlyBase(employee) * ADVANCE_LIMIT_MULTIPLE - outstanding
  if (!(amount > 0)) errors.principal = 'Enter an amount greater than zero.'
  else if (amount > limit) errors.principal = `Exceeds the available limit of ₹${Math.max(limit, 0).toLocaleString('en-IN')}.`
  if (!(Number(installments) >= 1 && Number(installments) <= 12)) errors.installments = 'Choose 1 to 12 instalments.'
  else if (amount > 0 && amount / Number(installments) > monthlyBase(employee) * RECOVERY_CAP) {
    errors.installments = `Each instalment must stay under ${RECOVERY_CAP * 100}% of monthly gross. Spread it over more months.`
  }
  if (isBlank(disbursalDate)) errors.disbursalDate = 'Pick a disbursal date.'
  if (isBlank(category)) errors.category = 'Choose a reason category.'
  return errors
}
