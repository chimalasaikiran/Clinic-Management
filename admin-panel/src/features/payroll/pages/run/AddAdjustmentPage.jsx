import { useState } from 'react'
import { BadgeCheck, Calculator, ClipboardList, FileText, ShieldCheck, UserSearch } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../../components/workspace/ActionButton'
import { RadioCard } from '../../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../../components/workspace/FormControls'
import Panel from '../../../../components/workspace/Panel'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { useFormFields } from '../../../../hooks/useFormFields'
import { useAuth } from '../../../auth/context/useAuth'
import { EmployeeCell, SummaryLine, ToggleChip } from '../../components/PayrollKit'
import { usePayroll } from '../../context/usePayroll'
import { ADJUSTMENT_CATEGORIES } from '../../constants'
import { minus, rupees, signed } from '../../format'
import { monthLabel, validateAdjustment } from '../../payrollLogic'

const OVERTIME = ADJUSTMENT_CATEGORIES.addition[0]
const optionFor = (employee) => `${employee.name} (${employee.id})`

export default function AddAdjustmentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { cycle, open, today, employees, slips, addAdjustment, getEmployee } = usePayroll()
  // Adjustments belong to the open run's month, or to the current month between runs.
  const month = open ? cycle.month : today.slice(0, 7)
  const [values, handleChange, setValues] = useFormFields({
    employee: getEmployee(location.state?.employeeId) ? optionFor(getEmployee(location.state.employeeId)) : '',
    direction: 'addition',
    category: '',
    label: '',
    amount: '',
    hours: '',
    hourlyRate: '300',
    reason: '',
    reference: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const employee = employees.find((entry) => optionFor(entry) === values.employee)
  const overtime = values.category === OVERTIME
  const amount = overtime ? Math.round(Number(values.hours) * Number(values.hourlyRate)) || 0 : Number(values.amount) || 0
  const fields = { employeeId: employee?.id, direction: values.direction, category: values.category, amount, reason: values.reason }
  const errors = submitted ? validateAdjustment(fields) : {}
  const current = employee && slips.find((slip) => slip.employee.id === employee.id)
  const delta = values.direction === 'addition' ? amount : -amount

  const setDirection = (event) => setValues((current) => ({ ...current, direction: event.target.value, category: '' }))
  const setCategory = (category) => setValues((current) => ({ ...current, category }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateAdjustment(fields)).length) return
    setSaving(true)
    const result = await addAdjustment({ ...fields, month, label: values.label || (overtime ? `Overtime (${values.hours} hrs)` : ''), reference: values.reference })
    setSaving(false)
    if (!result.error) navigate(ROUTES.payrollRunAdjustments)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-on-surface">Add payroll adjustment</h2>
        <p className="text-[13px] text-on-surface-variant">Add an approved earning or deduction to an employee's payroll for {monthLabel(month)}.</p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="1 · Employee" icon={UserSearch} bodyClassName="flex flex-col gap-4">
            <SelectInput label="Employee" name="employee" required placeholder="Choose an employee" options={employees.map(optionFor)} value={values.employee} onChange={handleChange} error={errors.employeeId} />
            {employee && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3">
                <EmployeeCell employee={employee} withBranch />
                <p className="text-xs text-on-surface-variant">
                  {employee.employment} · Gross this cycle <span className="font-semibold text-on-surface">{current ? rupees(current.gross) : 'not in the open run'}</span>
                </p>
              </div>
            )}
          </Panel>

          <Panel title="2 · Adjustment classification" icon={ClipboardList} bodyClassName="flex flex-col gap-4">
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Direction</legend>
              <RadioCard name="direction" value="addition" checked={values.direction === 'addition'} onChange={setDirection} title="Addition (+)" detail="Increase gross payroll earnings" />
              <RadioCard name="direction" value="deduction" checked={values.direction === 'deduction'} onChange={setDirection} title="Deduction (−)" detail="Reduce payroll amount" />
            </fieldset>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-slate-800">
                Category <span className="text-rose-500">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {ADJUSTMENT_CATEGORIES[values.direction].map((category) => (
                  <ToggleChip key={category} pressed={values.category === category} onClick={() => setCategory(category)}>
                    {category}
                  </ToggleChip>
                ))}
              </div>
              {errors.category && (
                <p role="alert" className="mt-1.5 text-xs text-rose-600">
                  {errors.category}
                </p>
              )}
            </div>
            <Banner>Advance recoveries follow their own repayment schedule and cannot be logged as adjustments.</Banner>
          </Panel>

          <Panel title="3 · Amount" icon={Calculator} bodyClassName="flex flex-col gap-4">
            {overtime ? (
              <div className="grid items-end gap-4 sm:grid-cols-3">
                <TextInput label="Hours logged" name="hours" type="number" min="0" step="0.5" value={values.hours} onChange={handleChange} />
                <TextInput label="Hourly rate (₹)" name="hourlyRate" type="number" min="0" value={values.hourlyRate} onChange={handleChange} />
                <div className="rounded-md border border-teal-200 bg-teal-50/60 px-3 py-2">
                  <p className="text-[11px] text-on-surface-variant">Calculated overtime pay</p>
                  <p className="font-semibold text-brand">{rupees(amount)}</p>
                </div>
              </div>
            ) : (
              <TextInput label="Amount (₹)" name="amount" type="number" min="0" required value={values.amount} onChange={handleChange} error={errors.amount} />
            )}
            {overtime && errors.amount && (
              <p role="alert" className="text-xs text-rose-600">
                {errors.amount}
              </p>
            )}
            <TextInput label="Label on payslip" name="label" hint="Optional" value={values.label} onChange={handleChange} placeholder={values.category || 'e.g. Weekend on-call stipend'} />
          </Panel>

          <Panel title="4 · Justification & evidence" icon={FileText} action={<StatusPill>Compliance mandatory</StatusPill>} bodyClassName="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-800">
                Reason for adjustment <span className="text-rose-500">*</span>
              </span>
              <textarea
                name="reason"
                rows={3}
                value={values.reason}
                onChange={handleChange}
                aria-invalid={errors.reason ? true : undefined}
                className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              {errors.reason && (
                <span role="alert" className="text-xs text-rose-600">
                  {errors.reason}
                </span>
              )}
            </label>
            <TextInput label="Reference code / ticket" name="reference" hint="Optional" value={values.reference} onChange={handleChange} placeholder="#OT-SEP26-0428" />
          </Panel>
        </div>

        <div className="flex flex-col gap-5 xl:sticky xl:top-4">
          <Panel title="Payroll impact preview" icon={BadgeCheck} action={<StatusPill tone="brand">Live</StatusPill>}>
            {current ? (
              <dl className="space-y-2.5">
                <SummaryLine label="Target payroll period" value={monthLabel(month)} />
                <SummaryLine label="Current gross" value={rupees(current.gross + current.adjustments)} />
                <SummaryLine label="This adjustment" value={values.direction === 'addition' ? signed(amount) : minus(amount)} tone={values.direction === 'addition' ? 'add' : 'deduct'} />
                <SummaryLine label="Projected gross" value={rupees(current.gross + current.adjustments + delta)} strong />
                <p className="text-[11px] text-on-surface-variant">Statutory deductions are recalculated once the adjustment is approved.</p>
              </dl>
            ) : (
              <p className="text-xs text-on-surface-variant">{employee ? `${employee.name} is not in an open payroll run; the adjustment is paid in the next run that includes them.` : 'Choose an employee to preview the impact.'}</p>
            )}
          </Panel>

          <Panel title="Audit & governance" icon={ShieldCheck}>
            <dl className="space-y-2.5">
              <SummaryLine label="Submitted by" value={user?.fullName ?? 'You'} />
              <SummaryLine label="Status after submit" value="Pending approval" />
            </dl>
          </Panel>

          <div className="flex flex-col gap-2">
            <ActionButton variant="primary" type="submit" className="w-full py-2.5" disabled={saving}>
              Submit adjustment
            </ActionButton>
            <ActionButton variant="soft" to={ROUTES.payrollRunAdjustments} className="w-full bg-transparent text-on-surface-variant">
              Cancel
            </ActionButton>
          </div>
        </div>
      </div>
    </form>
  )
}
