import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { OWNER } from '../../../config/workspace'
import { ACTIVITY, ADJUSTMENTS, ADVANCE_STATUSES, ADVANCES, CURRENT_CYCLE, CYCLE_HISTORY, EMPLOYEES } from '../data/seed'
import { branchSummary, inScope, payslip, totals } from '../payrollLogic'
import { PayrollContext } from './payrollContext'

const now = () => new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const nextId = (prefix, list) => {
  const highest = Math.max(0, ...list.map((entry) => Number(entry.id.split('-').at(-1))))
  return `${prefix}-${String(highest + 1).padStart(prefix === 'ADV-2026' ? 4 : 3, '0')}`
}

// Holds the current payroll run in memory so every step of the run sees the same batch.
// It is replaced by API calls once the payroll backend exists.
export default function PayrollProvider({ children }) {
  const [employees, setEmployees] = useState(() => EMPLOYEES.map((employee) => ({ ...employee, included: employee.status !== 'On hold' })))
  const [adjustments, setAdjustments] = useState(ADJUSTMENTS)
  const [advances, setAdvances] = useState(ADVANCES)
  const [scope, setScope] = useState({ branchIds: [], employment: [] })
  const [batch, setBatch] = useState({ status: 'Draft' })
  const [activity, setActivity] = useState(ACTIVITY)
  const [history, setHistory] = useState(CYCLE_HISTORY)

  const log = useCallback((title) => setActivity((current) => [{ id: `a${Date.now()}${current.length}`, title, meta: `${OWNER.name} · ${now()}` }, ...current]), [])

  // Any change to the batch after approval sends it back for approval.
  const reopen = useCallback(() => setBatch((current) => (current.status === 'Approved' ? { status: 'Draft' } : current)), [])

  const setIncluded = useCallback(
    (ids, included) => {
      setEmployees((current) => current.map((employee) => (ids.includes(employee.id) ? { ...employee, included } : employee)))
      reopen()
    },
    [reopen],
  )

  const setStaffStatus = useCallback(
    (id, status) => {
      setEmployees((current) => current.map((employee) => (employee.id === id ? { ...employee, status, statusNote: status === 'Ready' ? undefined : employee.statusNote } : employee)))
      reopen()
    },
    [reopen],
  )

  const updateScope = useCallback(
    (next) => {
      setScope(next)
      reopen()
    },
    [reopen],
  )

  const addAdjustment = useCallback(
    (values) => {
      const adjustment = {
        id: nextId('ADJ-2026', adjustments),
        employeeId: values.employeeId,
        direction: values.direction,
        category: values.category,
        label: values.label.trim() || values.category,
        amount: Number(values.amount),
        reason: values.reason.trim(),
        reference: values.reference?.trim() || undefined,
        requestedBy: `${OWNER.name} · Owner`,
        requestedOn: now(),
        status: 'Pending approval',
      }
      setAdjustments((current) => [adjustment, ...current])
      log(`Adjustment logged (${values.direction === 'addition' ? '+' : '−'}₹${adjustment.amount.toLocaleString('en-IN')})`)
      reopen()
      return adjustment
    },
    [adjustments, log, reopen],
  )

  const decideAdjustments = useCallback(
    (ids, status, comment) => {
      setAdjustments((current) => current.map((entry) => (ids.includes(entry.id) ? { ...entry, status, comment: comment?.trim() || undefined, decidedBy: OWNER.name } : entry)))
      log(`${ids.length} adjustment${ids.length === 1 ? '' : 's'} ${status.toLowerCase()}`)
      reopen()
    },
    [log, reopen],
  )

  const addAdvance = useCallback(
    (values) => {
      const advance = {
        id: nextId('ADV-2026', advances),
        employeeId: values.employeeId,
        principal: Number(values.principal),
        installments: Number(values.installments),
        startMonth: values.startMonth,
        source: 'Admin created',
        category: values.category,
        method: values.method,
        notes: values.notes?.trim() || undefined,
        status: 'Pending disbursal',
        approvedBy: OWNER.name,
        disbursalDate: values.disbursalDate,
      }
      setAdvances((current) => [advance, ...current])
      log(`Employee advance created (₹${advance.principal.toLocaleString('en-IN')})`)
      return advance
    },
    [advances, log],
  )

  // Moves an advance one step along its lifecycle.
  const progressAdvance = useCallback(
    (id) => {
      const advance = advances.find((entry) => entry.id === id)
      const next = ADVANCE_STATUSES[ADVANCE_STATUSES.indexOf(advance.status) + 1]
      if (!next || next === 'Settled') return
      setAdvances((current) => current.map((entry) => (entry.id === id ? { ...entry, status: next, ...(next === 'Awaiting acknowledgement' && { disbursedOn: now() }) } : entry)))
      log(`${id} moved to ${next.toLowerCase()}`)
      reopen()
    },
    [advances, log, reopen],
  )

  const scopedEmployees = useMemo(() => employees.filter((employee) => inScope(employee, scope)), [employees, scope])
  const slips = useMemo(
    () => scopedEmployees.filter((employee) => employee.included).map((employee) => payslip(employee, { adjustments, advances })),
    [scopedEmployees, adjustments, advances],
  )
  const summary = useMemo(() => totals(slips), [slips])

  const approveBatch = useCallback(() => {
    setBatch({ status: 'Approved', approvedBy: OWNER.name, approvedOn: now() })
    log('Payroll batch approved for processing')
  }, [log])

  const processBatch = useCallback(() => {
    const branches = branchSummary(slips)
      .filter((row) => row.staff)
      .map((row) => ({ branchId: row.branch.id, staff: row.staff, gross: row.gross, net: row.net }))
    setHistory((current) => [
      {
        month: CURRENT_CYCLE.month,
        label: CURRENT_CYCLE.label,
        start: CURRENT_CYCLE.start,
        end: CURRENT_CYCLE.end,
        batchId: CURRENT_CYCLE.batchId,
        payDate: CURRENT_CYCLE.payDate,
        employees: summary.staff,
        gross: summary.gross,
        adjustments: summary.adjustments,
        statutory: summary.statutory,
        advances: summary.advance,
        approvedBy: batch.approvedBy,
        approvedOn: batch.approvedOn,
        status: 'Processed',
        branches,
      },
      ...current,
    ])
    setBatch((current) => ({ ...current, status: 'Processed', processedOn: now() }))
    log('Payroll batch processed and recorded')
  }, [slips, summary, batch, log])

  const value = useMemo(
    () => ({
      cycle: CURRENT_CYCLE,
      employees,
      scopedEmployees,
      adjustments,
      advances,
      scope,
      batch,
      activity,
      history,
      slips,
      summary,
      locked: batch.status === 'Processed',
      getEmployee: (id) => employees.find((employee) => employee.id === id),
      setIncluded,
      setStaffStatus,
      updateScope,
      addAdjustment,
      decideAdjustments,
      addAdvance,
      progressAdvance,
      approveBatch,
      processBatch,
    }),
    [employees, scopedEmployees, adjustments, advances, scope, batch, activity, history, slips, summary, setIncluded, setStaffStatus, updateScope, addAdjustment, decideAdjustments, addAdvance, progressAdvance, approveBatch, processBatch],
  )

  return <PayrollContext.Provider value={value}>{children ?? <Outlet />}</PayrollContext.Provider>
}
