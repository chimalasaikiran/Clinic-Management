import { useState } from 'react'
import { ArrowRight, Banknote, CalendarRange, ClipboardList, Lock, NotebookPen, ReceiptText, UserSearch } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../../components/workspace/ActionButton'
import { RadioCard } from '../../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../../components/workspace/FormControls'
import Panel from '../../../../components/workspace/Panel'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { useFormFields } from '../../../../hooks/useFormFields'
import { EmployeeCell, ScheduleTable, SummaryLine, ToggleChip } from '../../components/PayrollKit'
import { usePayroll } from '../../context/usePayroll'
import { ADVANCE_CATEGORIES, DISBURSAL_METHODS } from '../../data/seed'
import { rupees } from '../../format'
import { ADVANCE_LIMIT_MULTIPLE, RECOVERY_CAP, addMonths, advanceExposure, advanceSchedule, monthLabel, monthlyBase, validateAdvance } from '../../payrollLogic'

const TENURES = ['3', '6', '12']
const optionFor = (employee) => `${employee.name} (${employee.id})`

export default function CreateAdvancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cycle, employees, advances, locked } = usePayroll()
  const draft = location.state?.draft
  const [values, handleChange, setValues] = useFormFields(
    draft ?? { employee: '', principal: '', disbursalDate: '', category: '', method: DISBURSAL_METHODS[0], mode: 'monthly', installments: '6', notes: '' },
  )
  const [submitted, setSubmitted] = useState(false)

  const employee = employees.find((entry) => optionFor(entry) === values.employee)
  const exposure = employee && advanceExposure(employee, advances)
  const installments = values.mode === 'single' ? '1' : values.installments
  const startMonth = addMonths(cycle.month, 1)
  const principal = Number(values.principal) || 0
  const fields = { employee, principal: values.principal, installments, disbursalDate: values.disbursalDate, category: values.category, outstanding: exposure?.outstanding }
  const errors = submitted ? validateAdvance(fields) : {}
  const schedule = principal > 0 && Number(installments) >= 1 ? advanceSchedule({ principal, installments: Number(installments), startMonth, status: 'Pending disbursal' }) : []
  const share = employee && schedule.length ? Math.round((schedule[0].amount / monthlyBase(employee)) * 1000) / 10 : 0

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (locked || Object.keys(validateAdvance(fields)).length) return
    navigate(ROUTES.payrollAdvanceReview, { state: { draft: { ...values, installments } } })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-on-surface">Create employee advance</h2>
        <StatusPill>Admin origin</StatusPill>
      </div>
      <Banner className="mb-5" title="Creating an advance does not pay it out">
        The record is created as pending disbursal. Repayment deductions start only after Finance records the disbursal and the employee
        acknowledges the agreement.
      </Banner>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="1 · Employee" icon={UserSearch} bodyClassName="flex flex-col gap-4">
            <SelectInput label="Employee" name="employee" required placeholder="Choose an employee" options={employees.map(optionFor)} value={values.employee} onChange={handleChange} error={errors.employeeId} />
            {employee && (
              <>
                <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <EmployeeCell employee={employee} withBranch />
                </div>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <SummaryLine label="Monthly gross" value={rupees(monthlyBase(employee))} />
                  <SummaryLine label={`Limit (${ADVANCE_LIMIT_MULTIPLE}× gross)`} value={rupees(exposure.limit)} />
                  <SummaryLine label="Available" value={rupees(exposure.available)} tone="add" />
                </dl>
                {exposure.open.length > 0 && (
                  <Banner tone="warning" title="Open advance already on record">
                    {exposure.open.map((advance) => `${advance.id} (${advance.status})`).join(', ')} · Outstanding {rupees(exposure.outstanding)}
                  </Banner>
                )}
              </>
            )}
          </Panel>

          <Panel title="2 · Advance particulars" icon={ReceiptText} bodyClassName="grid gap-4 sm:grid-cols-2">
            <TextInput label="Advance amount (₹)" name="principal" type="number" min="0" required value={values.principal} onChange={handleChange} error={errors.principal} />
            <TextInput label="Scheduled disbursal date" name="disbursalDate" type="date" required value={values.disbursalDate} onChange={handleChange} error={errors.disbursalDate} />
            <SelectInput label="Reason category" name="category" required placeholder="Choose a category" options={ADVANCE_CATEGORIES} value={values.category} onChange={handleChange} error={errors.category} />
            <SelectInput label="Disbursal method" name="method" options={DISBURSAL_METHODS} value={values.method} onChange={handleChange} />
          </Panel>

          <Panel title="3 · Repayment plan" icon={CalendarRange} action={<StatusPill tone="brand">Interest free</StatusPill>} bodyClassName="flex flex-col gap-4">
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Recovery mode</legend>
              <RadioCard name="mode" value="single" checked={values.mode === 'single'} onChange={handleChange} title="Single salary offset" detail={`Recover the full amount from ${monthLabel(startMonth)} payroll.`} />
              <RadioCard name="mode" value="monthly" checked={values.mode === 'monthly'} onChange={handleChange} title="Monthly instalments" detail="Spread recovery across several payroll cycles." />
            </fieldset>
            {values.mode === 'monthly' && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Tenure</p>
                <div className="flex flex-wrap items-center gap-2">
                  {TENURES.map((months) => (
                    <ToggleChip key={months} pressed={values.installments === months} onClick={() => setValues((current) => ({ ...current, installments: months }))}>
                      {months} months
                    </ToggleChip>
                  ))}
                </div>
              </div>
            )}
            {errors.installments && (
              <p role="alert" className="text-xs text-rose-600">
                {errors.installments}
              </p>
            )}
            {schedule.length > 0 && employee && (
              <p className="text-xs text-on-surface-variant">
                {rupees(schedule[0].amount)} per month is {share}% of monthly gross (cap {RECOVERY_CAP * 100}%).
              </p>
            )}
          </Panel>

          <Panel title="4 · Repayment schedule preview" icon={ClipboardList}>
            {schedule.length ? <ScheduleTable schedule={schedule} /> : <p className="text-xs text-on-surface-variant">Enter an amount to preview the schedule.</p>}
          </Panel>

          <Panel title="5 · Internal notes" icon={NotebookPen} action={<StatusPill>Not visible to employee</StatusPill>}>
            <textarea
              name="notes"
              rows={3}
              aria-label="Internal notes"
              value={values.notes}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-5 xl:sticky xl:top-4">
          <Panel title="Advance summary" icon={Banknote}>
            <dl className="space-y-2.5">
              <SummaryLine label="Employee" value={employee?.name ?? '—'} />
              <SummaryLine label="Principal" value={principal ? rupees(principal) : '—'} />
              <SummaryLine label="Repayment" value={schedule.length ? `${installments} × ${rupees(schedule[0].amount)}` : '—'} />
              <SummaryLine label="First deduction" value={`${monthLabel(startMonth)} payroll`} />
              <SummaryLine label="Status after create" value="Pending disbursal" />
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-outline">
              <Lock className="size-3" aria-hidden="true" /> Interest-free staff advance
            </p>
          </Panel>
          <div className="flex flex-col gap-2">
            <ActionButton variant="primary" type="submit" className="w-full py-2.5" disabled={locked}>
              Review advance <ArrowRight className="size-3.5" aria-hidden="true" />
            </ActionButton>
            <ActionButton variant="soft" to={ROUTES.payrollRunAdvances} className="w-full bg-transparent text-on-surface-variant">
              Cancel
            </ActionButton>
          </div>
        </div>
      </div>
    </form>
  )
}
