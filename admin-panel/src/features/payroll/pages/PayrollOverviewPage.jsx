import { ArrowRight, Banknote, CircleCheck, Clock, Download, FileSpreadsheet, FileText, HandCoins, Info, Plus, Play, ReceiptText, SquarePen, Stethoscope, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { usePayroll } from '../context/usePayroll'
import { PAY_MODELS } from '../constants'
import { minus, rupees, signed } from '../format'
import { Amount, MetricCard, MetricGrid, PayrollTabs } from '../components/PayrollKit'
import StartRunPanel from '../components/StartRunPanel'
import { advanceProgress, branchName, branchSummary, sum } from '../payrollLogic'
import { ADVANCE_TONES } from '../tones'

function QuickAction({ icon: Icon, title, detail, to, onClick }) {
  const body = (
    <>
      <Icon className="size-4 text-brand" aria-hidden="true" />
      <span className="mt-2 block text-[13px] font-semibold text-on-surface">{title}</span>
      <span className="text-[11px] text-outline">{detail}</span>
    </>
  )
  const className = 'block rounded-md border border-slate-200 p-3 text-left transition-colors hover:bg-surface-lowest'
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}

export default function PayrollOverviewPage() {
  const { cycle, open, batch, slips, summary, scopedEmployees, advances, activity, history, getEmployee } = usePayroll()
  const branches = branchSummary(slips)
  const processed = batch.status === 'Processed'
  // Paid is what has a recorded bank reference; the rest of a processed run is still to be transferred.
  const paidNet = processed ? sum(history[0].payslips.filter((slip) => slip.paymentRef), (slip) => slip.net) : 0
  const count = (status) => scopedEmployees.filter((employee) => employee.status === status).length
  const activeAdvances = advances.filter((advance) => advance.status === 'Active')
  const openAdvances = advances.filter((advance) => advance.status !== 'Settled')
  const consultants = slips.filter((slip) => slip.employee.employment === 'Consultant')
  const models = Object.entries(PAY_MODELS).map(([id, model]) => ({ ...model, staff: scopedEmployees.filter((employee) => employee.model === id).length }))

  const exportPayroll = () =>
    exportCsv(`payroll-${cycle?.month ?? 'none'}.csv`, [
      ['Employee ID', 'Name', 'Branch', 'Gross', 'Adjustments', 'Advance recovery', 'Statutory', 'Net'],
      ...slips.map((slip) => [slip.employee.id, slip.employee.name, branchName(slip.employee.branchId), slip.gross, slip.adjustments, slip.advance, slip.statutoryTotal, slip.net]),
    ])
  const exportBranches = () =>
    exportCsv(`payroll-branches-${cycle?.month ?? 'none'}.csv`, [
      ['Branch', 'Staff', 'Gross', 'Adjustments', 'Advance recovery', 'Statutory', 'Net'],
      ...branches.map((row) => [row.branch.name, row.staff, row.gross, row.adjustments, row.advance, row.statutory, row.net]),
    ])
  const exportVouchers = () =>
    exportCsv(`consultant-vouchers-${cycle?.month ?? 'none'}.csv`, [
      ['Employee ID', 'Name', 'Gross', 'TDS', 'Net'],
      ...consultants.map((slip) => [slip.employee.id, slip.employee.name, slip.gross, slip.statutoryTotal, slip.net]),
    ])

  return (
    <WorkspacePage>
      <PageIntro
        title="Payroll & salary"
        description="Manage staff compensation, payroll processing, advances and settlements across your organization."
        actions={
          <>
            <ActionButton icon={Download} onClick={exportPayroll}>
              Export payroll
            </ActionButton>
            <ActionButton variant="primary" icon={Plus} to={ROUTES.payrollRun}>
              Run payroll
            </ActionButton>
          </>
        }
      />
      <PayrollTabs />

      {!open && <div className="mb-5"><StartRunPanel /></div>}

      {cycle && (
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-on-surface">{cycle.label} cycle</h2>
          <StatusPill tone={processed ? 'success' : 'info'} dot>
            {processed ? (history[0].paid ? 'Paid' : 'Processed') : batch.status === 'Approved' ? 'Approved' : 'Processing'}
          </StatusPill>
          <StatusPill>Batch ID: {cycle.batchId}</StatusPill>
        </div>
        <dl className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-on-surface-variant">Period dates</dt>
            <dd className="font-semibold">
              {cycle.start} — {cycle.end}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Payment scheduled</dt>
            <dd className="font-semibold text-brand">{cycle.payDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Scope</dt>
            <dd className="font-semibold">
              {branches.filter((row) => row.staff).length} branches · {summary.staff} staff included
            </dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">Attendance cutoff</dt>
            <dd className="font-semibold">{cycle.cutoff}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton to={ROUTES.payrollHistory}>
            Payroll cycle history <ArrowRight className="size-3.5" aria-hidden="true" />
          </ActionButton>
          <ActionButton variant="brand" icon={ArrowRight} to={ROUTES.payrollRunReview}>
            View batch review
          </ActionButton>
        </div>
      </section>
      )}

      <MetricGrid className="lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Total payroll" icon={Wallet} value={rupees(summary.gross)} hint={`Gross across ${branches.filter((row) => row.staff).length} branches`} />
        <MetricCard label="Pending payment" icon={Clock} value={rupees(summary.net - paidNet)} tone="danger" hint={processed ? 'Processed, bank reference not yet recorded' : 'Awaiting processing'} />
        <MetricCard label="Paid" icon={CircleCheck} value={rupees(paidNet)} tone="brand" hint="Transfers with a recorded bank reference" />
        <MetricCard label="Staff processed" icon={Users} value={`${summary.staff} staff`} hint={processed ? `${history[0].payslips.length} payslips` : `${count('Ready')} ready · ${count('Needs review')} review · ${count('On hold')} hold`} />
        <MetricCard label="Advances out" icon={HandCoins} value={rupees(sum(activeAdvances, (advance) => advanceProgress(advance).outstanding))} hint={`${activeAdvances.length} active agreements`} />
        <MetricCard label="Consultants" icon={Stethoscope} value={rupees(sum(consultants, (slip) => slip.gross))} tone="brand" hint={`${consultants.length} visiting specialist${consultants.length === 1 ? '' : 's'} (non-PAYE)`} />
      </MetricGrid>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Employee advances & loan recovery"
            subtitle={`Outstanding: ${rupees(sum(activeAdvances, (advance) => advanceProgress(advance).outstanding))} · Pending requests: ${advances.filter((advance) => advance.status === 'Pending approval').length} · Due this month: ${rupees(sum(slips, (slip) => slip.advance))}`}
            action={
              <div className="flex gap-2">
                <ActionButton size="sm" to={ROUTES.payrollRunAdvances}>
                  View all advances
                </ActionButton>
                <ActionButton size="sm" variant="primary" icon={Plus} to={ROUTES.payrollAdvanceNew}>
                  New advance
                </ActionButton>
              </div>
            }
            bodyClassName="p-0"
          >
            <p className="flex items-start gap-2 border-b border-slate-100 bg-surface-lowest px-5 py-3 text-xs text-on-surface-variant">
              <Info className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
              Instalments of active advances are deducted automatically in the payroll run until the balance is cleared.
            </p>
            <Table headings={['Employee', 'Advance type', 'Total amount', 'Monthly recovery', 'Balance remaining', 'Status']} minWidth={720}>
              {openAdvances.slice(0, 4).map((advance) => {
                const employee = getEmployee(advance.employeeId)
                const progress = advanceProgress(advance)
                return (
                  <Row key={advance.id}>
                    <Cell>
                      <p className="font-semibold">{employee.name}</p>
                      <p className="text-[11px] text-outline">
                        {employee.id} · {employee.title}
                      </p>
                    </Cell>
                    <Cell>{advance.category}</Cell>
                    <Cell>{rupees(advance.principal)}</Cell>
                    <Cell>
                      <Amount tone="add">{rupees(progress.monthly)}/mo</Amount>
                      <p className="text-[11px] text-outline">{progress.current ? `Inst. ${progress.current.number} of ${advance.installments}` : `${advance.installments} instalments`}</p>
                    </Cell>
                    <Cell>{rupees(progress.outstanding)}</Cell>
                    <Cell>
                      <StatusPill tone={ADVANCE_TONES[advance.status]}>{advance.status}</StatusPill>
                    </Cell>
                  </Row>
                )
              })}
            </Table>
          </Panel>

          <Panel
            title="Payroll summary by branch"
            subtitle="Batch currency: INR (₹)"
            action={
              <Link to={ROUTES.payrollLedger} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                Detailed branch ledger <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            }
            bodyClassName="p-0"
          >
            <Table headings={['Branch', 'Staff', 'Gross payroll', 'Adjustments', 'Advance recovery', 'Net payroll', 'Status']} minWidth={760}>
              {branches.map((row) => (
                <Row key={row.branch.id}>
                  <Cell>
                    <p className="font-semibold">{row.branch.name}</p>
                    <p className="text-[11px] text-outline">{row.branch.code}</p>
                  </Cell>
                  <Cell>{row.staff} staff</Cell>
                  <Cell>{rupees(row.gross)}</Cell>
                  <Cell>
                    <Amount tone="add">{signed(row.adjustments)}</Amount>
                  </Cell>
                  <Cell>
                    <Amount tone="deduct">{minus(row.advance)}</Amount>
                  </Cell>
                  <Cell className="font-semibold">{rupees(row.net)}</Cell>
                  <Cell>
                    <StatusPill tone={row.staff ? 'success' : 'neutral'}>{row.staff ? 'Ready' : 'No staff'}</StatusPill>
                  </Cell>
                </Row>
              ))}
              <tr className="bg-surface-lowest text-[13px] font-semibold">
                <Cell>Total batch</Cell>
                <Cell>{summary.staff} staff</Cell>
                <Cell>{rupees(summary.gross)}</Cell>
                <Cell>
                  <Amount tone="add">{signed(summary.adjustments)}</Amount>
                </Cell>
                <Cell>
                  <Amount tone="deduct">{minus(summary.advance)}</Amount>
                </Cell>
                <Cell className="text-brand">{rupees(summary.net)}</Cell>
                <Cell />
              </tr>
            </Table>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Compensation models" subtitle={`${scopedEmployees.length} staff in scope`}>
            <ul className="space-y-2.5 text-[13px]">
              {models.map((model) => (
                <li key={model.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand" />
                    {model.label}
                  </span>
                  <span className="font-semibold">{model.staff} staff</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={Play} title="Run payroll" detail="Step 1 launch" to={ROUTES.payrollRun} />
              <QuickAction icon={Banknote} title="Record advance" detail="Staff agreements" to={ROUTES.payrollAdvanceNew} />
              <QuickAction icon={SquarePen} title="Log adjustment" detail="Overtime / penalties" to={ROUTES.payrollAdjustmentNew} />
              <QuickAction icon={FileText} title="Payslip data" detail="CSV of this batch" onClick={exportPayroll} />
              <QuickAction icon={FileSpreadsheet} title="Export ledger" detail="Branch CSV file" onClick={exportBranches} />
              <QuickAction icon={ReceiptText} title="Consultant vouchers" detail="TDS 194J summary" onClick={exportVouchers} />
            </div>
          </Panel>

          <Panel title="Recent payroll activity">
            <ol className="space-y-3">
              {activity.slice(0, 6).map((entry, index) => (
                <li key={entry.id} className="flex gap-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${index === 0 ? 'bg-brand' : 'bg-slate-400'}`} />
                  <div>
                    <p className="text-[13px] font-semibold text-on-surface">{entry.title}</p>
                    <p className="text-[11px] text-outline">{entry.meta}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </WorkspacePage>
  )
}
