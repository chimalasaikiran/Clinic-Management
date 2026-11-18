import { ApiError } from '../../lib/api'
import { localToday } from '../../features/patients/format'
import { addMonths, daysInMonth, installmentAmount, statutoryLines } from '../../features/payroll/payrollLogic'

// An in-memory stand-in for the payroll API (backend/src/modules/payroll), for page tests. It returns state in the
// API's shape, so the screens go through the production adapters, and applies the main server rules: figures from
// the records (given per person here as `derived`), approved adjustments, the instalment due from active advances,
// statutory lines, blockers, approval withdrawn on change, and processing into payslips. The real rules are tested
// against the database in backend/test/integration/payroll.test.ts.

const clone = (value) => JSON.parse(JSON.stringify(value))
const pad = (value) => String(value).padStart(6, '0')
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100
const fail = (status, code, message, details = []) => {
  throw new ApiError(status, code, message, details)
}
const stamp = (date, time = '09:00') => ({ date, time, at: `${date}T${time}:00.000Z` })

export const BRANCH = { main: 'b-main', west: 'b-west' }
export const STAFF = { ananya: 's-ananya', ravi: 's-ravi', priya: 's-priya', ramesh: 's-ramesh', meera: 's-meera' }

const profile = (id, employment, model, rate, bankName, accountLast4, bankVerified = true) => ({ id, employment, model, rate, bankName, ifsc: 'HDFC0001234', accountLast4, bankVerified, bankVerifiedBy: bankVerified ? 'Siddharth Verma' : null, active: true, version: 1 })
const person = (id, staffCode, name, designation, department, branchId, pay) => ({ id, staffCode, name, designation, department, status: 'active', branchId, profile: pay })

// The open run is for last month and the processed one for the month before.
export function payrollSeed({ open = true } = {}) {
  const today = localToday()
  const month = addMonths(today.slice(0, 7), -1)
  const previous = addMonths(month, -1)
  const days = daysInMonth(month)
  return {
    today,
    month,
    previous,
    settings: { epfEnabled: true, epfRate: 12, epfCap: 1800, esicEnabled: true, esicRate: 0.75, esicCeiling: 21000, ptEnabled: true, ptState: 'Telangana', ptSlabs: [{ above: 15000, amount: 150 }, { above: 20000, amount: 200 }], tdsEnabled: true, tdsRate: 10, payDay: 5, version: 1 },
    branches: [{ id: BRANCH.main, name: 'Main Clinic', code: 'MAIN' }, { id: BRANCH.west, name: 'West Wing', code: 'WEST' }],
    staff: [
      person(STAFF.ananya, 'STF-001', 'Dr. Ananya Rao', 'Senior Physiotherapist', 'Physiotherapy', BRANCH.main, profile('pp-ananya', 'full_time', 'monthly', 85000, 'HDFC Bank', '4421')),
      person(STAFF.ravi, 'STF-002', 'Dr. Ravi Kumar', 'Visiting Consultant', 'Orthopedics', BRANCH.west, profile('pp-ravi', 'consultant', 'visit', 1500, 'ICICI Bank', '1180')),
      person(STAFF.priya, 'STF-003', 'Priya Sharma', 'Front Desk Lead', 'Reception', BRANCH.main, profile('pp-priya', 'full_time', 'monthly', 32000, 'SBI', '7702')),
      person(STAFF.ramesh, 'STF-004', 'Ramesh Kumar', 'Lab Technician', 'Diagnostics', BRANCH.west, profile('pp-ramesh', 'contract_locum', 'shift', 2500, 'Axis Bank', '3390', false)),
      person(STAFF.meera, 'STF-005', 'Meera Joshi', 'Care Coordinator', 'Operations', BRANCH.main, null),
    ],
    // Paid days or units the records give for the open run.
    derived: { [STAFF.ananya]: days, [STAFF.ravi]: 24, [STAFF.priya]: days - 4 },
    notes: { [STAFF.ananya]: `${days} days present`, [STAFF.ravi]: '24 completed appointments', [STAFF.priya]: `${days - 4} days present · 4 days absent` },
    cycle: open ? {
      id: 'cyc-open', reference: `PAY-${month}`, month, status: 'draft', payDate: `${addMonths(month, 1)}-05`, version: 1, scope: { branchIds: [], employment: [] },
      createdBy: 'Siddharth Verma', created: stamp(today), approvedBy: null, approved: null,
      entries: [
        { entryId: 'pe-ananya', staffId: STAFF.ananya, included: true, status: 'ready', statusNote: '', entered: null, enteredReason: null, version: 1 },
        { entryId: 'pe-ravi', staffId: STAFF.ravi, included: true, status: 'ready', statusNote: '', entered: null, enteredReason: null, version: 1 },
        { entryId: 'pe-priya', staffId: STAFF.priya, included: true, status: 'needs_review', statusNote: 'Confirm 4 days absent', entered: null, enteredReason: null, version: 1 },
        { entryId: 'pe-ramesh', staffId: STAFF.ramesh, included: true, status: 'needs_review', statusNote: 'Enter the shifts worked', entered: null, enteredReason: null, version: 1 },
      ],
    } : null,
    history: [{
      id: 'cyc-prev', reference: `PAY-${previous}`, month: previous, payDate: `${month}-05`, approvedBy: 'Siddharth Verma', approved: stamp(`${month}-02`), processedBy: 'Siddharth Verma', processed: stamp(`${month}-03`),
      staff: 2, gross: 121000, additions: 0, deductions: 0, statutory: 5600, advances: 10000, net: 105400,
      payslips: [
        { entryId: 'pe-prev-ananya', payslipRef: 'PSL-000001', staffId: STAFF.ananya, name: 'Dr. Ananya Rao', staffCode: 'STF-001', branchId: BRANCH.main, employment: 'full_time', model: 'monthly', rate: 85000, quantity: 30, quantityNote: '30 days present', gross: 85000, additions: 0, deductions: 0, statutory: [{ code: 'epf', label: 'EPF (12%, capped at ₹1,800)', amount: 1800 }, { code: 'pt', label: 'Professional tax (Telangana)', amount: 200 }], advance: 10000, net: 73000, paymentRef: 'UTR-HDFC-1001', paid: stamp(`${month}-05`), paidBy: 'Siddharth Verma', version: 2 },
        { entryId: 'pe-prev-ravi', payslipRef: 'PSL-000002', staffId: STAFF.ravi, name: 'Dr. Ravi Kumar', staffCode: 'STF-002', branchId: BRANCH.west, employment: 'consultant', model: 'visit', rate: 1500, quantity: 24, quantityNote: '24 completed appointments', gross: 36000, additions: 0, deductions: 0, statutory: [{ code: 'tds', label: 'TDS (Sec 194J, 10%)', amount: 3600 }], advance: 0, net: 32400, paymentRef: null, paid: null, paidBy: null, version: 1 },
      ],
    }],
    adjustments: [
      { id: 'adj-1', reference: 'PAD-000001', staffId: STAFF.ravi, month, direction: 'addition', category: 'Performance incentive', label: 'Service surge incentive', amount: 1500, reason: 'Completed 24 verified encounters against a baseline of 20.', documentRef: null, status: 'pending', requestedBy: 'Siddharth Verma', requested: stamp(today), decidedBy: null, decided: null, comment: null, appliedIn: null, version: 1 },
      { id: 'adj-2', reference: 'PAD-000002', staffId: STAFF.ananya, month, direction: 'addition', category: 'Travel allowance', label: 'Home visit travel', amount: 5400, reason: '18 home visits at ₹300 per visit.', documentRef: null, status: 'approved', requestedBy: 'Siddharth Verma', requested: stamp(today), decidedBy: 'Siddharth Verma', decided: stamp(today), comment: null, appliedIn: null, version: 2 },
    ],
    advances: [
      { id: 'adv-1', reference: 'ADV-000001', staffId: STAFF.ananya, principal: 60000, installments: 6, startMonth: previous, source: 'Admin created', category: 'Personal emergency / relocation', method: 'Bank transfer (NEFT)', disbursalDate: `${previous}-01`, notes: '', status: 'active', decisionNote: null, createdBy: 'Siddharth Verma', created: stamp(`${previous}-01`), approvedBy: 'Siddharth Verma', disbursed: stamp(`${previous}-01`), acknowledged: stamp(`${previous}-02`), recoveries: [{ number: 1, amount: 10000, month: previous }], version: 4 },
      { id: 'adv-2', reference: 'ADV-000002', staffId: STAFF.priya, principal: 15000, installments: 3, startMonth: addMonths(month, 1), source: 'Employee request', category: 'Medical emergency', method: null, disbursalDate: null, notes: '', status: 'pending_approval', decisionNote: null, createdBy: 'Siddharth Verma', created: stamp(today), approvedBy: null, disbursed: null, acknowledged: null, recoveries: [], version: 1 },
    ],
    activity: [{ id: 'ev-1', action: 'Payroll run started', note: month, actor: 'Siddharth Verma', at: stamp(today) }],
  }
}

export function createPayrollApi(seed = payrollSeed()) {
  const state = clone(seed)
  const calls = []
  const counters = { adjustment: state.adjustments.length + 10, advance: state.advances.length + 10, payslip: 10 }
  const log = (action, note = '') => state.activity.unshift({ id: `ev-${state.activity.length + 1}`, action, note, actor: 'Siddharth Verma', at: stamp(state.today) })
  const staffOf = (id) => state.staff.find((row) => row.id === id) ?? fail(404, 'NOT_FOUND', 'Staff member not found.')
  const withdraw = (why) => {
    if (state.cycle?.status !== 'approved') return
    Object.assign(state.cycle, { status: 'draft', approvedBy: null, approved: null })
    state.cycle.version += 1
    log('Approval withdrawn', why)
  }

  const lineOf = (entry, cycle) => {
    const person = staffOf(entry.staffId)
    const pay = person.profile?.active ? person.profile : null
    const derived = pay && (pay.model === 'monthly' || pay.model === 'visit') ? state.derived[entry.staffId] ?? 0 : null
    const quantity = entry.entered ?? derived ?? 0
    const days = daysInMonth(cycle.month)
    const gross = !pay ? 0 : pay.model === 'monthly' ? round2((pay.rate * Math.min(quantity, days)) / days) : pay.rate * quantity
    const own = state.adjustments.filter((row) => row.staffId === entry.staffId && row.status === 'approved' && !row.appliedIn && row.month <= cycle.month)
    const additions = own.filter((row) => row.direction === 'addition').reduce((sum, row) => sum + row.amount, 0)
    const deductions = own.filter((row) => row.direction === 'deduction').reduce((sum, row) => sum + row.amount, 0)
    const statutory = pay ? statutoryLines(state.settings, pay.employment, gross + additions - deductions) : []
    const statutoryTotal = statutory.reduce((sum, line) => sum + line.amount, 0)
    const advanceLines = state.advances.filter((row) => row.staffId === entry.staffId && row.status === 'active' && row.startMonth <= cycle.month && row.recoveries.length < row.installments)
      .map((row) => ({ advanceId: row.id, number: row.recoveries.length + 1, amount: installmentAmount(row.principal, row.installments, row.recoveries.length + 1) }))
    const advance = advanceLines.reduce((sum, line) => sum + line.amount, 0)
    const net = round2(gross + additions - deductions - statutoryTotal - advance)
    const unit = pay?.model === 'shift' ? 'shifts' : 'hours'
    const issues = []
    if (!pay) issues.push('No active pay profile')
    else {
      if (!pay.bankVerified) issues.push('Bank details not verified')
      if ((pay.model === 'shift' || pay.model === 'hourly') && entry.entered === null) issues.push(`Enter the ${unit} worked`)
    }
    if (entry.status !== 'ready') issues.push(entry.status === 'on_hold' ? 'On hold' : 'Not marked ready')
    const inScope = Boolean(pay) && (!cycle.scope.branchIds.length || cycle.scope.branchIds.includes(person.branchId)) && (!cycle.scope.employment.length || cycle.scope.employment.includes(pay.employment))
    const quantityNote = entry.entered !== null ? `${entry.entered} ${pay?.model === 'monthly' ? 'paid days' : pay?.model === 'visit' ? 'completed visits' : unit} entered${entry.enteredReason ? ` · ${entry.enteredReason}` : ''}`
      : pay && (pay.model === 'shift' || pay.model === 'hourly') ? `Enter the ${unit} worked` : state.notes[entry.staffId] ?? ''
    return {
      ...entry, inScope, branchId: person.branchId, employment: pay?.employment ?? null, model: pay?.model ?? null, rate: pay?.rate ?? null, bankVerified: pay?.bankVerified ?? false,
      derived, quantity, quantityNote, gross, additions, deductions, adjustmentIds: own.map((row) => row.id), statutory, statutoryTotal, advanceLines, advance, net, issues,
    }
  }
  const lines = () => state.cycle.entries.map((entry) => lineOf(entry, state.cycle))
  const blockers = (all) => {
    const payable = all.filter((line) => line.included && line.inScope)
    const found = [...new Set(payable.flatMap((line) => line.issues))].map((issue) => `${payable.filter((line) => line.issues.includes(issue)).length} included staff · ${issue.toLowerCase()}`)
    const pending = state.adjustments.filter((row) => row.status === 'pending' && row.month <= state.cycle.month && payable.some((line) => line.staffId === row.staffId)).length
    if (pending) found.push(`${pending} adjustment${pending === 1 ? '' : 's'} awaiting approval`)
    if (!payable.length) found.push('No staff are included in this run')
    return found
  }
  const entryOf = (id) => state.cycle?.entries.find((entry) => entry.entryId === id) ?? fail(404, 'NOT_FOUND', 'Payroll line not found.')
  const openCycle = (id) => {
    if (!state.cycle || state.cycle.id !== id) fail(404, 'NOT_FOUND', 'Payroll cycle not found.')
    return state.cycle
  }
  const record = (name, body) => calls.push({ name, body: clone(body ?? null) })

  const api = {
    async state() {
      const cycle = state.cycle && (() => {
        const all = lines()
        const rest = Object.fromEntries(Object.entries(state.cycle).filter(([key]) => key !== 'entries'))
        return { ...rest, lines: all, blockers: state.cycle.status === 'draft' ? blockers(all) : [] }
      })()
      const advances = state.advances.map((row) => {
        const recovered = row.recoveries.reduce((sum, entry) => sum + entry.amount, 0)
        return { ...row, recovered, outstanding: row.status === 'rejected' ? 0 : round2(row.principal - recovered) }
      })
      return clone({ today: state.today, settings: state.settings, branches: state.branches, staff: state.staff, cycle, history: state.history, adjustments: state.adjustments, advances, activity: state.activity.slice(0, 40) })
    },

    async saveSettings(body) {
      record('saveSettings', body)
      if (body.version !== state.settings.version) fail(409, 'STALE_RECORD', 'Payroll settings were changed by someone else. Reload them and try again.')
      state.settings = { ...body, version: (state.settings.version ?? 0) + 1 }
      log('Payroll settings saved')
      withdraw('Payroll settings changed')
    },
    async createProfile(body) {
      record('createProfile', body)
      const person = staffOf(body.staffId)
      if (person.profile) fail(409, 'PROFILE_EXISTS', `${person.name} already has a pay profile. Edit it instead.`)
      const { staffId, ...rest } = body
      person.profile = { id: `pp-${staffId}`, ...rest, bankVerified: false, bankVerifiedBy: null, version: 1 }
      if (state.cycle) {
        state.cycle.entries.push({ entryId: `pe-${staffId}`, staffId, included: true, status: 'needs_review', statusNote: 'Pay profile added during the run', entered: null, enteredReason: null, version: 1 })
        withdraw(`${person.name} added to the run`)
      }
      log('Pay profile created', person.name)
      return { id: person.profile.id }
    },
    async updateProfile(id, body) {
      record('updateProfile', { id, ...body })
      const person = state.staff.find((row) => row.profile?.id === id) ?? fail(404, 'NOT_FOUND', 'Pay profile not found.')
      if (person.profile.version !== body.version) fail(409, 'STALE_RECORD', 'This pay profile was changed by someone else. Reload it and try again.')
      const { version, ...rest } = body
      const bankChanged = ['bankName', 'ifsc', 'accountLast4'].some((key) => person.profile[key] !== rest[key])
      Object.assign(person.profile, rest, bankChanged ? { bankVerified: false, bankVerifiedBy: null } : {}, { version: version + 1 })
      withdraw(`${person.name}'s pay profile changed`)
    },
    async verifyBank(id, version) {
      record('verifyBank', { id, version })
      const person = state.staff.find((row) => row.profile?.id === id) ?? fail(404, 'NOT_FOUND', 'Pay profile not found.')
      if (person.profile.bankVerified) fail(409, 'BANK_VERIFIED', 'These bank details are already verified.')
      Object.assign(person.profile, { bankVerified: true, bankVerifiedBy: 'Siddharth Verma', version: version + 1 })
      log('Bank details verified', person.name)
    },

    async startCycle(month) {
      record('startCycle', { month })
      if (state.cycle) fail(409, 'CYCLE_OPEN', `The ${state.cycle.month} run is still open. Process it before starting another.`)
      if (state.history.some((run) => run.month === month)) fail(409, 'CYCLE_EXISTS', `A payroll run for ${month} already exists.`)
      state.cycle = {
        id: `cyc-${month}`, reference: `PAY-${month}`, month, status: 'draft', payDate: `${addMonths(month, 1)}-05`, version: 1, scope: { branchIds: [], employment: [] },
        createdBy: 'Siddharth Verma', created: stamp(state.today), approvedBy: null, approved: null,
        entries: state.staff.filter((row) => row.profile?.active).map((row) => ({ entryId: `pe-${month}-${row.id}`, staffId: row.id, included: true, status: row.profile.model === 'shift' || row.profile.model === 'hourly' ? 'needs_review' : 'ready', statusNote: '', entered: null, enteredReason: null, version: 1 })),
      }
      log('Payroll run started', month)
      return { id: state.cycle.id }
    },
    async setScope(id, body) {
      record('setScope', { id, ...body })
      const cycle = openCycle(id)
      if (cycle.version !== body.version) fail(409, 'STALE_RECORD', 'This payroll run was changed by someone else. Reload it and try again.')
      cycle.scope = { branchIds: body.branchIds, employment: body.employment }
      withdraw('Run scope changed')
      cycle.version += 1
    },
    async include(id, entryIds, included) {
      record('include', { id, entryIds, included })
      openCycle(id)
      for (const entryId of entryIds) Object.assign(entryOf(entryId), { included })
      for (const entryId of entryIds) entryOf(entryId).version += 1
      withdraw('Staff included or excluded')
    },
    async updateEntry(id, body) {
      record('updateEntry', { id, ...body })
      const entry = entryOf(id)
      if (entry.version !== body.version) fail(409, 'STALE_RECORD', 'This line was changed by someone else. Reload it and try again.')
      const model = staffOf(entry.staffId).profile?.model
      if (body.entered !== undefined) {
        if (body.entered !== null && (model === 'monthly' || model === 'visit') && (body.enteredReason ?? '').trim().length < 3) fail(422, 'REASON_REQUIRED', 'Give the reason for changing the figure from the records.')
        Object.assign(entry, { entered: body.entered, enteredReason: body.entered === null ? null : body.enteredReason || null })
      }
      if (body.status !== undefined) Object.assign(entry, { status: body.status, statusNote: body.statusNote ?? (body.status === 'ready' ? '' : entry.statusNote) })
      entry.version += 1
      withdraw('A payroll line changed')
    },
    async approve(id, version) {
      record('approve', { id, version })
      const cycle = openCycle(id)
      if (cycle.status !== 'draft') fail(409, 'CYCLE_NOT_DRAFT', 'This run is already approved.')
      const found = blockers(lines())
      if (found.length) fail(409, 'RUN_BLOCKED', 'Resolve these before approving the run.', found.map((issue) => ({ issue })))
      Object.assign(cycle, { status: 'approved', approvedBy: 'Siddharth Verma', approved: stamp(state.today, '10:00'), version: cycle.version + 1 })
      log('Payroll run approved')
    },
    async process(id, version) {
      record('process', { id, version })
      const cycle = openCycle(id)
      if (cycle.status !== 'approved') fail(409, 'CYCLE_NOT_APPROVED', 'Approve the run before processing it.')
      const payable = lines().filter((line) => line.included && line.inScope)
      const payslips = payable.map((line) => {
        counters.payslip += 1
        for (const adjustmentId of line.adjustmentIds) Object.assign(state.adjustments.find((row) => row.id === adjustmentId), { appliedIn: cycle.month })
        for (const recovery of line.advanceLines) {
          const advance = state.advances.find((row) => row.id === recovery.advanceId)
          advance.recoveries.push({ number: recovery.number, amount: recovery.amount, month: cycle.month })
          if (recovery.number === advance.installments) advance.status = 'settled'
        }
        const person = staffOf(line.staffId)
        return {
          entryId: line.entryId, payslipRef: `PSL-${pad(counters.payslip)}`, staffId: line.staffId, name: person.name, staffCode: person.staffCode, branchId: line.branchId, employment: line.employment,
          model: line.model, rate: line.rate, quantity: line.quantity, quantityNote: line.quantityNote, gross: line.gross, additions: line.additions, deductions: line.deductions,
          statutory: line.statutory, advance: line.advance, net: line.net, paymentRef: null, paid: null, paidBy: null, version: line.version + 1,
        }
      })
      const add = (pick) => round2(payslips.reduce((sum, slip) => sum + pick(slip), 0))
      state.history.unshift({
        id: cycle.id, reference: cycle.reference, month: cycle.month, payDate: cycle.payDate, approvedBy: cycle.approvedBy, approved: cycle.approved, processedBy: 'Siddharth Verma', processed: stamp(state.today, '11:00'),
        staff: payslips.length, gross: add((slip) => slip.gross), additions: add((slip) => slip.additions), deductions: add((slip) => slip.deductions),
        statutory: add((slip) => slip.statutory.reduce((sum, line) => sum + line.amount, 0)), advances: add((slip) => slip.advance), net: add((slip) => slip.net), payslips,
      })
      state.cycle = null
      log('Payroll run processed', `${payslips.length} payslips`)
      return { payslips: payslips.length }
    },
    async recordPayment(id, body) {
      record('recordPayment', { id, ...body })
      const slip = state.history.flatMap((run) => run.payslips).find((entry) => entry.entryId === id) ?? fail(404, 'NOT_FOUND', 'Payslip not found.')
      if (slip.paymentRef) fail(409, 'PAYMENT_RECORDED', `A payment is already recorded for ${slip.name}: ${slip.paymentRef}.`)
      Object.assign(slip, { paymentRef: body.reference, paid: stamp(state.today, '12:00'), paidBy: 'Siddharth Verma', version: slip.version + 1 })
      log('Salary payment recorded', `${slip.name} · ${body.reference}`)
    },

    async createAdjustment(body) {
      record('createAdjustment', body)
      const person = staffOf(body.staffId)
      counters.adjustment += 1
      const reference = `PAD-${pad(counters.adjustment)}`
      state.adjustments.unshift({
        id: `adj-${counters.adjustment}`, reference, staffId: person.id, month: body.month, direction: body.direction, category: body.category, label: body.label || body.category, amount: body.amount,
        reason: body.reason, documentRef: body.documentRef ?? null, status: 'pending', requestedBy: 'Siddharth Verma', requested: stamp(state.today), decidedBy: null, decided: null, comment: null, appliedIn: null, version: 1,
      })
      log('Adjustment logged', reference)
      withdraw(`${reference} awaits approval`)
      return { id: `adj-${counters.adjustment}`, reference }
    },
    async decideAdjustments(body) {
      record('decideAdjustments', body)
      const rows = body.ids.map((id) => state.adjustments.find((row) => row.id === id))
      if (rows.some((row) => !row || row.status !== 'pending')) fail(409, 'ADJUSTMENT_DECIDED', 'One of these adjustments was already decided or not found. Reload and try again.')
      for (const row of rows) Object.assign(row, { status: body.decision, decidedBy: 'Siddharth Verma', decided: stamp(state.today), comment: body.comment || null, version: row.version + 1 })
      withdraw('Adjustments decided')
    },
    async createAdvance(body) {
      record('createAdvance', body)
      const person = staffOf(body.staffId)
      counters.advance += 1
      const reference = `ADV-${pad(counters.advance)}`
      state.advances.unshift({
        id: `adv-${counters.advance}`, reference, staffId: person.id, principal: body.principal, installments: body.installments, startMonth: body.startMonth, source: body.source, category: body.category,
        method: body.method, disbursalDate: body.disbursalDate, notes: body.notes, status: body.source === 'Admin created' ? 'pending_disbursal' : 'pending_approval', decisionNote: null,
        createdBy: 'Siddharth Verma', created: stamp(state.today), approvedBy: body.source === 'Admin created' ? 'Siddharth Verma' : null, disbursed: null, acknowledged: null, recoveries: [], version: 1,
      })
      log('Employee advance created', reference)
      return { id: `adv-${counters.advance}`, reference }
    },
    async advanceAction(id, body) {
      record('advanceAction', { id, ...body })
      const advance = state.advances.find((row) => row.id === id) ?? fail(404, 'NOT_FOUND', 'Advance not found.')
      const steps = { approve: ['pending_approval', 'pending_disbursal'], reject: ['pending_approval', 'rejected'], disburse: ['pending_disbursal', 'awaiting_acknowledgement'], acknowledge: ['awaiting_acknowledgement', 'active'] }
      const [from, to] = steps[body.action]
      if (advance.status !== from) fail(409, 'ADVANCE_STATUS', 'This advance cannot take that step now.')
      Object.assign(advance, { status: to, version: advance.version + 1 }, body.action === 'approve' && { approvedBy: 'Siddharth Verma' }, body.action === 'disburse' && { disbursed: stamp(state.today) }, body.action === 'reject' && { decisionNote: body.note })
      if (body.action === 'acknowledge') withdraw(`${advance.reference} is now recovered from pay`)
    },
  }
  return { api, state, calls }
}
