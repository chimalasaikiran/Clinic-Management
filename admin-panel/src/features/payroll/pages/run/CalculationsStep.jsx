import { useState } from 'react'
import { CircleCheck, Flag, HandCoins, MinusCircle, PanelRightOpen, TrendingUp, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../../components/workspace/ActionButton'
import { FilterSelect, SearchBox } from '../../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../../components/workspace/DataTable'
import Drawer from '../../../../components/workspace/Drawer'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { Amount, EmployeeCell, MetricCard, MetricGrid, SummaryLine } from '../../components/PayrollKit'
import StepFooter from '../../components/StepFooter'
import { usePayroll } from '../../context/usePayroll'
import { PAY_MODELS, PAYROLL_BRANCHES, STAFF_STATUSES } from '../../constants'
import { minus, rupees, signed } from '../../format'
import { advanceProgress, branchName } from '../../payrollLogic'
import { STAFF_TONES } from '../../tones'

function Breakdown({ slip }) {
  const { employee } = slip
  return (
    <div className="flex flex-col gap-5 p-5">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Earnings breakdown</h3>
        <dl className="space-y-2 rounded-md border border-slate-200 p-3">
          <SummaryLine label={employee.model === 'monthly' ? `Base salary (${employee.paidDays} paid days)` : `${employee.units} × ${rupees(employee.rate)} per ${PAY_MODELS[employee.model]?.unit ?? 'unit'}`} value={rupees(slip.gross)} />
          {slip.approvedAdjustments.map((entry) => (
            <SummaryLine key={entry.id} label={entry.label} value={entry.direction === 'addition' ? signed(entry.amount) : minus(entry.amount)} tone={entry.direction === 'addition' ? 'add' : 'deduct'} />
          ))}
          <SummaryLine label="Total earnings after adjustments" value={rupees(slip.gross + slip.adjustments)} strong />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-danger uppercase">Employee advance & loan recovery</h3>
        {slip.advanceLines.length ? (
          slip.advanceLines.map(({ advance, amount, number }) => {
            // Once the run is processed the instalment is already counted as recovered.
            const before = advanceProgress(advance).outstanding + (advance.recoveries.some((entry) => entry.number === number) ? amount : 0)
            return (
              <dl key={advance.id} className="space-y-2 rounded-md border border-red-200 bg-red-50/40 p-3">
                <SummaryLine label={`${advance.id} principal`} value={rupees(advance.principal)} />
                <SummaryLine label="Outstanding before run" value={rupees(before)} />
                <SummaryLine label={`Scheduled deduction (inst. ${number} of ${advance.installments})`} value={rupees(-amount)} tone="deduct" />
                <SummaryLine label="Balance after run" value={rupees(before - amount)} strong />
              </dl>
            )
          })
        ) : (
          <p className="text-xs text-on-surface-variant">No advance instalment is due this cycle.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Statutory deductions</h3>
        <dl className="space-y-2 rounded-md border border-slate-200 p-3">
          {slip.statutory.map((line) => (
            <SummaryLine key={line.label} label={line.label} value={rupees(-line.amount)} />
          ))}
          <SummaryLine label="Total statutory deductions" value={rupees(-slip.statutoryTotal)} strong />
        </dl>
      </section>

      <section className="rounded-md border border-teal-200 bg-teal-50/60 p-4">
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-brand uppercase">Calculation summary</h3>
        <dl className="space-y-2">
          <SummaryLine label="Gross earnings" value={rupees(slip.gross)} />
          <SummaryLine label="Adjustments" value={signed(slip.adjustments)} tone="add" />
          <SummaryLine label="Advance recovery" value={minus(slip.advance)} tone="deduct" />
          <SummaryLine label="Statutory deductions" value={minus(slip.statutoryTotal)} tone="deduct" />
        </dl>
        <p className="mt-3 flex items-baseline justify-between border-t border-teal-200 pt-3">
          <span className="text-[13px] font-semibold">Net pay to disburse</span>
          <span className="text-2xl font-bold text-brand">{rupees(slip.net)}</span>
        </p>
        <p className="mt-1 text-[11px] text-on-surface-variant">
          {employee.bank} {employee.bankVerified ? '· Verified' : '· Not verified'}
        </p>
      </section>
    </div>
  )
}

export default function CalculationsStep() {
  const navigate = useNavigate()
  const { slips, summary, scopedEmployees, locked } = usePayroll()
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState('')
  const [inspectId, setInspectId] = useState(null)

  const search = query.trim().toLowerCase()
  const branchId = PAYROLL_BRANCHES.find((entry) => entry.name === branch)?.id
  const rows = slips.filter(
    ({ employee }) =>
      (!search || `${employee.name} ${employee.id} ${employee.title}`.toLowerCase().includes(search)) &&
      (!branchId || employee.branchId === branchId) &&
      (!model || PAY_MODELS[employee.model]?.label === model) &&
      (!status || employee.status === status),
  )
  const inspected = slips.find((slip) => slip.employee.id === inspectId)
  const ready = slips.filter((slip) => slip.employee.status === 'Ready').length

  return (
    <>
      <MetricGrid className="lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Ready for calculation" icon={CircleCheck} value={`${ready} / ${slips.length}`} hint={`${scopedEmployees.length - slips.length} excluded from run`} />
        <MetricCard label="Gross earnings" icon={Wallet} value={rupees(summary.gross)} hint="Base and unit volume" />
        <MetricCard label="Adjustments" icon={TrendingUp} value={signed(summary.adjustments)} tone="brand" hint="Approved additions less deductions" />
        <MetricCard label="Advance recovery" icon={HandCoins} value={rupees(-summary.advance)} tone="danger" hint="Active loan instalments" />
        <MetricCard label="Statutory deductions" icon={MinusCircle} value={rupees(-summary.statutory)} hint="EPF, PT, ESIC, TDS" />
        <MetricCard label="Estimated net" value={rupees(summary.net)} tone="brand" highlight hint="Disbursement via NEFT / RTGS" />
      </MetricGrid>

      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={query} onChange={setQuery} label="Search calculations" placeholder="Search staff member, role or ID" className="min-w-56 flex-1" />
        <FilterSelect label="Branch" value={branch} onChange={setBranch} allLabel="All branches" options={PAYROLL_BRANCHES.map((entry) => entry.name)} />
        <FilterSelect label="Compensation model" value={model} onChange={setModel} allLabel="All compensation models" options={Object.values(PAY_MODELS).map((entry) => entry.label)} />
        <FilterSelect label="Calculation status" value={status} onChange={setStatus} allLabel="All calculation statuses" options={STAFF_STATUSES} />
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table headings={['Staff member', 'Role & branch', 'Compensation', 'Gross', 'Adjustments', 'Advance rec.', 'Deductions', 'Net pay', 'Status', 'Action']} minWidth={1080} empty={rows.length ? null : 'No calculations match your filters.'}>
          {rows.map((slip) => (
            <tr key={slip.employee.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-surface-lowest">
              <Cell>
                <EmployeeCell employee={slip.employee} />
              </Cell>
              <Cell>
                <p>{slip.employee.title}</p>
                <p className="text-[11px] text-outline">{branchName(slip.employee.branchId)}</p>
              </Cell>
              <Cell>
                <StatusPill>{PAY_MODELS[slip.employee.model]?.label ?? '—'}</StatusPill>
                <p className="mt-1 text-[11px] text-outline">{slip.employee.volumeNote}</p>
              </Cell>
              <Cell>{rupees(slip.gross)}</Cell>
              <Cell>
                <Amount tone={slip.adjustments ? 'add' : undefined}>{signed(slip.adjustments)}</Amount>
              </Cell>
              <Cell>
                <Amount tone={slip.advance ? 'deduct' : undefined}>{minus(slip.advance)}</Amount>
              </Cell>
              <Cell>{minus(slip.statutoryTotal)}</Cell>
              <Cell className="font-semibold">{rupees(slip.net)}</Cell>
              <Cell>
                <StatusPill tone={STAFF_TONES[slip.employee.status]}>{slip.employee.status}</StatusPill>
              </Cell>
              <Cell>
                <button type="button" onClick={() => setInspectId(slip.employee.id)} aria-label={`Inspect calculation for ${slip.employee.name}`} className="rounded p-1 text-on-surface-variant hover:bg-surface-low hover:text-brand">
                  <PanelRightOpen className="size-4" aria-hidden="true" />
                </button>
              </Cell>
            </tr>
          ))}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${slips.length} staff in this run`} />
      </div>

      <StepFooter
        summary={`Estimated net ${rupees(summary.net)} for ${summary.staff} staff`}
        back={{ to: ROUTES.payrollRunStaff, label: 'Back to review staff' }}
        next={ROUTES.payrollRunAdjustments}
        nextLabel="Continue to adjustments"
      />

      {inspected && (
        <Drawer
          open
          onClose={() => setInspectId(null)}
          eyebrow="Calculation detail"
          title={inspected.employee.name}
          description={`${inspected.employee.title} · ${inspected.employee.id} · ${branchName(inspected.employee.branchId)}`}
          footer={
            <ActionButton icon={Flag} className="w-full" disabled={locked} onClick={() => navigate(ROUTES.payrollAdjustmentNew, { state: { employeeId: inspected.employee.id } })}>
              Flag for adjustment
            </ActionButton>
          }
        >
          <Breakdown slip={inspected} />
        </Drawer>
      )}
    </>
  )
}
