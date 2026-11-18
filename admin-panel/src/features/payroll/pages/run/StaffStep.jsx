import { useState } from 'react'
import { BadgeCheck, CircleCheck, CircleX, PauseCircle, Save, TriangleAlert, Users } from 'lucide-react'
import ActionButton from '../../../../components/workspace/ActionButton'
import { FilterSelect, SearchBox } from '../../../../components/workspace/controls'
import { TextInput } from '../../../../components/workspace/FormControls'
import { Cell, Table, TableFooter } from '../../../../components/workspace/DataTable'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { cn } from '../../../../lib/cn'
import { EmployeeCell, MetricCard, MetricGrid, SummaryLine } from '../../components/PayrollKit'
import StepFooter from '../../components/StepFooter'
import { usePayroll } from '../../context/usePayroll'
import { EMPLOYMENT_TYPES, PAY_MODELS, PAYROLL_BRANCHES, STAFF_STATUSES } from '../../constants'
import { rupees } from '../../format'
import { advanceProgress, branchName } from '../../payrollLogic'
import { STAFF_TONES } from '../../tones'

// Paid days or units for the run: the figure from the records, or one entered in its place. Replacing a figure
// from the records needs a reason; shifts and hours have no record, so they are always entered here.
function QuantityEditor({ employee, locked, onSave }) {
  const model = PAY_MODELS[employee.model]
  const fromRecords = employee.model === 'monthly' || employee.model === 'visit'
  const [value, setValue] = useState(employee.entered ?? employee.derived ?? '')
  const [reason, setReason] = useState(employee.enteredReason ?? '')
  const [error, setError] = useState('')
  const changed = String(value) !== String(employee.entered ?? employee.derived ?? '') || reason !== (employee.enteredReason ?? '')

  const save = async () => {
    const number = Number(value)
    if (value === '' || !Number.isInteger(number) || number < 0) return setError('Enter a whole number, zero or more.')
    if (employee.model === 'monthly' && number > employee.days) return setError(`A month has at most ${employee.days} paid days.`)
    const replacing = fromRecords && number !== employee.derived
    if (replacing && reason.trim().length < 3) return setError('Give the reason for changing the figure from the records.')
    const result = await onSave(fromRecords && !replacing ? null : number, replacing ? reason : '')
    if (result.error) setError(result.error)
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">{model.quantity} this cycle</p>
      <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
        {fromRecords && <p className="text-xs text-on-surface-variant">From the records: <span className="font-semibold text-on-surface">{employee.derived ?? 0}</span></p>}
        <TextInput label={model.quantity} name="quantity" type="number" min="0" value={value} disabled={locked} onChange={(event) => { setValue(event.target.value); setError('') }} />
        {fromRecords && Number(value) !== employee.derived && value !== '' && (
          <TextInput label="Reason for the change" name="reason" value={reason} disabled={locked} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="e.g. Absence approved as paid leave" />
        )}
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        <ActionButton size="sm" icon={Save} onClick={save} disabled={locked || !changed}>
          Save {model.quantity.toLowerCase()}
        </ActionButton>
      </div>
    </div>
  )
}

function StaffInspector({ employee, cycle, advances, onStatus, onInclude, onQuantity, onVerifyBank, locked }) {
  const advance = advances.find((entry) => entry.employeeId === employee.id && entry.status === 'Active')
  const progress = advance && advanceProgress(advance)
  const checks = [
    ['Compensation contract configured', employee.hasProfile],
    ['Bank account verified', employee.bankVerified],
    ['Attendance & leave signed off', employee.status === 'Ready'],
  ]
  return (
    <section aria-label={`${employee.name} payroll profile`} className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
      <header className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{employee.name}</h2>
          <StatusPill tone={STAFF_TONES[employee.status]} dot>
            {employee.status}
          </StatusPill>
        </div>
        <p className="text-xs text-on-surface-variant">
          {employee.title} · {employee.id} · {branchName(employee.branchId)}
        </p>
        {employee.statusNote && <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{employee.statusNote}</p>}
      </header>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Compensation structure</p>
          <dl className="space-y-2 rounded-md border border-slate-200 bg-surface-lowest p-3">
            <SummaryLine label="Employment" value={employee.employment} />
            <SummaryLine label="Pay model" value={PAY_MODELS[employee.model].label} />
            <SummaryLine label="Rate" value={`${rupees(employee.rate)}/${PAY_MODELS[employee.model].unit}`} />
            <SummaryLine label="Bank" value={employee.bank} />
          </dl>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Verified activity</p>
          <p className="text-[13px]">{employee.volumeNote}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Gross this cycle: {rupees(employee.gross)}</p>
        </div>
        <QuantityEditor key={`${employee.id}-${employee.entryVersion}`} employee={{ ...employee, days: cycle.days }} locked={locked} onSave={onQuantity} />
        {progress && (
          <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-danger uppercase">Advance & loan recovery</p>
            <dl className="space-y-1.5">
              <SummaryLine label="Original principal" value={rupees(advance.principal)} />
              <SummaryLine label="Remaining balance" value={rupees(progress.outstanding)} />
              <SummaryLine label={`This cycle (inst. ${progress.current?.number ?? '—'} of ${advance.installments})`} value={rupees(-(progress.current?.amount ?? 0))} tone="deduct" />
            </dl>
          </div>
        )}
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Pre-flight checklist</p>
          <ul className="space-y-1.5 text-xs">
            {checks.map(([label, ok]) => (
              <li key={label} className={cn('flex items-center gap-2', ok ? 'text-brand' : 'text-amber-800')}>
                {ok ? <CircleCheck className="size-3.5" aria-hidden="true" /> : <TriangleAlert className="size-3.5" aria-hidden="true" />}
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {employee.status !== 'Ready' && (
            <ActionButton size="sm" icon={CircleCheck} onClick={() => onStatus('Ready')} disabled={locked}>
              Mark ready
            </ActionButton>
          )}
          {employee.status !== 'On hold' && (
            <ActionButton size="sm" icon={PauseCircle} onClick={() => onStatus('On hold')} disabled={locked}>
              Put on hold
            </ActionButton>
          )}
          {!employee.bankVerified && (
            <ActionButton size="sm" icon={BadgeCheck} onClick={onVerifyBank} disabled={locked}>
              Verify bank details
            </ActionButton>
          )}
          <ActionButton size="sm" variant={employee.included ? 'danger' : 'secondary'} icon={employee.included ? CircleX : CircleCheck} onClick={() => onInclude(!employee.included)} disabled={locked}>
            {employee.included ? 'Exclude from this run' : 'Include in this run'}
          </ActionButton>
        </div>
      </div>
    </section>
  )
}

export default function StaffStep() {
  const { cycle, scopedEmployees, advances, setIncluded, setStaffStatus, setQuantity, verifyBank, summary, locked } = usePayroll()
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('')
  const [employment, setEmployment] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState(scopedEmployees[0]?.id)

  const search = query.trim().toLowerCase()
  const branchId = PAYROLL_BRANCHES.find((entry) => entry.name === branch)?.id
  const rows = scopedEmployees.filter(
    (employee) =>
      (!search || `${employee.name} ${employee.id}`.toLowerCase().includes(search)) &&
      (!branchId || employee.branchId === branchId) &&
      (!employment || employee.employment === employment) &&
      (!status || employee.status === status),
  )
  const selected = scopedEmployees.find((employee) => employee.id === selectedId)
  const count = (value) => scopedEmployees.filter((employee) => employee.status === value).length
  const allIncluded = rows.length > 0 && rows.every((employee) => employee.included)

  return (
    <>
      <MetricGrid>
        <MetricCard label="Total staff in scope" icon={Users} value={scopedEmployees.length} hint={`${summary.staff} included in this run`} />
        <MetricCard label="Ready for calculation" icon={CircleCheck} value={count('Ready')} tone="brand" hint="Attendance and contract checks passed" />
        <MetricCard label="Needs review" icon={TriangleAlert} value={count('Needs review')} tone="warning" hint="Missing sign-off or unverified leave" />
        <MetricCard label="On hold / deferred" icon={PauseCircle} value={count('On hold')} tone="danger" hint="Bank mismatch or joined after cutoff" />
      </MetricGrid>

      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={query} onChange={setQuery} label="Search staff" placeholder="Search staff name or ID" className="min-w-56 flex-1" />
        <FilterSelect label="Branch" value={branch} onChange={setBranch} allLabel="All branches" options={PAYROLL_BRANCHES.map((entry) => entry.name)} />
        <FilterSelect label="Employment type" value={employment} onChange={setEmployment} allLabel="All employment types" options={EMPLOYMENT_TYPES} />
        <FilterSelect label="Payroll status" value={status} onChange={setStatus} allLabel="All statuses" options={STAFF_STATUSES} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Staff cohort roster</h2>
            <StatusPill>
              {rows.length} of {scopedEmployees.length} displayed
            </StatusPill>
          </div>
          <Table headings={['Include', 'Staff member', 'Branch & role', 'Type & model', 'Days / volume', 'Payroll status']} minWidth={760} empty={rows.length ? null : 'No staff match your filters.'}>
            {rows.map((employee) => (
              <tr key={employee.id} className={cn('border-b border-l-2 border-b-slate-100 align-top last:border-b-0', employee.id === selectedId ? 'border-l-brand bg-teal-50/40' : 'border-l-transparent hover:bg-surface-lowest')}>
                <Cell>
                  <input
                    type="checkbox"
                    checked={employee.included}
                    disabled={locked}
                    onChange={(event) => setIncluded([employee.id], event.target.checked)}
                    aria-label={`Include ${employee.name}`}
                    className="mt-1 accent-[#006a61]"
                  />
                </Cell>
                <Cell>
                  <button type="button" onClick={() => setSelectedId(employee.id)} aria-label={`Inspect ${employee.name}`} className="text-left">
                    <EmployeeCell employee={employee} />
                  </button>
                </Cell>
                <Cell>
                  <p>{branchName(employee.branchId)}</p>
                  <p className="text-[11px] text-outline">{employee.department}</p>
                </Cell>
                <Cell>
                  <p>{employee.employment}</p>
                  <p className="text-[11px] text-outline">
                    {rupees(employee.rate)}/{PAY_MODELS[employee.model].unit}
                  </p>
                </Cell>
                <Cell className="text-xs">{employee.volumeNote}</Cell>
                <Cell>
                  <StatusPill tone={STAFF_TONES[employee.status]} dot>
                    {employee.status}
                  </StatusPill>
                </Cell>
              </tr>
            ))}
          </Table>
          <TableFooter summary={`Showing ${rows.length} of ${scopedEmployees.length} staff`}>
            <ActionButton size="sm" onClick={() => setIncluded(rows.map((employee) => employee.id), !allIncluded)} disabled={locked || !rows.length}>
              {allIncluded ? 'Exclude shown' : 'Include shown'}
            </ActionButton>
          </TableFooter>
        </div>

        {selected && (
          <StaffInspector
            employee={selected}
            cycle={cycle}
            advances={advances}
            locked={locked}
            onStatus={(value) => setStaffStatus(selected.id, value, value === 'Ready' ? '' : undefined)}
            onInclude={(value) => setIncluded([selected.id], value)}
            onQuantity={(entered, reason) => setQuantity(selected.id, entered, reason)}
            onVerifyBank={() => verifyBank(selected.id)}
          />
        )}
      </div>

      <StepFooter
        summary={`${summary.staff} staff included · Estimated net payout ${rupees(summary.net)}`}
        back={{ to: ROUTES.payrollRun, label: 'Back to payroll period' }}
        next={ROUTES.payrollRunCalculations}
        nextLabel="Continue to review calculations"
      />
    </>
  )
}
