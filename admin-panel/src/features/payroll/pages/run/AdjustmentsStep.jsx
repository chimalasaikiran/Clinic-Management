import { useState } from 'react'
import { ArrowRight, Ban, CheckCheck, CircleCheck, Clock, Eye, Plus, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react'
import ActionButton from '../../../../components/workspace/ActionButton'
import { FilterSelect, SearchBox } from '../../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../../components/workspace/DataTable'
import Drawer from '../../../../components/workspace/Drawer'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { cn } from '../../../../lib/cn'
import { Amount, EmployeeCell, MetricCard, MetricGrid, SummaryLine } from '../../components/PayrollKit'
import StepFooter from '../../components/StepFooter'
import { usePayroll } from '../../context/usePayroll'
import { ADJUSTMENT_STATUSES, PAYROLL_BRANCHES } from '../../constants'
import { minus, rupees, signed } from '../../format'
import { branchName, monthLabel, projectedNet, sum } from '../../payrollLogic'
import { ADJUSTMENT_TONES } from '../../tones'

const DIRECTIONS = { Addition: 'addition', Deduction: 'deduction' }

function AdjustmentDetail({ adjustment, employee, slip, settings, onDecide }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const pending = adjustment.status === 'Pending approval'
  const signedAmount = adjustment.direction === 'addition' ? adjustment.amount : -adjustment.amount
  // The payslip already counts an approved adjustment that is still unpaid; a pending one is projected.
  const counted = slip?.approvedAdjustments.some((entry) => entry.id === adjustment.id)
  const without = slip && (counted ? projectedNet(slip, -signedAmount, settings) : slip.net)
  const withIt = slip && (counted ? slip.net : projectedNet(slip, signedAmount, settings))

  const decide = async (value) => {
    const result = await onDecide(value, comment)
    if (result.error) setError(result.error)
  }
  const reject = () => {
    if (comment.trim().length < 3) {
      setError('Add a comment explaining the rejection.')
      return
    }
    decide('Rejected')
  }

  return (
    <>
      <div className="flex flex-col gap-5 p-5">
        <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
          <EmployeeCell employee={employee} withBranch />
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-outline">Employment</dt>
              <dd className="font-semibold">{employee.employment}</dd>
            </div>
            <div>
              <dt className="text-outline">Department</dt>
              <dd className="font-semibold">{employee.department}</dd>
            </div>
          </dl>
        </div>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Adjustment parameters</h3>
          <dl className="space-y-2">
            <SummaryLine label="Adjustment" value={adjustment.label} />
            <SummaryLine label="Category" value={`${adjustment.direction === 'addition' ? '+ Addition' : '− Deduction'} · ${adjustment.category}`} />
            <SummaryLine label="Requested amount" value={adjustment.direction === 'addition' ? signed(adjustment.amount) : minus(adjustment.amount)} tone={adjustment.direction === 'addition' ? 'add' : 'deduct'} />
            {adjustment.reference && <SummaryLine label="Reference" value={adjustment.reference} />}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Reason</h3>
          <p className="rounded-md border border-slate-200 p-3 text-[13px] leading-5">{adjustment.reason}</p>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Approval & governance</h3>
          <dl className="space-y-2">
            <SummaryLine label="Submitted by" value={adjustment.requestedBy} />
            <SummaryLine label="Submitted on" value={adjustment.requestedOn} />
            <SummaryLine label="Payroll month" value={adjustment.appliedIn ? `Paid in ${monthLabel(adjustment.appliedIn)}` : monthLabel(adjustment.month)} />
            {adjustment.decidedBy && <SummaryLine label={`${adjustment.status} by`} value={adjustment.decidedBy} />}
          </dl>
          {adjustment.comment && <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{adjustment.comment}</p>}
        </section>

        <section className="rounded-md border border-slate-200 bg-surface-lowest p-4">
          <h3 className="mb-2 text-[13px] font-semibold">Cycle earnings impact</h3>
          {slip && !adjustment.appliedIn && adjustment.status !== 'Rejected' ? (
            <dl className="space-y-2">
              <SummaryLine label="Gross this cycle" value={rupees(slip.gross)} />
              <SummaryLine label="Net pay without this item" value={rupees(without)} />
              <SummaryLine label="Projected net pay if approved" value={rupees(withIt)} strong />
            </dl>
          ) : (
            <p className="text-xs text-on-surface-variant">{adjustment.appliedIn ? `Paid in the ${monthLabel(adjustment.appliedIn)} run.` : adjustment.status === 'Rejected' ? 'Rejected, so it is not paid.' : 'This person is not in the open payroll run.'}</p>
          )}
        </section>

        {pending && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-800">
              Comment <span className="font-normal text-outline">(required to reject)</span>
            </span>
            <textarea
              rows={3}
              value={comment}
              onChange={(event) => {
                setComment(event.target.value)
                setError('')
              }}
              className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            {error && (
              <span role="alert" className="text-xs text-rose-600">
                {error}
              </span>
            )}
          </label>
        )}
      </div>
      {pending && (
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <ActionButton variant="danger" icon={Ban} onClick={reject} className="flex-1">
            Reject with comment
          </ActionButton>
          <ActionButton variant="primary" icon={CircleCheck} onClick={() => decide('Approved')} className="flex-1">
            Approve adjustment
          </ActionButton>
        </div>
      )}
    </>
  )
}

export default function AdjustmentsStep() {
  const { adjustments, slips, settings, getEmployee, decideAdjustments } = usePayroll()
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('')
  const [direction, setDirection] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState([])
  const [viewId, setViewId] = useState(null)

  const approved = adjustments.filter((entry) => entry.status === 'Approved')
  const additions = approved.filter((entry) => entry.direction === 'addition')
  const deductions = approved.filter((entry) => entry.direction === 'deduction')
  const pending = adjustments.filter((entry) => entry.status === 'Pending approval')

  const search = query.trim().toLowerCase()
  const branchId = PAYROLL_BRANCHES.find((entry) => entry.name === branch)?.id
  const rows = adjustments.filter((entry) => {
    const employee = getEmployee(entry.employeeId)
    return (
      (!search || `${employee.name} ${employee.id} ${entry.label} ${entry.reason}`.toLowerCase().includes(search)) &&
      (!branchId || employee.branchId === branchId) &&
      (!direction || entry.direction === DIRECTIONS[direction]) &&
      (!status || entry.status === status)
    )
  })
  const viewing = adjustments.find((entry) => entry.id === viewId)
  const selectedPending = selected.filter((id) => pending.some((entry) => entry.id === id))

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const approveSelected = async () => {
    if (!(await decideAdjustments(selectedPending, 'Approved')).error) setSelected([])
  }

  return (
    <>
      <MetricGrid className="lg:grid-cols-5">
        <MetricCard label="Net adjustments" icon={Wallet} value={signed(sum(additions, (entry) => entry.amount) - sum(deductions, (entry) => entry.amount))} tone="brand" hint="Approved net budget impact" />
        <MetricCard label="Approved additions" icon={TrendingUp} value={signed(sum(additions, (entry) => entry.amount))} hint={`${additions.length} items`} />
        <MetricCard label="Approved deductions" icon={TrendingDown} value={rupees(-sum(deductions, (entry) => entry.amount))} tone="danger" hint={`${deductions.length} items`} />
        <MetricCard label="Staff affected" icon={Users} value={`${new Set(approved.map((entry) => entry.employeeId)).size} staff`} hint="With an approved adjustment" />
        <MetricCard label="Pending approval" icon={Clock} value={rupees(sum(pending, (entry) => entry.amount))} tone="warning" hint={`${pending.length} items need sign-off`} />
      </MetricGrid>

      <Banner tone="brand" title="Advances are handled separately" className="mb-5">
        Employee advances and their instalment recoveries are managed in the Employee advances step. Only allowances, incentives,
        reimbursements and manual deductions are logged here.
      </Banner>

      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={query} onChange={setQuery} label="Search adjustments" placeholder="Search staff, ID or reason" className="min-w-56 flex-1" />
        <FilterSelect label="Branch" value={branch} onChange={setBranch} allLabel="All branches" options={PAYROLL_BRANCHES.map((entry) => entry.name)} />
        <FilterSelect label="Category" value={direction} onChange={setDirection} allLabel="Additions & deductions" options={Object.keys(DIRECTIONS)} />
        <FilterSelect label="Approval status" value={status} onChange={setStatus} allLabel="All approval statuses" options={ADJUSTMENT_STATUSES} />
        <StatusPill tone="warning" dot>
          Pending review ({pending.length})
        </StatusPill>
        <ActionButton icon={CheckCheck} onClick={approveSelected} disabled={!selectedPending.length}>
          Approve selected
        </ActionButton>
        <ActionButton variant="primary" icon={Plus} to={ROUTES.payrollAdjustmentNew}>
          Add adjustment
        </ActionButton>
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table headings={['Select', 'Staff member', 'Branch', 'Adjustment', 'Type', 'Amount', 'Reason', 'Requested by', 'Status', 'Action']} minWidth={1100} empty={rows.length ? null : 'No adjustments match your filters.'}>
          {rows.map((entry) => {
            const employee = getEmployee(entry.employeeId)
            const isPending = entry.status === 'Pending approval'
            return (
              <tr key={entry.id} className={cn('border-b border-slate-100 align-top last:border-0', selected.includes(entry.id) ? 'bg-teal-50/40' : 'hover:bg-surface-lowest')}>
                <Cell>
                  <input type="checkbox" checked={selected.includes(entry.id)} disabled={!isPending} onChange={() => toggle(entry.id)} aria-label={`Select ${entry.id}`} className="mt-1 accent-[#006a61]" />
                </Cell>
                <Cell>
                  <EmployeeCell employee={employee} />
                </Cell>
                <Cell>{branchName(employee.branchId)}</Cell>
                <Cell>
                  <p className="font-medium">{entry.label}</p>
                  <p className="text-[11px] text-outline">
                    {entry.id} · {entry.category}
                  </p>
                </Cell>
                <Cell>
                  <StatusPill tone={entry.direction === 'addition' ? 'success' : 'danger'}>{entry.direction === 'addition' ? '+ Addition' : '− Deduction'}</StatusPill>
                </Cell>
                <Cell className="font-semibold">
                  <Amount tone={entry.direction === 'addition' ? 'add' : 'deduct'}>{entry.direction === 'addition' ? signed(entry.amount) : minus(entry.amount)}</Amount>
                </Cell>
                <Cell className="max-w-56 text-xs text-on-surface-variant">
                  <p className="line-clamp-2">{entry.reason}</p>
                </Cell>
                <Cell className="text-xs">{entry.requestedBy}</Cell>
                <Cell>
                  <StatusPill tone={ADJUSTMENT_TONES[entry.status]} dot>
                    {entry.status}
                  </StatusPill>
                </Cell>
                <Cell>
                  <button type="button" onClick={() => setViewId(entry.id)} aria-label={`View ${entry.id}`} className="rounded p-1 text-on-surface-variant hover:bg-surface-low hover:text-brand">
                    <Eye className="size-4" aria-hidden="true" />
                  </button>
                </Cell>
              </tr>
            )
          })}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${adjustments.length} adjustments${selectedPending.length ? ` · ${selectedPending.length} selected` : ''}`} />
      </div>

      <StepFooter summary={`${pending.length} adjustment${pending.length === 1 ? '' : 's'} awaiting approval`} back={{ to: ROUTES.payrollRunCalculations, label: 'Back to calculations' }} next={ROUTES.payrollRunAdvances} nextLabel="Continue to employee advances">
        <ActionButton variant="brand" icon={ArrowRight} to={ROUTES.payrollRunReview}>
          View batch review
        </ActionButton>
      </StepFooter>

      {viewing && (
        <Drawer open onClose={() => setViewId(null)} eyebrow={viewing.status} title={viewing.id} description={viewing.label}>
          <AdjustmentDetail
            key={viewing.id}
            adjustment={viewing}
            employee={getEmployee(viewing.employeeId)}
            slip={slips.find((slip) => slip.employee.id === viewing.employeeId)}
            settings={settings}
            onDecide={async (value, comment) => {
              const result = await decideAdjustments([viewing.id], value, comment)
              if (!result.error) setViewId(null)
              return result
            }}
          />
        </Drawer>
      )}
    </>
  )
}
