// Payroll arithmetic, kept free of the database so every rule can be tested on its own. Amounts are whole paise
// and rates basis points (1200 = 12%).

export type Employment = 'full_time' | 'part_time' | 'contract_locum' | 'consultant'
export type PayModel = 'monthly' | 'visit' | 'shift' | 'hourly'

export interface PtSlab {
  // The slab applies when the month's gross is above this amount.
  above: number
  amount: number
}

export interface StatutoryRules {
  epfEnabled: boolean
  epfRateBp: number
  epfCap: number
  esicEnabled: boolean
  esicRateBp: number
  esicCeiling: number
  ptEnabled: boolean
  ptState: string
  ptSlabs: PtSlab[]
  tdsEnabled: boolean
  tdsRateBp: number
}

// Telangana professional tax: ₹150 above ₹15,000 a month, ₹200 above ₹20,000.
export const DEFAULT_PT_SLABS: PtSlab[] = [
  { above: 1_500_000, amount: 15_000 },
  { above: 2_000_000, amount: 20_000 },
]

export interface StatutoryLine {
  code: 'epf' | 'esic' | 'pt' | 'tds'
  label: string
  amount: number
}

const ofRate = (paise: number, rateBp: number) => Math.round((paise * rateBp) / 10_000)
const percent = (rateBp: number) => `${rateBp / 100}%`
const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

// Consultants and contract locums are paid professional fees: TDS is withheld (Sec 194J) instead of EPF, ESIC and PT.
export const isContractor = (employment: Employment) => employment === 'consultant' || employment === 'contract_locum'

export function professionalTax(slabs: PtSlab[], gross: number) {
  const slab = [...slabs].sort((a, b) => b.above - a.above).find((entry) => gross > entry.above)
  return slab?.amount ?? 0
}

export function statutoryLines(rules: StatutoryRules, employment: Employment, gross: number): StatutoryLine[] {
  if (gross <= 0) return []
  if (isContractor(employment)) {
    return rules.tdsEnabled ? [{ code: 'tds', label: `TDS (Sec 194J, ${percent(rules.tdsRateBp)})`, amount: ofRate(gross, rules.tdsRateBp) }] : []
  }
  const lines: StatutoryLine[] = []
  if (rules.epfEnabled) {
    const epf = ofRate(gross, rules.epfRateBp)
    const capped = rules.epfCap > 0 ? Math.min(epf, rules.epfCap) : epf
    lines.push({ code: 'epf', label: `EPF (${percent(rules.epfRateBp)}${rules.epfCap > 0 ? `, capped at ${inr(rules.epfCap)}` : ''})`, amount: capped })
  }
  if (rules.ptEnabled) {
    const pt = professionalTax(rules.ptSlabs, gross)
    if (pt > 0) lines.push({ code: 'pt', label: `Professional tax (${rules.ptState})`, amount: pt })
  }
  if (rules.esicEnabled && gross <= rules.esicCeiling) lines.push({ code: 'esic', label: `ESIC (${percent(rules.esicRateBp)})`, amount: ofRate(gross, rules.esicRateBp) })
  return lines.filter((line) => line.amount > 0)
}

// ── months ──

export const isMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

export function addMonths(month: string, count: number) {
  const [year, index] = month.split('-').map(Number) as [number, number]
  const total = year * 12 + index - 1 + count
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function daysInMonth(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, index, 0)).getUTCDate()
}

export const firstDay = (month: string) => `${month}-01`
export const lastDay = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`

// Salaries for a month are paid on `payDay` of the following month.
export const payDateFor = (month: string, payDay: number) => `${addMonths(month, 1)}-${String(payDay).padStart(2, '0')}`

// ── inputs ──

export interface AttendanceDay {
  date: string
  status: 'present' | 'late' | 'absent' | 'leave' | 'unavailable'
}

// One person's month from attendance. A person working at two branches can have two records on a date; the day
// counts as worked if either says so. Only absences reduce paid days: leave is paid, and unpaid leave is entered
// as a deduction. Days without a record are paid but reported, so the reviewer can see the gaps.
export function attendanceSummary(month: string, records: AttendanceDay[]) {
  const RANK = { present: 4, late: 3, leave: 2, unavailable: 1, absent: 0 } as const
  const byDate = new Map<string, AttendanceDay['status']>()
  for (const record of records) {
    const current = byDate.get(record.date)
    if (current === undefined || RANK[record.status] > RANK[current]) byDate.set(record.date, record.status)
  }
  const counts = { present: 0, late: 0, absent: 0, leave: 0, unavailable: 0 }
  for (const status of byDate.values()) counts[status] += 1
  const days = daysInMonth(month)
  const unrecorded = days - byDate.size
  return { days, ...counts, unrecorded, paidDays: days - counts.absent }
}

export function attendanceNote(summary: ReturnType<typeof attendanceSummary>) {
  const parts = [`${summary.present + summary.late} days present`]
  if (summary.leave) parts.push(`${summary.leave} days leave`)
  if (summary.absent) parts.push(`${summary.absent} days absent`)
  if (summary.unavailable) parts.push(`${summary.unavailable} days off roster`)
  if (summary.unrecorded) parts.push(`${summary.unrecorded} days not recorded`)
  return parts.join(' · ')
}

export const UNIT_LABELS: Record<PayModel, string> = { monthly: 'paid days', visit: 'completed visits', shift: 'shifts', hourly: 'hours' }

// ── pay ──

export function grossPay(model: PayModel, rate: number, quantity: number, days: number) {
  if (model === 'monthly') return Math.round((rate * Math.min(quantity, days)) / days)
  return rate * quantity
}

// Equal instalments in rupees; the last one takes the remainder, so the instalments add up to the principal.
export function installmentAmount(principal: number, installments: number, number: number) {
  const base = Math.floor(principal / installments / 100) * 100
  return number === installments ? principal - base * (installments - 1) : base
}

export interface AdvanceForRecovery {
  id: string
  status: string
  principal: number
  installments: number
  startMonth: string
  recovered: Array<{ number: number; amount: number }>
}

// The instalment due from an advance in a month: the next unpaid one, once the advance is active and its first
// instalment month has come. One instalment per cycle, so a missed month moves the schedule on by a month.
export function dueInstalment(advance: AdvanceForRecovery, month: string) {
  if (advance.status !== 'active' || advance.startMonth > month) return null
  const number = advance.recovered.length + 1
  if (number > advance.installments) return null
  return { advanceId: advance.id, number, amount: installmentAmount(advance.principal, advance.installments, number) }
}

export function advanceSchedule(advance: AdvanceForRecovery) {
  const paid = new Map(advance.recovered.map((entry) => [entry.number, entry]))
  return Array.from({ length: advance.installments }, (_, index) => {
    const number = index + 1
    return { number, amount: installmentAmount(advance.principal, advance.installments, number), recovered: paid.has(number) }
  })
}

export interface PayslipInput {
  model: PayModel
  employment: Employment
  rate: number
  quantity: number
  days: number
  adjustments: Array<{ direction: string; amount: number }>
  advances: Array<{ amount: number }>
  rules: StatutoryRules
}

// Statutory deductions are worked out on gross after approved adjustments; advance recoveries come off last.
export function payslip(input: PayslipInput) {
  const gross = grossPay(input.model, input.rate, input.quantity, input.days)
  const additions = input.adjustments.filter((entry) => entry.direction === 'addition').reduce((sum, entry) => sum + entry.amount, 0)
  const deductions = input.adjustments.filter((entry) => entry.direction === 'deduction').reduce((sum, entry) => sum + entry.amount, 0)
  const statutory = statutoryLines(input.rules, input.employment, gross + additions - deductions)
  const statutoryTotal = statutory.reduce((sum, line) => sum + line.amount, 0)
  const advance = input.advances.reduce((sum, entry) => sum + entry.amount, 0)
  return { gross, additions, deductions, statutory, statutoryTotal, advance, net: gross + additions - deductions - statutoryTotal - advance }
}
