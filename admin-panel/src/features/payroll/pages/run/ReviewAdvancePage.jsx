import { useState } from 'react'
import { ArrowLeft, CircleCheck, ClipboardCheck, FileText, ListOrdered, ShieldAlert, UserRound } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../../components/workspace/ActionButton'
import Modal from '../../../../components/workspace/Modal'
import Panel from '../../../../components/workspace/Panel'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { OWNER } from '../../../../config/workspace'
import { EmployeeCell, ScheduleTable, SummaryLine } from '../../components/PayrollKit'
import { usePayroll } from '../../context/usePayroll'
import { rupees } from '../../format'
import { RECOVERY_CAP, addMonths, advanceExposure, advanceSchedule, monthLabel, monthlyBase, validateAdvance } from '../../payrollLogic'

const STAGES = ['Advance details', 'Repayment plan', 'Review & create', 'Employee acknowledgement']

export default function ReviewAdvancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cycle, employees, advances, addAdvance, locked } = usePayroll()
  const [confirming, setConfirming] = useState(false)
  const draft = location.state?.draft
  const employee = draft && employees.find((entry) => `${entry.name} (${entry.id})` === draft.employee)
  if (!draft || !employee) return <Navigate to={ROUTES.payrollAdvanceNew} replace />

  const exposure = advanceExposure(employee, advances)
  const principal = Number(draft.principal)
  const installments = Number(draft.installments)
  const startMonth = addMonths(cycle.month, 1)
  const schedule = advanceSchedule({ principal, installments, startMonth, status: 'Pending disbursal' })
  const share = Math.round((schedule[0].amount / monthlyBase(employee)) * 1000) / 10
  const valid = Object.keys(validateAdvance({ employee, principal: draft.principal, installments, disbursalDate: draft.disbursalDate, category: draft.category, outstanding: exposure.outstanding })).length === 0

  const create = () => {
    addAdvance({ employeeId: employee.id, principal, installments, startMonth, category: draft.category, method: draft.method, disbursalDate: draft.disbursalDate, notes: draft.notes })
    navigate(ROUTES.payrollRunAdvances)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-on-surface">
            Review employee advance <StatusPill tone="info">Draft — ready to create</StatusPill>
          </h2>
          <p className="text-[13px] text-on-surface-variant">Review the advance details and repayment plan before creating the advance record.</p>
        </div>
        <ActionButton icon={ArrowLeft} onClick={() => navigate(ROUTES.payrollAdvanceNew, { state: { draft } })}>
          Back to edit
        </ActionButton>
      </div>

      <ol className="mb-5 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4">
        {STAGES.map((stage, index) => (
          <li key={stage} aria-current={index === 2 ? 'step' : undefined} className={`flex items-center gap-2 text-xs ${index < 2 ? 'text-brand' : index === 2 ? 'font-semibold text-on-surface' : 'text-outline'}`}>
            <span className={`flex size-5 items-center justify-center rounded-full border text-[10px] font-bold ${index === 2 ? 'border-brand bg-brand text-white' : index < 2 ? 'border-brand' : 'border-slate-300'}`}>
              {index < 2 ? '✓' : index + 1}
            </span>
            {stage}
          </li>
        ))}
      </ol>

      <Banner tone="warning" title="Creating this record does not disburse funds" className="mb-5">
        The advance stays pending disbursal until Finance records the payment, and recovery starts only after the employee acknowledges the agreement.
      </Banner>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Employee profile" icon={UserRound}>
            <EmployeeCell employee={employee} withBranch />
            <dl className="mt-4 grid gap-3 sm:grid-cols-4">
              <SummaryLine label="Monthly gross" value={rupees(monthlyBase(employee))} />
              <SummaryLine label="Limit" value={rupees(exposure.limit)} />
              <SummaryLine label="Open advances" value={exposure.open.length} />
              <SummaryLine label="Available" value={rupees(exposure.available)} tone="add" />
            </dl>
          </Panel>

          <Panel title="Advance particulars" icon={FileText}>
            <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Sanctioned principal</p>
            <p className="mb-4 text-3xl font-bold text-on-surface">{rupees(principal)}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <SummaryLine label="Origin" value="Admin created" />
              <SummaryLine label="Disbursal method" value={draft.method} />
              <SummaryLine label="Scheduled disbursal" value={draft.disbursalDate} />
              <SummaryLine label="Reason" value={draft.category} />
            </dl>
          </Panel>

          <Panel title="Repayment plan" icon={ListOrdered} action={<StatusPill tone="brand">{installments} monthly instalment{installments === 1 ? '' : 's'}</StatusPill>} bodyClassName="flex flex-col gap-4">
            <Banner tone="brand" title="Recovery cap check">
              {rupees(schedule[0].amount)} per month is {share}% of monthly gross, within the {RECOVERY_CAP * 100}% limit.
            </Banner>
            <ScheduleTable schedule={schedule} />
          </Panel>

          {draft.notes && (
            <Panel title="Internal admin notes" action={<StatusPill tone="danger">Not visible to employee</StatusPill>}>
              <p className="text-[13px] leading-5 italic">{draft.notes}</p>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Pre-creation summary" icon={ClipboardCheck}>
            <dl className="space-y-2.5">
              <SummaryLine label="Beneficiary" value={employee.name} />
              <SummaryLine label="Principal" value={rupees(principal)} />
              <SummaryLine label="Tenure" value={`${installments} × ${rupees(schedule[0].amount)}`} />
              <SummaryLine label="First recovery" value={monthLabel(startMonth)} />
              <SummaryLine label="Status after create" value="Pending disbursal" />
            </dl>
          </Panel>
          <Panel title="Next steps after creation" icon={ShieldAlert}>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-on-surface-variant">
              <li>Finance records the disbursal.</li>
              <li>The employee acknowledges the agreement.</li>
              <li>Instalments are deducted from {monthLabel(startMonth)} payroll.</li>
            </ol>
          </Panel>
          <ActionButton variant="primary" icon={CircleCheck} className="w-full py-2.5" onClick={() => setConfirming(true)} disabled={locked || !valid}>
            Create advance
          </ActionButton>
          {!valid && <p className="text-xs text-rose-600">These details no longer pass validation. Go back to edit them.</p>}
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        eyebrow="Confirm"
        title="Create employee advance?"
        description={`This creates an advance of ${rupees(principal)} for ${employee.name}, repaid over ${installments} month${installments === 1 ? '' : 's'}.`}
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton onClick={() => setConfirming(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={CircleCheck} onClick={create}>
              Confirm & create
            </ActionButton>
          </div>
        }
      >
        <dl className="space-y-2 px-6 py-4">
          <SummaryLine label="Beneficiary" value={`${employee.name} (${employee.id})`} />
          <SummaryLine label="Repayment plan" value={`${installments} × ${rupees(schedule[0].amount)} / month`} />
          <SummaryLine label="Created by" value={OWNER.name} />
          <SummaryLine label="Payment state" value="Pending disbursal" />
        </dl>
      </Modal>
    </>
  )
}
