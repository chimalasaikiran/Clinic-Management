import { Fragment, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, CircleCheck, Download, Printer, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Breadcrumb from '../../../components/workspace/Breadcrumb'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import { Amount, EmployeeCell, MetricCard, MetricGrid } from '../components/PayrollKit'
import { usePayroll } from '../context/usePayroll'
import { STAFF_STATUSES } from '../data/seed'
import { minus, rupees, signed } from '../format'
import { branchSummary, totals } from '../payrollLogic'
import { STAFF_TONES } from '../tones'

const ENTRY_TYPES = ['With adjustments', 'With advance recovery']

function LedgerDetail({ slip }) {
  return (
    <div className="grid gap-4 bg-surface-lowest px-4 py-3 text-xs text-on-surface-variant md:grid-cols-3">
      <div>
        <p className="font-semibold text-on-surface">Adjustments · {signed(slip.adjustments)}</p>
        {slip.approvedAdjustments.length
          ? slip.approvedAdjustments.map((entry) => (
              <p key={entry.id}>
                {entry.label} · {entry.direction === 'addition' ? signed(entry.amount) : minus(entry.amount)}
              </p>
            ))
          : <p>No approved adjustments this cycle.</p>}
      </div>
      <div>
        <p className="font-semibold text-on-surface">Advance recovery · {minus(slip.advance)}</p>
        {slip.advanceLines.length
          ? slip.advanceLines.map(({ advance, amount }) => (
              <p key={advance.id}>
                {advance.id} · {rupees(amount)} this cycle of {advance.installments} instalments
              </p>
            ))
          : <p>No advance instalment due.</p>}
      </div>
      <div>
        <p className="font-semibold text-on-surface">Statutory deductions · {minus(slip.statutoryTotal)}</p>
        {slip.statutory.map((line) => (
          <p key={line.label}>
            {line.label} · {rupees(line.amount)}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function BranchLedgerPage() {
  const { cycle, slips } = usePayroll()
  const branches = branchSummary(slips)
  const [branchId, setBranchId] = useState(branches.find((row) => row.staff)?.branch.id ?? branches[0].branch.id)
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [entryType, setEntryType] = useState('')
  const [expanded, setExpanded] = useState([])

  const selected = branches.find((row) => row.branch.id === branchId)
  const branchSlips = slips.filter((slip) => slip.employee.branchId === branchId)
  const departments = [...new Set(branchSlips.map((slip) => slip.employee.department))]
  const search = query.trim().toLowerCase()
  const rows = branchSlips.filter(
    (slip) =>
      (!search || `${slip.employee.name} ${slip.employee.id}`.toLowerCase().includes(search)) &&
      (!department || slip.employee.department === department) &&
      (!status || slip.employee.status === status) &&
      (entryType !== 'With adjustments' || slip.adjustments !== 0) &&
      (entryType !== 'With advance recovery' || slip.advance > 0),
  )
  const shown = totals(rows)
  const all = totals(slips)

  const resetFilters = () => {
    setQuery('')
    setDepartment('')
    setStatus('')
    setEntryType('')
  }
  const toggle = (id) => setExpanded((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const exportLedger = () =>
    exportCsv(`ledger-${selected.branch.name.toLowerCase().replace(/\s+/g, '-')}-${cycle.month}.csv`, [
      ['Employee ID', 'Name', 'Paid days / units', 'Gross', 'Adjustments', 'Advance recovery', 'Statutory', 'Net', 'Status'],
      ...branchSlips.map((slip) => [slip.employee.id, slip.employee.name, slip.employee.paidDays ?? slip.employee.units, slip.gross, slip.adjustments, slip.advance, slip.statutoryTotal, slip.net, slip.employee.status]),
    ])

  return (
    <WorkspacePage>
      <Breadcrumb items={[{ label: 'Payroll & salary', to: ROUTES.payroll }, { label: 'Detailed branch ledger' }]} />
      <PageIntro
        title="Detailed branch ledger"
        description="Review employee earnings, adjustments and deductions for each payroll branch."
        actions={
          <>
            <ActionButton icon={Printer} onClick={() => window.print()}>
              Print
            </ActionButton>
            <ActionButton variant="primary" icon={Download} onClick={exportLedger}>
              Export ledger
            </ActionButton>
          </>
        }
      />

      <section className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-[13px]">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            {cycle.label} cycle <StatusPill tone="info">Processing</StatusPill>
          </p>
          <p className="text-xs text-outline">Batch ID: {cycle.batchId}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Period dates</p>
          <p className="font-semibold">
            {cycle.start} — {cycle.end}
          </p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Payment scheduled</p>
          <p className="font-semibold text-brand">{cycle.payDate}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Batch currency</p>
          <p className="font-semibold">INR (₹)</p>
        </div>
        <ActionButton icon={ArrowRight} to={ROUTES.payrollHistory} className="ml-auto">
          Cycle history
        </ActionButton>
      </section>

      <div role="radiogroup" aria-label="Branch" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {branches.map((row) => {
          const isSelected = row.branch.id === branchId
          return (
            <button
              key={row.branch.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                setBranchId(row.branch.id)
                setExpanded([])
              }}
              className={cn('rounded-lg border bg-white p-4 text-left transition-colors', isSelected ? 'border-brand bg-teal-50/50' : 'border-slate-200 hover:bg-surface-lowest')}
            >
              <span className="flex items-center justify-between text-[13px] font-semibold text-on-surface">
                {row.branch.name}
                {isSelected && <CircleCheck className="size-4 text-brand" aria-hidden="true" />}
              </span>
              <span className="mt-0.5 block text-[11px] text-outline">
                {row.branch.code} · {row.staff} staff
              </span>
              <span className="mt-2 flex items-center justify-between">
                <span className="text-lg font-bold text-on-surface">{rupees(row.net)}</span>
                <StatusPill tone={row.staff ? 'success' : 'neutral'}>{row.staff ? 'Ready' : 'No staff'}</StatusPill>
              </span>
            </button>
          )
        })}
      </div>

      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-semibold">
        {selected.branch.name}
        <span className="text-xs font-normal text-outline">
          {selected.branch.code} · {selected.staff} staff
        </span>
      </h2>
      <MetricGrid className="lg:grid-cols-5">
        <MetricCard label="Gross payroll" value={rupees(selected.gross)} hint="Before adjustments & deductions" />
        <MetricCard label="Adjustments" value={signed(selected.adjustments)} tone="brand" hint="Approved additions less deductions" />
        <MetricCard label="Advance recovery (−)" value={rupees(-selected.advance)} hint="Scheduled instalments" />
        <MetricCard label="Statutory deductions (−)" value={rupees(-selected.statutory)} hint="EPF, PT, ESIC, TDS" />
        <MetricCard label="Net payroll" value={rupees(selected.net)} tone="brand" highlight hint={`Payable to ${selected.staff} employees`} />
      </MetricGrid>

      <Panel title="Employee ledger" subtitle={`Earnings and deductions · ${selected.branch.name} · ${cycle.label}`} bodyClassName="p-0" className="mb-5">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchBox value={query} onChange={setQuery} label="Search employees" placeholder="Search name or employee ID" className="min-w-56 flex-1" />
          <FilterSelect label="Department" value={department} onChange={setDepartment} allLabel="All departments" options={departments} />
          <FilterSelect label="Review status" value={status} onChange={setStatus} allLabel="All statuses" options={STAFF_STATUSES} />
          <FilterSelect label="Entry type" value={entryType} onChange={setEntryType} allLabel="All entries" options={ENTRY_TYPES} />
          <button type="button" onClick={resetFilters} className="text-xs font-semibold text-brand hover:underline">
            Reset filters
          </button>
        </div>
        <Table headings={['Employee', 'Paid days / units', 'Gross', 'Adjustments', 'Advance recovery', 'Statutory', 'Net payroll', 'Status']} minWidth={900} empty={rows.length ? null : 'No employees match your filters.'}>
          {rows.map((slip) => {
            const open = expanded.includes(slip.employee.id)
            return (
              <Fragment key={slip.employee.id}>
                <tr className={cn('border-b border-slate-100', open ? 'bg-teal-50/40' : 'hover:bg-surface-lowest')}>
                  <Cell>
                    <button type="button" onClick={() => toggle(slip.employee.id)} aria-expanded={open} aria-label={`Details for ${slip.employee.name}`} className="flex items-start gap-1.5 text-left">
                      {open ? <ChevronDown className="mt-1 size-3.5 shrink-0" aria-hidden="true" /> : <ChevronRight className="mt-1 size-3.5 shrink-0" aria-hidden="true" />}
                      <EmployeeCell employee={slip.employee} />
                    </button>
                  </Cell>
                  <Cell>{slip.employee.model === 'monthly' ? `${slip.employee.paidDays} / ${cycle.days}` : `${slip.employee.units} units`}</Cell>
                  <Cell>{rupees(slip.gross)}</Cell>
                  <Cell>
                    <Amount tone={slip.adjustments ? 'add' : undefined}>{slip.adjustments ? signed(slip.adjustments) : '—'}</Amount>
                  </Cell>
                  <Cell>{minus(slip.advance)}</Cell>
                  <Cell>{minus(slip.statutoryTotal)}</Cell>
                  <Cell className="font-semibold">{rupees(slip.net)}</Cell>
                  <Cell>
                    <StatusPill tone={STAFF_TONES[slip.employee.status]}>{slip.employee.status}</StatusPill>
                  </Cell>
                </tr>
                {open && (
                  <tr className="border-b border-slate-100">
                    <td colSpan={8}>
                      <LedgerDetail slip={slip} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          <tr className="bg-teal-50/50 text-[13px] font-semibold">
            <Cell>
              {selected.branch.name} total
              <p className="text-[11px] font-normal text-outline">{rows.length} of {branchSlips.length} entries shown</p>
            </Cell>
            <Cell>{shown.staff}</Cell>
            <Cell>{rupees(shown.gross)}</Cell>
            <Cell>
              <Amount tone="add">{signed(shown.adjustments)}</Amount>
            </Cell>
            <Cell>{minus(shown.advance)}</Cell>
            <Cell>{minus(shown.statutory)}</Cell>
            <Cell className="text-brand">{rupees(shown.net)}</Cell>
            <Cell />
          </tr>
        </Table>
      </Panel>

      <Panel title="Branch reconciliation" subtitle="Net = Gross + Adjustments − Advance recovery − Statutory deductions" bodyClassName="p-0" className="mb-5">
        <Table headings={['Branch', 'Staff', 'Gross', 'Adjustments', 'Recovery', 'Statutory', 'Net payroll']} minWidth={760}>
          {branches.map((row) => (
            <tr key={row.branch.id} className={cn('border-b border-slate-100', row.branch.id === branchId && 'bg-teal-50/40')}>
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
            <Cell>Sum of branch rows</Cell>
            <Cell>{all.staff}</Cell>
            <Cell>{rupees(all.gross)}</Cell>
            <Cell>
              <Amount tone="add">{signed(all.adjustments)}</Amount>
            </Cell>
            <Cell>{minus(all.advance)}</Cell>
            <Cell>{minus(all.statutory)}</Cell>
            <Cell className="text-brand">{rupees(all.net)}</Cell>
          </tr>
        </Table>
        <TableFooter summary="Branch rows reconcile to the batch total shown on the payroll overview." />
      </Panel>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-semibold">
              {selected.branch.name} · {selected.staff ? 'Ready for payroll review' : 'No staff in this run'}
            </p>
            <p className="text-xs text-on-surface-variant">
              {rupees(selected.net)} net · Batch release remains pending
            </p>
          </div>
        </div>
        <ActionButton icon={ArrowLeft} to={ROUTES.payroll}>
          Back to payroll
        </ActionButton>
      </section>
    </WorkspacePage>
  )
}
