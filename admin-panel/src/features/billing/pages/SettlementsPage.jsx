import { Copy, Search } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, Section } from '../../../components/workspace/RecordKit'
import { DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const PAYEE_TYPES = ['Doctor', 'Staff', 'Branch']

// Settlement rules and records have no source yet, so the page reports that plainly instead of showing zeros.
export default function SettlementsPage() {
  const { scopeText } = useBilling()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Back to Finance Workspace' }} crumb="Billing & Finance / Settlements" code="Billing & Finance" title="Settlements" description="Review doctor, staff or branch settlements only where configuration and authorized source records exist." actions={<ActionButton disabled>Export settlements</ActionButton>} scope={false}>
      <p className="mb-5 border-b border-slate-200 pb-4 text-[11px] text-outline">Return to Finance Workspace with {range.label} · {scopeText} · Billing model: All models · Queue context retained.</p>
      <div className="mb-6 grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <FilterField label="Requested period filter" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
        <FilterField label="Organization / branch" value="" disabled options={[['', scopeText]]} />
        <FilterField label="Settlement type" value={filters.get('type')} onChange={(value) => filters.change('type', value)} options={[['', 'All payee types'], ...PAYEE_TYPES]} />
        <p className="text-right text-[11px] text-outline">Currency: INR (₹) · Time: IST<br />Finance Manager · Settlement authority unverified</p>
      </div>

      <Banner tone="warning" title="Settlement configuration and source records unavailable" className="mb-6">No settlement rules, payees, periods, amounts or payment references were supplied. This is not a confirmed zero-settlement result. The requested date filter does not establish an actual settlement period.</Banner>

      <MetricStrip items={[
        { label: 'Gross settlement amount', value: null, hint: 'Source records unavailable' },
        { label: 'Adjustments / deductions', value: null, hint: 'No configured rules or amounts supplied' },
        { label: 'Net payable', value: null, hint: 'Cannot calculate without source records' },
        { label: 'Awaiting authorization', value: null, hint: 'Status and authorization not verified' },
      ]} />

      <section className="mb-6 rounded-md border border-slate-200 bg-white">
        <header className="flex flex-wrap items-start justify-between gap-3 p-6"><div><h2 className="text-[17px] font-semibold">Settlement register</h2><p className="mt-1 text-xs text-outline">Doctor / staff / branch · Records and rule coverage unavailable</p></div><div className="flex gap-3"><ActionButton disabled>Review selected</ActionButton><ActionButton disabled>Approve selected</ActionButton></div></header>
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <label className="block min-w-64 flex-1 text-xs font-medium text-on-surface-variant">Search payee or payment reference<span className="relative mt-1.5 block"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" aria-hidden="true" /><input type="search" disabled placeholder="Search doctor, staff or branch…" className="w-full rounded-md border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-[13px] disabled:bg-surface-lowest" /></span></label>
          <FilterField label="Status" value="" disabled options={[['', 'All statuses']]} className="w-56" />
          <p className="max-w-sm text-[11px] text-outline">Filters retained for when source records are available. No settlement selection is possible in this scope.</p>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Payee / type', 'Period', 'Gross (₹)', 'Adjustments', 'Deductions', 'Net payable', 'Status', 'Payment ref.', 'Action'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead><tbody /></table></div>
        <div className="flex flex-col items-center px-6 py-12 text-center"><Copy className="mb-3 size-7 text-outline" aria-hidden="true" /><h3 className="text-base font-semibold">Settlement records are not available</h3><p className="mt-2 max-w-xl text-[13px] leading-6 text-on-surface-variant">No doctor, staff or branch settlement records were provided. Amounts, adjustments, deductions, net payable and payment references cannot be displayed or inferred.</p><StatusPill className="mt-4">Unavailable · Not zero settlements</StatusPill></div>
        <p className="border-t border-slate-200 px-6 py-4 text-xs text-outline">Record count: unavailable · No rows selected · Review, approval and export remain disabled until prerequisites are met.</p>
      </section>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Section title="Configuration coverage" aside="">
          <p className="-mt-3 mb-4 text-xs text-outline">No eligibility, payout formula or frequency has been assumed.</p>
          <ul className="space-y-3 text-[13px]">{['Doctor', 'Staff', 'Branch'].map((type) => <li key={type} className="flex items-center justify-between"><span>{type} settlements</span><span className="text-xs text-outline">Configuration / records unavailable</span></li>)}</ul>
          <p className="mt-4 text-[11px] text-outline">Unavailable does not mean disabled in the organization. Configuration must be verified from an authoritative source.</p>
        </Section>
        <Section title="Before review or approval">
          <p className="text-[13px] font-semibold">Verify configuration, source records and settlement-specific permission.</p>
          <p className="mt-3 text-xs leading-5 text-on-surface-variant">Confirm the payee, period, gross basis, recorded adjustments, deductions and net payable from configured rules. Finance Manager is a role label, not proof of settlement authorization.</p>
          <p className="mt-3 text-xs text-outline">Finalized settlements remain read-only. Any correction requires a separate authorized, audited record.</p>
        </Section>
      </div>
      <GovernanceFooter>No settlement rules or records supplied. No payment, approval, deduction or configuration change is initiated from this view.</GovernanceFooter>
    </BillingFrame>
  )
}
