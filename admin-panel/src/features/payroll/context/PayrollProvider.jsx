import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import LoadingState from '../../patients/components/LoadingState'
import { toPayrollState } from '../adapters'
import { payrollApi } from '../api'
import { employmentId, setBranches, staffStatusId } from '../constants'
import { totals } from '../payrollLogic'
import { PayrollContext } from './payrollContext'

const ADVANCE_ACTIONS = { 'Pending approval': 'approve', 'Pending disbursal': 'disburse', 'Awaiting acknowledgement': 'acknowledge' }

// Loads payroll from the API (rules, pay profiles, the open run worked out from attendance and appointments,
// processed runs, adjustments and advances) and sends every change to it, reloading afterwards. Each action
// resolves to its result, or to { error } when the server refuses it; the refusal is also shown above the screen.
export default function PayrollProvider({ children }) {
  const [view, setView] = useState({ status: 'loading', data: null, error: null })
  const [failure, setFailure] = useState(null)
  const latest = useRef(0)
  const data = useRef(null)

  const settle = useCallback((request, promise) => promise.then(
    (response) => {
      if (request !== latest.current) return
      const mapped = toPayrollState(response)
      data.current = mapped
      setView({ status: 'ready', data: mapped, error: null })
    },
    (error) => request === latest.current && setView((current) => ({ ...current, status: current.data ? 'ready' : 'error', error })),
  ), [])

  const load = useCallback(() => settle(++latest.current, payrollApi.state()), [settle])
  useEffect(() => {
    settle(++latest.current, payrollApi.state())
  }, [settle])

  if (view.data) setBranches(view.data.branches)

  // Runs one change against the API and reloads; resolves to the response, or { error, details }.
  const send = useCallback(async (call) => {
    try {
      const result = await call(data.current)
      setFailure(null)
      await load()
      return result ?? {}
    } catch (error) {
      const details = error.details?.map((detail) => detail.issue).filter(Boolean) ?? []
      setFailure(details.length ? `${error.message} ${details.join(' · ')}` : error.message)
      return { error: error.message, details }
    }
  }, [load])

  const actions = useMemo(() => {
    const employee = (state, code) => state.staff.find((entry) => entry.id === code)
    const cycleId = (state) => state.cycle.id
    return {
      startRun: (month) => send(() => payrollApi.startCycle(month)),
      updateScope: (next) => send((state) => payrollApi.setScope(cycleId(state), { branchIds: next.branchIds, employment: next.employment.map(employmentId), version: state.cycle.version })),
      setIncluded: (codes, included) => send((state) => payrollApi.include(cycleId(state), codes.map((code) => employee(state, code).entryId), included)),
      setStaffStatus: (code, status, note) => send((state) => {
        const row = employee(state, code)
        return payrollApi.updateEntry(row.entryId, { status: staffStatusId(status), ...(note !== undefined && { statusNote: note }), version: row.entryVersion })
      }),
      // Paid days or units replacing the figure from the records; null goes back to the records.
      setQuantity: (code, entered, reason) => send((state) => {
        const row = employee(state, code)
        return payrollApi.updateEntry(row.entryId, { entered, enteredReason: reason ?? '', version: row.entryVersion })
      }),
      addAdjustment: (values) => send((state) => payrollApi.createAdjustment({
        staffId: employee(state, values.employeeId).uuid, month: values.month ?? state.cycle?.month ?? state.today.slice(0, 7), direction: values.direction, category: values.category,
        label: values.label?.trim() ?? '', amount: Number(values.amount), reason: values.reason.trim(), documentRef: values.reference?.trim() || undefined,
      })),
      decideAdjustments: (ids, status, comment) => send((state) => payrollApi.decideAdjustments({
        ids: ids.map((id) => state.adjustments.find((entry) => entry.id === id).uuid), decision: status === 'Approved' ? 'approved' : 'rejected', comment: comment?.trim() ?? '',
      })),
      addAdvance: (values) => send((state) => payrollApi.createAdvance({
        staffId: employee(state, values.employeeId).uuid, source: 'Admin created', principal: Number(values.principal), installments: Number(values.installments), startMonth: values.startMonth,
        category: values.category, method: values.method, disbursalDate: values.disbursalDate, notes: values.notes?.trim() ?? '',
      })),
      // Moves an advance one step along its lifecycle, or rejects a request.
      progressAdvance: (id, { reject = false, note = '' } = {}) => send((state) => {
        const advance = state.advances.find((entry) => entry.id === id)
        return payrollApi.advanceAction(advance.uuid, { action: reject ? 'reject' : ADVANCE_ACTIONS[advance.status], note, version: advance.version })
      }),
      approveBatch: () => send((state) => payrollApi.approve(cycleId(state), state.cycle.version)),
      processBatch: () => send((state) => payrollApi.process(cycleId(state), state.cycle.version)),
      recordPayment: (entryId, reference, version) => send(() => payrollApi.recordPayment(entryId, { reference: reference.trim(), version })),
      saveSettings: (values) => send((state) => payrollApi.saveSettings({ ...values, version: state.settings.version })),
      saveProfile: (code, values) => send((state) => {
        const row = employee(state, code)
        const body = { employment: values.employment, model: values.model, rate: Number(values.rate), bankName: values.bankName.trim(), ifsc: values.ifsc.trim().toUpperCase(), accountLast4: values.accountLast4.trim(), active: values.active ?? true }
        return row.profile ? payrollApi.updateProfile(row.profile.id, { ...body, version: row.profile.version }) : payrollApi.createProfile({ staffId: row.uuid, ...body })
      }),
      verifyBank: (code) => send((state) => {
        const row = employee(state, code)
        return payrollApi.verifyBank(row.profile.id, row.profile.version)
      }),
    }
  }, [send])

  const value = useMemo(() => {
    const state = view.data
    if (!state) return null
    const employees = state.staff.filter((employee) => employee.hasProfile)
    const scopedEmployees = state.staff.filter((employee) => employee.inRun && employee.inScope)
    return {
      ...state,
      employees,
      scopedEmployees,
      summary: totals(state.slips),
      locked: !state.open,
      getEmployee: (id) => state.staff.find((employee) => employee.id === id),
      reload: load,
      ...actions,
    }
  }, [view.data, actions, load])

  if (view.status !== 'ready') {
    return <WorkspacePage><LoadingState label="Loading payroll records…" error={view.status === 'error' ? view.error : null} onRetry={load} /></WorkspacePage>
  }
  return (
    <PayrollContext.Provider value={value}>
      {failure && (
        <div role="alert" className="mx-auto mt-4 flex max-w-7xl items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          <span><strong className="font-semibold">Not saved.</strong> {failure}</span>
          <button type="button" onClick={() => setFailure(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}
      {children ?? <Outlet />}
    </PayrollContext.Provider>
  )
}
