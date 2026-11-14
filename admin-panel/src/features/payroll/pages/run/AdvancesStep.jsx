import { useState } from 'react'
import { CalendarClock, CircleCheck, Clock, Eye, HandCoins, Hourglass, Plus, ShieldCheck, Wallet } from 'lucide-react'
import ActionButton from '../../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, SearchBox } from '../../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../../components/workspace/DataTable'
import Drawer from '../../../../components/workspace/Drawer'
import { Banner } from '../../../../components/workspace/RecordKit'
import StatusPill from '../../../../components/workspace/StatusPill'
import { ROUTES } from '../../../../config/routes'
import { cn } from '../../../../lib/cn'
import { EmployeeCell, MetricCard, MetricGrid, SummaryLine } from '../../components/PayrollKit'
import StepFooter from '../../components/StepFooter'
import { usePayroll } from '../../context/usePayroll'
import { ADVANCE_STATUSES, PAYROLL_BRANCHES } from '../../data/seed'
import { rupees } from '../../format'
import { advanceProgress, branchName, sum } from '../../payrollLogic'
import { ADVANCE_TONES } from '../../tones'

const NEXT_ACTION = {
  'Pending approval': 'Approve advance',
  'Pending disbursal': 'Record disbursal',
  'Awaiting acknowledgement': 'Record employee acknowledgement',
}

const SCHEDULE_TONES = { Recovered: 'success', 'This cycle': 'warning', Upcoming: 'neutral' }

function AdvanceDetail({ advance, employee, locked, onProgress }) {
  const progress = advanceProgress(advance)
  const percent = Math.round((progress.repaid / advance.principal) * 100)
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
        <EmployeeCell employee={employee} withBranch />
        <p className="mt-2 text-xs text-on-surface-variant">
          {employee.employment} · {employee.model === 'monthly' ? `Base ${rupees(employee.rate)}/mo` : employee.volumeNote}
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Sanction & disbursement</h3>
        <dl className="space-y-2">
          <SummaryLine label="Request origin" value={advance.source} />
          <SummaryLine label="Reason category" value={advance.category} />
          <SummaryLine label="Sanctioned by" value={advance.approvedBy ?? 'Awaiting approval'} />
          <SummaryLine label="Disbursed on" value={advance.disbursedOn ?? 'Not disbursed'} />
        </dl>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold tracking-wide text-outline uppercase">Repayment progress</h3>
          <span className="text-xs font-semibold text-brand">{percent}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Repayment progress">
          <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['Original', advance.principal],
            ['Repaid', progress.repaid],
            ['Remaining', progress.outstanding],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-slate-200 p-2">
              <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
              <dd className="text-[13px] font-semibold">{rupees(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Instalment matrix ({advance.installments} months)</h3>
        <ol className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {progress.schedule.map((row) => (
            <li key={row.number} className={cn('flex items-center justify-between gap-3 px-3 py-2 text-xs', row.state === 'This cycle' && 'bg-amber-50')}>
              <span>
                <span className="font-semibold">
                  Month {row.number} ({row.label})
                </span>
                <span className="block text-[11px] text-outline">Due {row.dueDate}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold">{rupees(row.amount)}</span>
                <StatusPill tone={SCHEDULE_TONES[row.state]}>{row.state}</StatusPill>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-md border border-teal-200 bg-teal-50/60 p-3 text-xs text-on-surface-variant">
        <p className="mb-1 font-semibold text-brand">Payroll auto-offset</p>
        {progress.current ? (
          <p>
            {rupees(progress.current.amount)} is deducted in this cycle's payroll as instalment {progress.current.number} of {advance.installments}.
          </p>
        ) : advance.status === 'Active' || advance.status === 'Settled' ? (
          <p>No instalment falls in this cycle.</p>
        ) : (
          <p>Recovery starts only after disbursal and the employee's acknowledgement.</p>
        )}
      </section>

      {NEXT_ACTION[advance.status] && (
        <ActionButton variant="primary" icon={CircleCheck} onClick={onProgress} disabled={locked}>
          {NEXT_ACTION[advance.status]}
        </ActionButton>
      )}
    </div>
  )
}

export default function AdvancesStep() {
  const { advances, getEmployee, progressAdvance, slips, locked } = usePayroll()
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('')
  const [status, setStatus] = useState('all')
  const [viewId, setViewId] = useState(null)

  const byStatus = (value) => advances.filter((advance) => advance.status === value)
  const active = byStatus('Active')
  const settled = byStatus('Settled')
  const presets = [{ id: 'all', label: 'All', count: advances.length }, ...ADVANCE_STATUSES.map((value) => ({ id: value, label: value, count: byStatus(value).length }))]

  const search = query.trim().toLowerCase()
  const branchId = PAYROLL_BRANCHES.find((entry) => entry.name === branch)?.id
  const rows = advances.filter((advance) => {
    const employee = getEmployee(advance.employeeId)
    return (
      (!search || `${employee.name} ${employee.id} ${advance.id}`.toLowerCase().includes(search)) &&
      (!branchId || employee.branchId === branchId) &&
      (status === 'all' || advance.status === status)
    )
  })
  const viewing = advances.find((advance) => advance.id === viewId)

  return (
    <>
      <MetricGrid className="lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Pending requests" icon={Clock} value={`${byStatus('Pending approval').length} requests`} hint={`${rupees(sum(byStatus('Pending approval'), (advance) => advance.principal))} awaiting approval`} />
        <MetricCard label="Active advances" icon={HandCoins} value={`${active.length} active`} tone="brand" hint="Recovering through payroll" />
        <MetricCard label="Outstanding balance" icon={Wallet} value={rupees(sum(active, (advance) => advanceProgress(advance).outstanding))} hint="Principal remaining" />
        <MetricCard label="Due this cycle" icon={CalendarClock} value={rupees(sum(slips, (slip) => slip.advance))} tone="brand" hint="Auto-deducted in this run" />
        <MetricCard label="Awaiting acknowledgement" icon={Hourglass} value={`${byStatus('Awaiting acknowledgement').length} advances`} tone="warning" hint="Disbursed, not yet signed" />
        <MetricCard label="Fully settled" icon={CircleCheck} value={`${settled.length} advances`} hint={`${rupees(sum(settled, (advance) => advance.principal))} recovered`} />
      </MetricGrid>

      <Banner tone="brand" title="Advances are financial agreements, not adjustments" className="mb-5">
        Once approved, disbursed and acknowledged by the employee, an advance's instalments are deducted automatically in each payroll cycle until
        the balance is cleared.
      </Banner>

      <section className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={query} onChange={setQuery} label="Search advances" placeholder="Search employee name, staff ID or advance ID" className="min-w-56 flex-1" />
          <FilterSelect label="Branch" value={branch} onChange={setBranch} allLabel="All branches" options={PAYROLL_BRANCHES.map((entry) => entry.name)} />
          <ActionButton variant="primary" icon={Plus} to={locked ? undefined : ROUTES.payrollAdvanceNew} disabled={locked}>
            New advance
          </ActionButton>
        </div>
        <FilterTabs options={presets} value={status} onChange={setStatus} label="Advance status" />
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table headings={['Advance ID', 'Employee', 'Branch', 'Source', 'Amount', 'Repaid', 'Outstanding', 'Schedule', 'Status', 'Action']} minWidth={1060} empty={rows.length ? null : 'No advances match your filters.'}>
          {rows.map((advance) => {
            const employee = getEmployee(advance.employeeId)
            const progress = advanceProgress(advance)
            return (
              <tr key={advance.id} className={cn('border-b border-slate-100 align-top last:border-0', advance.id === viewId ? 'bg-teal-50/40' : 'hover:bg-surface-lowest')}>
                <Cell className="font-semibold text-brand">{advance.id}</Cell>
                <Cell>
                  <EmployeeCell employee={employee} />
                </Cell>
                <Cell>{branchName(employee.branchId)}</Cell>
                <Cell>
                  <StatusPill>{advance.source}</StatusPill>
                </Cell>
                <Cell>{rupees(advance.principal)}</Cell>
                <Cell className={progress.repaid ? 'text-brand' : undefined}>{rupees(progress.repaid)}</Cell>
                <Cell className="font-semibold">{rupees(progress.outstanding)}</Cell>
                <Cell className="text-xs">
                  {advance.installments} × {rupees(progress.monthly)}
                  {progress.current && <p className="text-[11px] text-amber-700">Inst. {progress.current.number} due this cycle</p>}
                </Cell>
                <Cell>
                  <StatusPill tone={ADVANCE_TONES[advance.status]} dot>
                    {advance.status}
                  </StatusPill>
                </Cell>
                <Cell>
                  <button type="button" onClick={() => setViewId(advance.id)} aria-label={`View ${advance.id}`} className="rounded p-1 text-on-surface-variant hover:bg-surface-low hover:text-brand">
                    <Eye className="size-4" aria-hidden="true" />
                  </button>
                </Cell>
              </tr>
            )
          })}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${advances.length} advances`} />
      </div>

      <StepFooter summary={`${rupees(sum(slips, (slip) => slip.advance))} recovered from ${active.length} active advances this cycle`} back={{ to: ROUTES.payrollRunAdjustments, label: 'Back to adjustments' }} next={ROUTES.payrollRunReview} nextLabel="Continue to final review" />

      {viewing && (
        <Drawer open onClose={() => setViewId(null)} eyebrow={viewing.status} title={viewing.id} description={`${rupees(viewing.principal)} · ${viewing.installments} monthly instalments`}>
          <AdvanceDetail advance={viewing} employee={getEmployee(viewing.employeeId)} locked={locked} onProgress={() => progressAdvance(viewing.id)} />
        </Drawer>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-outline">
        <ShieldCheck className="size-3" aria-hidden="true" /> Instalments are capped at 35% of monthly gross. Each change is recorded in the payroll activity log.
      </p>
    </>
  )
}
