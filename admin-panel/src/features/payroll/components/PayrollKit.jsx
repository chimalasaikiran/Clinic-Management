import { Link, useLocation } from 'react-router-dom'
import Avatar from '../../../components/workspace/Avatar'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { branchName } from '../payrollLogic'

const TABS = [
  { label: 'Overview', to: ROUTES.payroll },
  { label: 'Cycle history', to: ROUTES.payrollHistory },
  { label: 'Employee advances', to: ROUTES.payrollRunAdvances },
  { label: 'Adjustments ledger', to: ROUTES.payrollRunAdjustments },
]

export function PayrollTabs() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Payroll sections" className="mb-5 flex gap-5 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => {
        const current = pathname === tab.to
        return (
          <Link
            key={tab.label}
            to={tab.to}
            aria-current={current ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              current ? 'border-brand text-brand' : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

const VALUE_TONES = { default: 'text-on-surface', brand: 'text-brand', danger: 'text-danger', warning: 'text-amber-700' }

export function MetricCard({ label, icon: Icon, value, hint, tone = 'default', highlight }) {
  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.04)]', highlight ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200')}>
      <div className="flex items-start justify-between gap-2">
        <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
        {Icon && <Icon className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />}
      </div>
      <dd className={cn('mt-2 text-2xl leading-8 font-bold', VALUE_TONES[tone])}>{value}</dd>
      {hint && <p className="mt-1 text-xs leading-4 text-on-surface-variant">{hint}</p>}
    </div>
  )
}

export function MetricGrid({ children, className }) {
  return <dl className={cn('mb-5 grid gap-4 sm:grid-cols-2', className ?? 'xl:grid-cols-4')}>{children}</dl>
}

export function EmployeeCell({ employee, withBranch = false }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar initials={employee.initials} size="sm" />
      <div className="min-w-0">
        <p className="font-semibold text-on-surface">{employee.name}</p>
        <p className="text-[11px] text-outline">
          {employee.id} · {employee.title}
          {withBranch && ` · ${branchName(employee.branchId)}`}
        </p>
      </div>
    </div>
  )
}

// Money column cell: right-aligned, tabular figures.
export function Amount({ children, tone, className }) {
  return <span className={cn('tabular-nums', tone === 'add' && 'text-brand', tone === 'deduct' && 'text-danger', className)}>{children}</span>
}

// Multi-select chip, e.g. a branch in the payroll scope selector.
export function ToggleChip({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        pressed ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-on-surface-variant hover:bg-surface-lowest',
      )}
    >
      {children}
    </button>
  )
}

// Label / value row used in the summary side panels.
export function SummaryLine({ label, value, tone, strong }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-[13px]', strong && 'border-t border-slate-200 pt-2.5 font-semibold')}>
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', tone === 'add' && 'text-brand', tone === 'deduct' && 'text-danger')}>{value}</dd>
    </div>
  )
}

// Instalment-by-instalment repayment plan of an advance.
export function ScheduleTable({ schedule }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="bg-surface-lowest text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">
          <tr>
            {['Instalment', 'Payroll cycle', 'Recovery date', 'Deduction', 'Closing balance'].map((heading) => (
              <th key={heading} scope="col" className="px-4 py-2.5">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr key={row.number} className={cn('border-t border-slate-100', row.closing === 0 && 'bg-teal-50/40')}>
              <td className="px-4 py-2.5 font-semibold text-brand">INS-{String(row.number).padStart(2, '0')}</td>
              <td className="px-4 py-2.5">{row.label}</td>
              <td className="px-4 py-2.5">{row.dueDate}</td>
              <td className="px-4 py-2.5 tabular-nums">₹{row.amount.toLocaleString('en-IN')}</td>
              <td className="px-4 py-2.5 tabular-nums">{row.closing === 0 ? 'Settled' : `₹${row.closing.toLocaleString('en-IN')}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
