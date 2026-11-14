import { ArrowRight, Building2, CircleCheck, Equal, HandCoins, Layers, Minus, Plus, ShieldCheck, TriangleAlert } from 'lucide-react'
import ActionButton from '../../../../components/workspace/ActionButton'
import { Cell, Table } from '../../../../components/workspace/DataTable'
import Panel from '../../../../components/workspace/Panel'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { Amount, MetricCard, MetricGrid, SummaryLine } from '../../components/PayrollKit'
import StepFooter from '../../components/StepFooter'
import { usePayroll } from '../../context/usePayroll'
import { PAY_MODELS } from '../../data/seed'
import { minus, rupees, signed } from '../../format'
import { advanceProgress, approvalBlockers, branchSummary, sum } from '../../payrollLogic'

// Groups line items by label and sums them, e.g. statutory deductions across all payslips.
function groupTotals(lines) {
  const totalsByLabel = new Map()
  for (const { label, amount } of lines) totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + amount)
  return [...totalsByLabel].map(([label, amount]) => ({ label, amount }))
}

function ComponentGroup({ title, total, tone, items }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{title}</p>
        <Amount tone={tone} className="font-semibold">
          {total}
        </Amount>
      </div>
      {items.length ? (
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded border border-slate-100 bg-surface-lowest p-2">
              <dt className="text-[11px] text-on-surface-variant">{item.label}</dt>
              <dd className="text-[13px] font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-outline">Nothing in this batch.</p>
      )}
    </div>
  )
}

export default function FinalReviewStep() {
  const { cycle, slips, summary, employees, adjustments, batch, approveBatch, locked } = usePayroll()
  const branches = branchSummary(slips)
  const blockers = approvalBlockers({ employees, adjustments })
  const advanceLines = slips.flatMap((slip) => slip.advanceLines.map((line) => ({ ...line, employee: slip.employee })))

  const grossByModel = Object.entries(PAY_MODELS)
    .map(([id, model]) => ({ label: model.label, value: rupees(sum(slips.filter((slip) => slip.employee.model === id), (slip) => slip.gross)) }))
    .filter((item) => item.value !== '₹0')
  const adjustmentItems = groupTotals(slips.flatMap((slip) => slip.approvedAdjustments.map((entry) => ({ label: entry.category, amount: entry.direction === 'addition' ? entry.amount : -entry.amount })))).map((item) => ({ label: item.label, value: signed(item.amount) }))
  const statutoryItems = groupTotals(slips.flatMap((slip) => slip.statutory)).map((item) => ({ label: item.label, value: rupees(-item.amount) }))

  return (
    <>
      <MetricGrid className="lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Staff included" value={`${summary.staff} staff`} hint={`${branches.filter((row) => row.staff).length} branches`} />
        <MetricCard label="Gross earnings" value={rupees(summary.gross)} />
        <MetricCard label="Approved adjustments" value={signed(summary.adjustments)} tone="brand" />
        <MetricCard label="Advance recovery" value={rupees(-summary.advance)} tone="warning" hint={`${advanceLines.length} contractual offsets`} />
        <MetricCard label="Statutory deductions" value={rupees(-summary.statutory)} tone="danger" hint="EPF, ESIC, PT, TDS" />
        <MetricCard label="Final net payroll" value={rupees(summary.net)} tone="brand" highlight hint="Total disbursal value" />
      </MetricGrid>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Financial consolidation" icon={Layers} subtitle={`Reconciled batch ledger ${cycle.batchId}`}>
            <div className="flex flex-wrap items-center gap-3 text-center">
              {[
                ['Gross earnings', rupees(summary.gross), null],
                ['Adjustments', signed(summary.adjustments), Plus],
                ['Advance recovery', rupees(summary.advance), Minus],
                ['Statutory deductions', rupees(summary.statutory), Minus],
              ].map(([label, value, Sign]) => (
                <div key={label} className="flex items-center gap-3">
                  {Sign && <Sign className="size-4 text-outline" aria-hidden="true" />}
                  <div className="rounded-md border border-slate-200 px-4 py-3">
                    <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                </div>
              ))}
              <Equal className="size-4 text-outline" aria-hidden="true" />
              <div className="rounded-md border border-teal-200 bg-teal-50/60 px-4 py-3">
                <p className="text-[10px] font-semibold tracking-wide text-brand uppercase">Final net payroll</p>
                <p className="text-lg font-bold text-brand">{rupees(summary.net)}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-on-surface-variant">Advance recovery is an internal offset against money already paid to the employee, kept separate from statutory taxes.</p>
          </Panel>

          <Panel title="Multi-branch payroll summary" icon={Building2} bodyClassName="p-0">
            <Table headings={['Branch', 'Active staff', 'Gross', 'Adjustments', 'Advance rec.', 'Statutory', 'Net disbursal']} minWidth={760}>
              {branches.map((row) => (
                <tr key={row.branch.id} className="border-b border-slate-100">
                  <Cell>
                    <p className="font-semibold">{row.branch.name}</p>
                    <p className="text-[11px] text-outline">{row.branch.code}</p>
                  </Cell>
                  <Cell>{row.staff}</Cell>
                  <Cell>{rupees(row.gross)}</Cell>
                  <Cell>
                    <Amount tone="add">{signed(row.adjustments)}</Amount>
                  </Cell>
                  <Cell>{minus(row.advance)}</Cell>
                  <Cell>{minus(row.statutory)}</Cell>
                  <Cell className="font-semibold">{rupees(row.net)}</Cell>
                </tr>
              ))}
              <tr className="bg-surface-lowest text-[13px] font-semibold">
                <Cell>Consolidated total</Cell>
                <Cell>{summary.staff}</Cell>
                <Cell>{rupees(summary.gross)}</Cell>
                <Cell>
                  <Amount tone="add">{signed(summary.adjustments)}</Amount>
                </Cell>
                <Cell>{minus(summary.advance)}</Cell>
                <Cell>{minus(summary.statutory)}</Cell>
                <Cell className="text-brand">{rupees(summary.net)}</Cell>
              </tr>
            </Table>
          </Panel>

          <Panel title="Consolidated payroll components" bodyClassName="flex flex-col gap-3">
            <ComponentGroup title="1. Gross earnings by pay model" total={rupees(summary.gross)} items={grossByModel} />
            <ComponentGroup title="2. Approved adjustments" total={signed(summary.adjustments)} tone="add" items={adjustmentItems} />
            <ComponentGroup title="3. Employee advance recoveries" total={rupees(-summary.advance)} tone="deduct" items={advanceLines.map((line) => ({ label: `${line.advance.id} · ${line.employee.name}`, value: rupees(-line.amount) }))} />
            <ComponentGroup title="4. Statutory deductions" total={rupees(-summary.statutory)} tone="deduct" items={statutoryItems} />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Employee advance recovery" icon={HandCoins} action={<StatusPill>{advanceLines.length} staff</StatusPill>}>
            <ul className="space-y-2">
              {advanceLines.map(({ advance, amount, employee }) => {
                const progress = advanceProgress(advance)
                return (
                  <li key={advance.id} className="rounded-md border border-slate-200 p-3 text-xs">
                    <p className="flex justify-between font-semibold">
                      {employee.name} <span className="text-danger">{rupees(-amount)}</span>
                    </p>
                    <p className="text-outline">
                      Instalment {progress.current.number} of {advance.installments} · Remaining after run {rupees(progress.outstanding - amount)}
                    </p>
                  </li>
                )
              })}
              {!advanceLines.length && <p className="text-xs text-outline">No advance instalments in this batch.</p>}
            </ul>
          </Panel>

          <Panel title="Pre-approval checks" icon={ShieldCheck} action={<StatusPill tone={blockers.length ? 'warning' : 'success'}>{blockers.length ? `${blockers.length} open` : 'All passed'}</StatusPill>}>
            {blockers.length ? (
              <ul className="space-y-2">
                {blockers.map((blocker) => (
                  <li key={blocker} className="flex items-start gap-2 text-xs text-amber-900">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {blocker}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2 text-xs text-brand">
                {['All included staff marked ready', 'Bank details verified for every payee', 'Every adjustment decided', 'Advance schedules reconciled'].map((check) => (
                  <li key={check} className="flex items-center gap-2">
                    <CircleCheck className="size-3.5" aria-hidden="true" />
                    {check}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Approval" icon={ShieldCheck}>
            {batch.status === 'Draft' ? (
              <>
                <dl className="mb-4 space-y-2">
                  <SummaryLine label="Target batch" value={cycle.label} />
                  <SummaryLine label="Payees" value={summary.staff} />
                  <SummaryLine label="Total net payout" value={rupees(summary.net)} />
                  <SummaryLine label="Disbursal target" value={cycle.payDate} />
                </dl>
                <ActionButton variant="primary" icon={CircleCheck} className="w-full" onClick={approveBatch} disabled={locked || blockers.length > 0}>
                  Approve batch for processing
                </ActionButton>
                {blockers.length > 0 && <p className="mt-2 text-[11px] text-on-surface-variant">Resolve the open checks above to approve.</p>}
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-brand">
                  <CircleCheck className="size-4" aria-hidden="true" /> Approved by {batch.approvedBy}
                </p>
                <p className="mb-4 text-xs text-outline">{batch.approvedOn}</p>
                <ActionButton variant="primary" to={ROUTES.payrollRunProcess} className="w-full">
                  Continue to process payroll <ArrowRight className="size-3.5" aria-hidden="true" />
                </ActionButton>
              </>
            )}
          </Panel>
        </div>
      </div>

      <StepFooter
        summary={`${cycle.batchId} · ${summary.staff} staff · Net ${rupees(summary.net)}`}
        back={{ to: ROUTES.payrollRunAdvances, label: 'Back to employee advances' }}
        next={ROUTES.payrollRunProcess}
        nextLabel="Continue to process payroll"
        nextDisabled={batch.status === 'Draft'}
      />
    </>
  )
}
