import { useState } from 'react'
import { ArrowLeft, CalendarCheck, ChevronDown, ChevronRight, CircleCheck, Clock, Download, FileText, History, Lock, Users, Wallet } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Breadcrumb from '../../../components/workspace/Breadcrumb'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { TextInput } from '../../../components/workspace/FormControls'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import { MetricCard, MetricGrid, PayrollTabs } from '../components/PayrollKit'
import { usePayroll } from '../context/usePayroll'
import { rupees } from '../format'
import { branchName, sum } from '../payrollLogic'

const netOf = (cycle) => cycle.net

// One payslip of a processed run, with the bank reference (UTR) of its transfer once it is recorded.
function PayslipRow({ slip, onRecord }) {
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const record = async () => {
    if (reference.trim().length < 3) return setError('Enter the bank reference (UTR) of the transfer.')
    setBusy(true)
    const result = await onRecord(reference)
    setBusy(false)
    if (result.error) setError(result.error)
  }
  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <Cell>
        <p className="font-semibold">{slip.name}</p>
        <p className="text-[11px] text-outline">{slip.staffCode} · {slip.payslipRef}</p>
      </Cell>
      <Cell>{branchName(slip.branchId)}</Cell>
      <Cell>{rupees(slip.gross)}</Cell>
      <Cell className="font-semibold">{rupees(slip.net)}</Cell>
      <Cell>
        {slip.paymentRef ? (
          <>
            <StatusPill tone="success">Paid · {slip.paymentRef}</StatusPill>
            <p className="mt-1 text-[11px] text-outline">{slip.paidBy} · {slip.paidOn}</p>
          </>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            <TextInput label={`Bank reference for ${slip.name}`} name="reference" value={reference} onChange={(event) => { setReference(event.target.value); setError('') }} placeholder="UTR / cheque no." error={error} className="w-48" />
            <ActionButton size="sm" onClick={record} disabled={busy} className="mt-6">
              Record payment
            </ActionButton>
          </div>
        )}
      </Cell>
    </tr>
  )
}

export default function CycleHistoryPage() {
  const { history, recordPayment } = usePayroll()
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('')
  const [oldestFirst, setOldestFirst] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(history[0]?.month)

  const years = [...new Set(history.map((cycle) => cycle.month.slice(0, 4)))]
  const search = query.trim().toLowerCase()
  const rows = history
    .filter((cycle) => (!search || `${cycle.label} ${cycle.batchId}`.toLowerCase().includes(search)) && (!year || cycle.month.startsWith(year)))
    .sort((a, b) => (oldestFirst ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month)))
  const selected = history.find((cycle) => cycle.month === selectedMonth)
  const latest = history[0]

  const exportHistory = () =>
    exportCsv('payroll-cycle-history.csv', [
      ['Cycle', 'Batch ID', 'Gross', 'Net', 'Employees', 'Payment date'],
      ...rows.map((cycle) => [cycle.label, cycle.batchId, cycle.gross, netOf(cycle), cycle.employees, cycle.payDate]),
    ])
  const exportCycle = (cycle) =>
    exportCsv(`payroll-${cycle.month}.csv`, [
      ['Payslip', 'Employee ID', 'Name', 'Branch', 'Gross', 'Adjustments', 'Statutory', 'Advance recovery', 'Net', 'Bank reference'],
      ...cycle.payslips.map((slip) => [slip.payslipRef, slip.staffCode, slip.name, branchName(slip.branchId), slip.gross, slip.additions - slip.deductions, sum(slip.statutory, (line) => line.amount), slip.advance, slip.net, slip.paymentRef ?? '']),
    ])

  return (
    <WorkspacePage>
      <Breadcrumb items={[{ label: 'Payroll & salary', to: ROUTES.payroll }, { label: 'Cycle history' }]} />
      <PageIntro
        title="Payroll cycle history"
        description="Review previous payroll periods, employee payouts and payment records across your organization."
        actions={
          <>
            <ActionButton icon={ArrowLeft} to={ROUTES.payroll}>
              Back to payroll
            </ActionButton>
            <ActionButton variant="primary" icon={Download} onClick={exportHistory}>
              Export history
            </ActionButton>
          </>
        }
      />
      <PayrollTabs />

      {latest && (
        <MetricGrid>
          <MetricCard label="Completed cycles" icon={History} value={`${history.length} cycles`} hint={`${history.at(-1).label} – ${latest.label}`} />
          <MetricCard label="Total net payroll" icon={Wallet} value={rupees(sum(history, netOf))} hint="Disbursed across all branches" />
          <MetricCard label="Employees in latest cycle" icon={Users} value={`${latest.employees} staff`} hint={`${latest.label} payroll`} />
          <MetricCard label="Last payment date" icon={CalendarCheck} value={latest.payDate} hint={latest.paid ? 'All employee payouts recorded' : `${latest.status} · bank references outstanding`} />
        </MetricGrid>
      )}

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <h2 className="mr-auto text-base font-semibold text-slate-900">Previous cycles</h2>
          <SearchBox value={query} onChange={setQuery} label="Search cycles" placeholder="Search by cycle or batch ID" className="w-60" />
          <FilterSelect label="Year" value={year} onChange={setYear} allLabel="All years" options={years} />
          <ActionButton size="sm" onClick={() => setOldestFirst((current) => !current)}>
            {oldestFirst ? 'Oldest first' : 'Newest first'}
          </ActionButton>
        </div>
        <Table headings={['Cycle / period', 'Gross payroll', 'Net payroll', 'Employees', 'Payout status', 'Payment date', 'Details']} minWidth={820} empty={rows.length ? null : 'No cycles match your search.'}>
          {rows.map((cycle) => {
            const isSelected = cycle.month === selectedMonth
            return (
              <tr key={cycle.month} className={cn('border-b border-l-2 border-b-slate-100 last:border-b-0', isSelected ? 'border-l-brand bg-teal-50/40' : 'border-l-transparent hover:bg-surface-lowest')}>
                <Cell>
                  <p className={cn('font-semibold', isSelected && 'text-brand')}>{cycle.label}</p>
                  <p className="text-[11px] text-outline">
                    {cycle.start} — {cycle.end}
                  </p>
                </Cell>
                <Cell>{rupees(cycle.gross)}</Cell>
                <Cell className="font-semibold">{rupees(netOf(cycle))}</Cell>
                <Cell>{cycle.employees} staff</Cell>
                <Cell>
                  <StatusPill tone={cycle.paid ? 'success' : 'warning'}>
                    {cycle.paid ? <CircleCheck className="size-3" aria-hidden="true" /> : <Clock className="size-3" aria-hidden="true" />}
                    {cycle.status}
                  </StatusPill>
                </Cell>
                <Cell>{cycle.payDate}</Cell>
                <Cell>
                  <button type="button" onClick={() => setSelectedMonth(cycle.month)} aria-label={`View ${cycle.label}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                    {isSelected ? 'Viewing' : 'View'}
                    {isSelected ? <ChevronDown className="size-3" aria-hidden="true" /> : <ChevronRight className="size-3" aria-hidden="true" />}
                  </button>
                </Cell>
              </tr>
            )
          })}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${history.length} cycles`} />
      </section>

      {selected && (
        <section aria-label={`${selected.label} cycle details`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs text-outline">
                <Lock className="size-3" aria-hidden="true" /> Closed cycle · Read-only
              </p>
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-on-surface">
                {selected.label} cycle <StatusPill tone={selected.paid ? 'success' : 'warning'}>{selected.status}</StatusPill>
              </h2>
            </div>
            <ActionButton variant="primary" icon={FileText} onClick={() => exportCycle(selected)}>
              Export cycle
            </ActionButton>
          </div>
          <dl className="grid gap-4 px-5 pb-5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-on-surface-variant">Period dates</dt>
              <dd className="font-semibold">
                {selected.start} — {selected.end}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Batch ID</dt>
              <dd className="font-semibold">{selected.batchId}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Employees & scope</dt>
              <dd className="font-semibold">
                {selected.employees} staff · {selected.branches.length} branches
              </dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Payment date</dt>
              <dd className="font-semibold">{selected.payDate}</dd>
            </div>
          </dl>
          <p className="flex items-center gap-2 border-y border-teal-200 bg-teal-50 px-5 py-2.5 text-xs text-brand">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            {selected.paid ? `${rupees(netOf(selected))} paid to ${selected.employees} employees.` : `${rupees(netOf(selected))} payable to ${selected.employees} employees · ${selected.status}.`}
          </p>
          <div className="grid gap-6 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <h3 className="mb-3 text-[13px] font-semibold text-on-surface">Payroll breakdown</h3>
              <dl className="space-y-2.5 text-[13px]">
                {[
                  ['Gross payroll', rupees(selected.gross)],
                  ['Adjustments (+)', rupees(selected.adjustments)],
                  ['Statutory deductions (−)', rupees(selected.statutory)],
                  ['Advance recovery (−)', rupees(selected.advances)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-on-surface-variant">{label}</dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
                  <dt className="font-semibold">Net payroll paid</dt>
                  <dd className="text-xl font-bold text-brand">{rupees(netOf(selected))}</dd>
                </div>
              </dl>
            </div>
            <div className="min-w-0 overflow-hidden rounded-md border border-slate-200">
              <Table headings={['Branch', 'Staff', 'Gross', 'Net paid', 'Status']} minWidth={480}>
                {selected.branches.map((row) => (
                  <tr key={row.branchId} className="border-b border-slate-100 last:border-0">
                    <Cell className="font-semibold">{branchName(row.branchId)}</Cell>
                    <Cell>{row.staff}</Cell>
                    <Cell>{rupees(row.gross)}</Cell>
                    <Cell>{rupees(row.net)}</Cell>
                    <Cell>
                      <StatusPill tone={selected.payslips.filter((slip) => slip.branchId === row.branchId).every((slip) => slip.paymentRef) ? 'success' : 'warning'}>
                        {selected.payslips.filter((slip) => slip.branchId === row.branchId).every((slip) => slip.paymentRef) ? 'Paid' : 'Awaiting payment'}
                      </StatusPill>
                    </Cell>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
          <div className="border-t border-slate-200 p-5">
            <h3 className="mb-3 text-[13px] font-semibold text-on-surface">Payslips & payments</h3>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <Table headings={['Employee', 'Branch', 'Gross', 'Net pay', 'Payment']} minWidth={760}>
                {selected.payslips.map((slip) => (
                  <PayslipRow key={`${slip.entryId}-${slip.version}`} slip={slip} onRecord={(reference) => recordPayment(slip.entryId, reference, slip.version)} />
                ))}
              </Table>
            </div>
          </div>
          <p className="border-t border-slate-200 bg-surface-lowest px-5 py-3 text-xs text-on-surface-variant">
            Approved by {selected.approvedBy} · {selected.approvedOn} · Processed by {selected.processedBy} · {selected.processedOn}
          </p>
        </section>
      )}
    </WorkspacePage>
  )
}
