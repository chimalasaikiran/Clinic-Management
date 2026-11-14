import { useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, CircleCheck, Download, History, Landmark, Lock, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../../components/workspace/ActionButton'
import { RadioCard } from '../../../../components/workspace/controls'
import { Cell, Table } from '../../../../components/workspace/DataTable'
import Modal from '../../../../components/workspace/Modal'
import Panel from '../../../../components/workspace/Panel'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { cn } from '../../../../lib/cn'
import { exportCsv } from '../../../../lib/exportCsv'
import { Amount, MetricCard, MetricGrid, SummaryLine } from '../../components/PayrollKit'
import { usePayroll } from '../../context/usePayroll'
import { minus, rupees, signed } from '../../format'
import { approvalBlockers, branchSummary } from '../../payrollLogic'

export default function ProcessStep() {
  const { cycle, slips, summary, employees, adjustments, batch, processBatch } = usePayroll()
  const [confirmed, setConfirmed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const branches = branchSummary(slips)
  const blockers = approvalBlockers({ employees, adjustments })
  const approved = batch.status !== 'Draft'
  const processed = batch.status === 'Processed'
  const gates = [
    ['Payroll approval completed', approved],
    ['All included staff marked ready', !blockers.some((blocker) => blocker.includes('ready'))],
    ['Bank details verified', !blockers.some((blocker) => blocker.includes('bank'))],
    ['Adjustments decided', !blockers.some((blocker) => blocker.includes('adjustment'))],
    ['At least one payee included', summary.staff > 0],
  ]
  const ready = gates.every(([, ok]) => ok)

  const downloadSummary = () =>
    exportCsv(`payroll-summary-${cycle.month}.csv`, [
      ['Branch', 'Staff', 'Gross', 'Adjustments', 'Advance recovery', 'Statutory', 'Net'],
      ...branches.map((row) => [row.branch.name, row.staff, row.gross, row.adjustments, row.advance, row.statutory, row.net]),
      ['Total', summary.staff, summary.gross, summary.adjustments, summary.advance, summary.statutory, summary.net],
    ])

  const process = () => {
    processBatch()
    setDialogOpen(false)
  }

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Processing summary" icon={Landmark} subtitle={`Period ${cycle.start} – ${cycle.end} · Batch ${cycle.batchId}`} action={<StatusPill tone={processed ? 'success' : approved ? 'info' : 'warning'}>{batch.status}</StatusPill>}>
            <MetricGrid className="lg:grid-cols-3">
              <MetricCard label="Eligible staff" value={summary.staff} hint={`Across ${branches.filter((row) => row.staff).length} branches`} />
              <MetricCard label="Gross payroll" value={rupees(summary.gross)} />
              <MetricCard label="Approved adjustments" value={signed(summary.adjustments)} tone="brand" />
              <MetricCard label="Advance recovery" value={rupees(-summary.advance)} tone="warning" />
              <MetricCard label="Statutory deductions" value={rupees(-summary.statutory)} tone="danger" />
              <MetricCard label="Net payable payroll" value={rupees(summary.net)} tone="brand" highlight />
            </MetricGrid>
            <p className="text-xs text-on-surface-variant">{approved ? `Approved by ${batch.approvedBy} on ${batch.approvedOn}` : 'This batch has not been approved yet.'}</p>
          </Panel>

          <Panel title="Pre-processing readiness" icon={ShieldCheck} action={<StatusPill tone={ready ? 'success' : 'warning'}>{gates.filter(([, ok]) => ok).length} of {gates.length} gates passed</StatusPill>}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {gates.map(([label, ok]) => (
                <li key={label} className={cn('flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs', ok ? 'border-teal-200 bg-teal-50/60 text-brand' : 'border-amber-200 bg-amber-50 text-amber-900')}>
                  {ok ? <CircleCheck className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
                  {label}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Processing method" icon={Building2} bodyClassName="flex flex-col gap-4">
            <RadioCard name="method" value="ledger" checked onChange={() => {}} title="Payroll batch processing (ledger record)" detail="Locks the calculations, records instalment recoveries against each advance and creates the payroll record for payslips." badge={<StatusPill tone="brand">Selected</StatusPill>} />
            <Banner tone="warning" title="No money is transferred from this screen">
              Processing records the batch as processed. Employee bank transfers still need to be released through your bank or a connected payment integration.
            </Banner>
          </Panel>

          <Panel title="Branch breakdown" icon={Building2} bodyClassName="p-0">
            <Table headings={['Branch', 'Employees', 'Gross', 'Advance recovery', 'Statutory', 'Net payroll']} minWidth={680}>
              {branches.map((row) => (
                <tr key={row.branch.id} className="border-b border-slate-100">
                  <Cell className="font-semibold">
                    {row.branch.name} <span className="font-normal text-outline">{row.branch.code}</span>
                  </Cell>
                  <Cell>{row.staff} staff</Cell>
                  <Cell>{rupees(row.gross)}</Cell>
                  <Cell>
                    <Amount tone="deduct">{minus(row.advance)}</Amount>
                  </Cell>
                  <Cell>{minus(row.statutory)}</Cell>
                  <Cell className="font-semibold">{rupees(row.net)}</Cell>
                </tr>
              ))}
              <tr className="bg-surface-lowest text-[13px] font-semibold">
                <Cell>Total consolidated</Cell>
                <Cell>{summary.staff} staff</Cell>
                <Cell>{rupees(summary.gross)}</Cell>
                <Cell>
                  <Amount tone="deduct">{minus(summary.advance)}</Amount>
                </Cell>
                <Cell>{minus(summary.statutory)}</Cell>
                <Cell className="text-brand">{rupees(summary.net)}</Cell>
              </tr>
            </Table>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {processed ? (
            <Panel title="Payroll processed" icon={CircleCheck}>
              <dl className="mb-4 space-y-2">
                <SummaryLine label="Batch record" value={cycle.batchId} />
                <SummaryLine label="Net ledger amount" value={rupees(summary.net)} />
                <SummaryLine label="Processed on" value={batch.processedOn} />
              </dl>
              <div className="flex flex-col gap-2">
                <ActionButton icon={History} to={ROUTES.payrollHistory}>
                  View payroll history
                </ActionButton>
                <ActionButton to={ROUTES.payroll}>
                  Back to payroll overview <ArrowRight className="size-3.5" aria-hidden="true" />
                </ActionButton>
                <ActionButton icon={Download} onClick={downloadSummary}>
                  Download payroll summary
                </ActionButton>
              </div>
            </Panel>
          ) : (
            <Panel title="Ready to process payroll?" icon={Lock} subtitle="Final step of this run">
              <p className="mb-4 text-xs leading-5 text-on-surface-variant">Processing locks this payroll run against further changes and records it in the payroll history.</p>
              <label className="mb-4 flex items-start gap-2 rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!ready} className="mt-0.5 accent-[#006a61]" />
                I confirm that the approved payroll details have been reviewed and are ready for processing.
              </label>
              <ActionButton variant="primary" icon={Lock} className="w-full" onClick={() => setDialogOpen(true)} disabled={!ready || !confirmed}>
                Process payroll
              </ActionButton>
              {!approved && (
                <Link to={ROUTES.payrollRunReview} className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-brand hover:underline">
                  <ArrowLeft className="size-3" aria-hidden="true" /> Back to approval
                </Link>
              )}
              <button type="button" onClick={downloadSummary} className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-on-surface-variant hover:text-on-surface">
                <Download className="size-3" aria-hidden="true" /> Download pre-processing summary
              </button>
            </Panel>
          )}
        </div>
      </div>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        eyebrow="Confirmation"
        title={`Process ${cycle.label} payroll?`}
        description={`You are about to process payroll for ${summary.staff} employees with a net payroll of ${rupees(summary.net)}. After processing, this run is read-only.`}
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton onClick={() => setDialogOpen(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={Lock} onClick={process}>
              Confirm & process
            </ActionButton>
          </div>
        }
      >
        <dl className="grid gap-3 px-6 py-4 sm:grid-cols-2">
          <SummaryLine label="Payroll period" value={`${cycle.start} – ${cycle.end}`} />
          <SummaryLine label="Employees" value={`${summary.staff} staff`} />
          <SummaryLine label="Net payroll" value={rupees(summary.net)} />
          <SummaryLine label="Advance recovery" value={rupees(-summary.advance)} />
        </dl>
      </Modal>
    </>
  )
}
