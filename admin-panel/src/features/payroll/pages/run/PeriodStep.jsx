import { Building2, CalendarDays, CircleCheck, Landmark, ListChecks, Lock, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Table } from '../../../../components/workspace/DataTable'
import Panel from '../../../../components/workspace/Panel'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { OWNER } from '../../../../config/workspace'
import { cn } from '../../../../lib/cn'
import { SummaryLine, ToggleChip } from '../../components/PayrollKit'
import StepFooter from '../../components/StepFooter'
import { usePayroll } from '../../context/usePayroll'
import { EMPLOYMENT_TYPES, PAYROLL_BRANCHES } from '../../data/seed'
import { minus, rupees, signed } from '../../format'
import { branchSummary } from '../../payrollLogic'

function DateBox({ label, value, hint, highlight }) {
  return (
    <div className={cn('rounded-md border p-3', highlight ? 'border-teal-200 bg-teal-50/60' : 'border-slate-200')}>
      <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p>
      <p className={cn('mt-1 text-base font-semibold', highlight && 'text-brand')}>{value}</p>
      <p className="text-[11px] text-outline">{hint}</p>
    </div>
  )
}

export default function PeriodStep() {
  const { cycle, employees, scopedEmployees, scope, updateScope, slips, summary, adjustments, advances, locked } = usePayroll()
  const branches = branchSummary(slips)
  const included = scopedEmployees.filter((employee) => employee.included)

  const toggleScope = (key, value) => {
    if (locked) return
    const current = scope[key]
    updateScope({ ...scope, [key]: value === null ? [] : current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value] })
  }

  const needsReview = included.filter((employee) => employee.status === 'Needs review')
  const unverifiedBank = included.filter((employee) => !employee.bankVerified)
  const includedIds = new Set(included.map((employee) => employee.id))
  const pendingAdjustments = adjustments.filter((entry) => includedIds.has(entry.employeeId) && entry.status === 'Pending approval')
  const activeAdvances = advances.filter((advance) => advance.status === 'Active' && includedIds.has(advance.employeeId))
  const checks = [
    { label: 'Attendance verified for included staff', ok: !needsReview.length, issue: `${needsReview.length} staff need attendance or leave review`, to: ROUTES.payrollRunStaff, action: 'Review staff' },
    { label: 'Bank details verified', ok: !unverifiedBank.length, issue: `Unverified bank details: ${unverifiedBank.map((employee) => employee.name).join(', ')}`, to: ROUTES.payrollRunStaff, action: 'Review staff' },
    { label: 'Adjustments approved', ok: !pendingAdjustments.length, issue: `${pendingAdjustments.length} adjustment${pendingAdjustments.length === 1 ? '' : 's'} awaiting approval`, to: ROUTES.payrollRunAdjustments, action: 'Review adjustments' },
    { label: `${activeAdvances.length} advance repayment schedules active`, ok: true },
  ]
  const passed = checks.filter((check) => check.ok).length

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Payroll period configuration" icon={CalendarDays} action={<StatusPill tone="success">Scheduled monthly run</StatusPill>} bodyClassName="flex flex-col gap-4">
            <p className="text-[13px]">
              Selected cycle: <span className="font-semibold">{cycle.label}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <DateBox label="Start date" value={cycle.start} hint="Cycle start (00:00 IST)" />
              <DateBox label="End date" value={cycle.end} hint="Cycle close (23:59 IST)" />
              <DateBox label="Disbursement date" value={cycle.payDate} hint="Bank transfer via NEFT / RTGS" highlight />
            </div>
            <Banner tone="warning" title="Cutoff notice">
              Attendance and service logs lock on {cycle.cutoff}. Later corrections go into the next cycle as adjustments.
            </Banner>
          </Panel>

          <Panel title="Payroll scope" icon={Building2} subtitle="Choose which branches and employment types this run covers." bodyClassName="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Branches</p>
              <div className="flex flex-wrap gap-2">
                <ToggleChip pressed={!scope.branchIds.length} onClick={() => toggleScope('branchIds', null)}>
                  All branches ({PAYROLL_BRANCHES.length})
                </ToggleChip>
                {PAYROLL_BRANCHES.map((branch) => (
                  <ToggleChip key={branch.id} pressed={scope.branchIds.includes(branch.id)} onClick={() => toggleScope('branchIds', branch.id)}>
                    {branch.name} ({branch.code})
                  </ToggleChip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Employment type</p>
              <div className="flex flex-wrap gap-2">
                <ToggleChip pressed={!scope.employment.length} onClick={() => toggleScope('employment', null)}>
                  All types ({employees.length})
                </ToggleChip>
                {EMPLOYMENT_TYPES.map((type) => (
                  <ToggleChip key={type} pressed={scope.employment.includes(type)} onClick={() => toggleScope('employment', type)}>
                    {type} ({employees.filter((employee) => employee.employment === type).length})
                  </ToggleChip>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            title="Staff cohort included"
            icon={Users}
            action={
              <Link to={ROUTES.payrollRunStaff} className="text-xs font-semibold text-brand hover:underline">
                View staff roster ({scopedEmployees.length})
              </Link>
            }
            bodyClassName="flex flex-col gap-4"
          >
            <dl className="grid gap-3 sm:grid-cols-4">
              {EMPLOYMENT_TYPES.map((type) => (
                <div key={type} className="rounded-md border border-slate-200 p-3">
                  <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{type}</dt>
                  <dd className="mt-1 text-lg font-bold">{included.filter((employee) => employee.employment === type).length}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <Table headings={['Branch', 'Staff in scope', 'Included', 'Gross']} minWidth={480}>
                {branches.map((row) => (
                  <tr key={row.branch.id} className="border-b border-slate-100 last:border-0">
                    <Cell className="font-semibold">
                      {row.branch.name} <span className="font-normal text-outline">{row.branch.code}</span>
                    </Cell>
                    <Cell>{scopedEmployees.filter((employee) => employee.branchId === row.branch.id).length}</Cell>
                    <Cell>{row.staff}</Cell>
                    <Cell>{rupees(row.gross)}</Cell>
                  </tr>
                ))}
              </Table>
            </div>
          </Panel>

          <Panel title="Payroll pre-flight checks" icon={ListChecks} action={<StatusPill tone={passed === checks.length ? 'success' : 'warning'}>{passed} / {checks.length} passed</StatusPill>} bodyClassName="flex flex-col gap-2">
            {checks.map((check) =>
              check.ok ? (
                <p key={check.label} className="flex items-center justify-between gap-3 rounded-md border border-teal-200 bg-teal-50/60 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2">
                    <CircleCheck className="size-3.5 text-brand" aria-hidden="true" />
                    {check.label}
                  </span>
                  <span className="font-semibold text-brand">Passed</span>
                </p>
              ) : (
                <p key={check.label} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="flex items-center gap-2">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    {check.issue}
                  </span>
                  <Link to={check.to} className="font-semibold underline">
                    {check.action}
                  </Link>
                </p>
              ),
            )}
            <p className="mt-1 text-xs text-on-surface-variant">Flagged items can be resolved in the following steps; they block approval, not drafting.</p>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Estimated payroll summary" icon={Landmark} subtitle={`Live projection for ${cycle.label}`}>
            <div className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 p-4">
              <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Estimated net batch payout</p>
              <p className="mt-1 text-2xl font-bold text-brand">{rupees(summary.net)}</p>
              <p className="text-xs text-on-surface-variant">{summary.staff} payees</p>
            </div>
            <dl className="space-y-2.5">
              <SummaryLine label="Gross payroll" value={rupees(summary.gross)} />
              <SummaryLine label="Adjustments" value={signed(summary.adjustments)} tone="add" />
              <SummaryLine label="Advance recovery" value={minus(summary.advance)} tone="deduct" />
              <SummaryLine label="Statutory deductions" value={minus(summary.statutory)} tone="deduct" />
              <SummaryLine label="Net payroll" value={rupees(summary.net)} strong />
            </dl>
          </Panel>

          <Panel title="Governance & authorization" icon={ShieldCheck}>
            <dl className="space-y-2.5">
              <SummaryLine label="Initiator" value={OWNER.name} />
              <SummaryLine label="Approver" value="Owner or Finance admin" />
              <SummaryLine label="Next step" value="Review staff" />
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-outline">
              <Lock className="size-3" aria-hidden="true" /> Every change to this run is logged.
            </p>
          </Panel>
        </div>
      </div>

      <StepFooter summary={`Step 1 of 7 · ${summary.staff} staff included · Estimated payout ${rupees(summary.net)}`} next={ROUTES.payrollRunStaff} nextLabel="Continue to review staff" />
    </>
  )
}
