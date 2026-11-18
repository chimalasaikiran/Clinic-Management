import { formatDate, initialsOf } from '../patients/format'
import { ADJUSTMENT_STATUS, ADVANCE_STATUS, EMPLOYMENT, STAFF_STATUS } from './constants'
import { addMonths, daysInMonth, firstDay, installmentAmount, lastDay, monthLabel, sum } from './payrollLogic'

const stampLabel = (stamp) => (stamp ? `${formatDate(stamp.date)}, ${stamp.time}` : null)

// A run (open, or the latest processed one when none is open) in the shape the screens show.
function cycleView(source, status) {
  const days = daysInMonth(source.month)
  return {
    id: source.id, version: source.version, month: source.month, label: monthLabel(source.month), batchId: source.reference,
    start: formatDate(firstDay(source.month)), end: formatDate(lastDay(source.month)), days,
    cutoff: `${formatDate(lastDay(source.month))}, 23:59 IST`, payDate: source.payDate ? formatDate(source.payDate) : '—', payDateIso: source.payDate, status,
  }
}

// Repaid, outstanding and the instalment plan of an advance: recovered instalments from the payslips that took
// them, the one the open run takes, and the rest one a month after that.
function progressOf(advance, dueNow, cycleMonth) {
  const recovered = new Map(advance.recoveries.map((entry) => [entry.number, entry]))
  const repaid = sum(advance.recoveries, (entry) => entry.amount)
  let nextMonth = cycleMonth && cycleMonth >= advance.startMonth ? cycleMonth : advance.startMonth
  if (!dueNow && cycleMonth && advance.status === 'active' && cycleMonth >= advance.startMonth) nextMonth = addMonths(cycleMonth, 1)
  let closing = advance.principal
  const schedule = Array.from({ length: advance.installments }, (_, index) => {
    const number = index + 1
    const done = recovered.get(number)
    const amount = done?.amount ?? installmentAmount(advance.principal, advance.installments, number)
    closing = Math.round((closing - amount) * 100) / 100
    let month
    let state
    if (done) {
      month = done.month
      state = 'Recovered'
    } else if (dueNow?.number === number) {
      month = cycleMonth
      state = 'This cycle'
      nextMonth = addMonths(cycleMonth, 1)
    } else {
      month = nextMonth
      state = 'Upcoming'
      nextMonth = addMonths(nextMonth, 1)
    }
    return { number, month, label: monthLabel(month), dueDate: monthLabel(month), amount, closing, state }
  })
  const current = dueNow ? { number: dueNow.number, amount: dueNow.amount } : null
  return { schedule, repaid, outstanding: advance.outstanding, current, monthly: installmentAmount(advance.principal, advance.installments, 1) }
}

export function toPayrollState(data) {
  const open = data.cycle
  const latest = data.history[0] ?? null
  const shown = open ?? latest
  const lines = new Map((open?.lines ?? []).map((line) => [line.staffId, line]))
  const payslips = new Map((open ? [] : latest?.payslips ?? []).map((slip) => [slip.staffId, slip]))
  // The latest processed gross per person, the base for advance limits of anyone not on a monthly salary.
  const lastGross = new Map()
  for (const run of [...data.history].reverse()) for (const slip of run.payslips) lastGross.set(slip.staffId, slip.gross)

  const staff = data.staff.map((row) => {
    const profile = row.profile
    const line = lines.get(row.id)
    const slip = payslips.get(row.id)
    const model = profile?.model ?? null
    const quantity = line?.quantity ?? slip?.quantity ?? 0
    return {
      id: row.staffCode, uuid: row.id, name: row.name, initials: initialsOf(row.name), title: row.designation, department: row.department, branchId: row.branchId, staffStatus: row.status,
      profile, hasProfile: Boolean(profile?.active), employment: profile ? EMPLOYMENT[profile.employment] : '—', employmentId: profile?.employment ?? null, model, rate: profile?.rate ?? 0,
      bank: profile ? `${profile.bankName} •••• ${profile.accountLast4}` : 'No bank details', bankVerified: profile?.bankVerified ?? false,
      monthlyBase: !profile ? null : model === 'monthly' ? profile.rate : lastGross.get(row.id) ?? null,
      // This run's line.
      entryId: line?.entryId ?? slip?.entryId ?? null, entryVersion: line?.version ?? slip?.version ?? null,
      inRun: Boolean(line || slip), included: line ? line.included : Boolean(slip), inScope: line ? line.inScope : Boolean(slip),
      status: line ? STAFF_STATUS[line.status] : slip ? 'Ready' : '—', statusNote: line?.statusNote || undefined,
      quantity, paidDays: model === 'monthly' ? quantity : undefined, units: model === 'monthly' ? undefined : quantity,
      derived: line?.derived ?? null, entered: line?.entered ?? null, enteredReason: line?.enteredReason ?? null,
      volumeNote: line?.quantityNote ?? slip?.quantityNote ?? (profile ? '' : 'No pay profile'), issues: line?.issues ?? [], gross: line?.gross ?? slip?.gross ?? 0,
    }
  })
  const byUuid = new Map(staff.map((employee) => [employee.uuid, employee]))
  const code = (staffId) => byUuid.get(staffId)?.id ?? staffId

  const adjustments = data.adjustments.map((row) => ({
    id: row.reference, uuid: row.id, version: row.version, employeeId: code(row.staffId), month: row.month, direction: row.direction, category: row.category, label: row.label,
    amount: row.amount, reason: row.reason, reference: row.documentRef ?? undefined, status: ADJUSTMENT_STATUS[row.status], requestedBy: row.requestedBy,
    requestedOn: stampLabel(row.requested), decidedBy: row.decidedBy ?? undefined, comment: row.comment ?? undefined, appliedIn: row.appliedIn,
  }))
  const dueNow = new Map((open?.lines ?? []).flatMap((line) => (line.included && line.inScope ? line.advanceLines : [])).map((entry) => [entry.advanceId, entry]))
  const advances = data.advances.map((row) => ({
    id: row.reference, uuid: row.id, version: row.version, employeeId: code(row.staffId), principal: row.principal, installments: row.installments, startMonth: row.startMonth,
    source: row.source, category: row.category, method: row.method ?? undefined, notes: row.notes || undefined, status: ADVANCE_STATUS[row.status], statusId: row.status,
    approvedBy: row.approvedBy ?? undefined, disbursedOn: stampLabel(row.disbursed) ?? undefined, disbursalDate: row.disbursalDate, decisionNote: row.decisionNote ?? undefined,
    recoveries: row.recoveries, progress: progressOf(row, dueNow.get(row.id), open?.month ?? null),
  }))
  const adjustmentsById = new Map(data.adjustments.map((row, index) => [row.id, adjustments[index]]))
  const advancesById = new Map(data.advances.map((row, index) => [row.id, advances[index]]))

  const slipOf = (employee, figures, approvedAdjustments, advanceLines) => ({
    employee, gross: figures.gross, additions: figures.additions, deductions: figures.deductions, adjustments: Math.round((figures.additions - figures.deductions) * 100) / 100,
    approvedAdjustments, advance: figures.advance, advanceLines, statutory: figures.statutory, statutoryTotal: figures.statutoryTotal ?? sum(figures.statutory, (line) => line.amount), net: figures.net,
  })
  let slips = []
  if (open) {
    slips = open.lines.filter((line) => line.included && line.inScope).map((line) => slipOf(
      byUuid.get(line.staffId), line, line.adjustmentIds.map((id) => adjustmentsById.get(id)).filter(Boolean),
      line.advanceLines.map((entry) => ({ advance: advancesById.get(entry.advanceId), amount: entry.amount, number: entry.number })),
    ))
  } else if (latest) {
    slips = latest.payslips.map((payslip) => slipOf(
      byUuid.get(payslip.staffId) ?? { id: payslip.staffCode, name: payslip.name, initials: initialsOf(payslip.name), branchId: payslip.branchId },
      payslip, adjustments.filter((entry) => entry.appliedIn === latest.month && entry.employeeId === code(payslip.staffId)),
      advances.flatMap((advance) => advance.recoveries.filter((entry) => entry.month === latest.month && advance.employeeId === code(payslip.staffId)).map((entry) => ({ advance, amount: entry.amount, number: entry.number }))),
    ))
  }

  const history = data.history.map((run) => {
    const paid = run.payslips.filter((slip) => slip.paymentRef).length
    const branches = [...new Set(run.payslips.map((slip) => slip.branchId))].map((branchId) => {
      const rows = run.payslips.filter((slip) => slip.branchId === branchId)
      return { branchId, staff: rows.length, gross: sum(rows, (slip) => slip.gross), net: sum(rows, (slip) => slip.net) }
    })
    return {
      id: run.id, month: run.month, label: monthLabel(run.month), start: formatDate(firstDay(run.month)), end: formatDate(lastDay(run.month)), batchId: run.reference,
      payDate: run.payDate ? formatDate(run.payDate) : '—', employees: run.staff, gross: run.gross, adjustments: Math.round((run.additions - run.deductions) * 100) / 100,
      statutory: run.statutory, advances: run.advances, net: run.net, approvedBy: run.approvedBy, approvedOn: stampLabel(run.approved), processedBy: run.processedBy, processedOn: stampLabel(run.processed),
      status: paid === run.payslips.length ? 'Paid' : `${paid} of ${run.payslips.length} paid`, paid: paid === run.payslips.length, branches,
      payslips: run.payslips.map((slip) => ({ ...slip, employeeId: code(slip.staffId), paidOn: stampLabel(slip.paid) })),
    }
  })

  const cycle = shown ? cycleView(shown, open ? open.status : 'processed') : null
  const batch = !shown ? { status: 'None' }
    : open ? { status: open.status === 'approved' ? 'Approved' : 'Draft', approvedBy: open.approvedBy, approvedOn: stampLabel(open.approved) }
      : { status: 'Processed', approvedBy: latest.approvedBy, approvedOn: stampLabel(latest.approved), processedOn: stampLabel(latest.processed) }

  return {
    today: data.today,
    settings: data.settings,
    branches: data.branches,
    staff,
    cycle,
    batch,
    open: Boolean(open),
    scope: open ? { branchIds: open.scope.branchIds, employment: open.scope.employment.map((id) => EMPLOYMENT[id]) } : { branchIds: [], employment: [] },
    blockers: open?.blockers ?? [],
    slips,
    adjustments,
    advances,
    history,
    activity: data.activity.map((row) => ({ id: row.id, title: row.action, meta: `${row.actor} · ${stampLabel(row.at)}${row.note ? ` · ${row.note}` : ''}` })),
  }
}
