import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, Scope, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money, SCOPE_TEXT } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { CHARGE_STATUSES, chargeInvoiceStatus, chargeRows, chargeStatus, chargeTotal, INVOICE_STATUSES } from '../financeLogic'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const needsReview = (charge) => charge.lines.some((line) => !(line.price > 0))
const CHARGE_TONE = { Draft: 'neutral', Finalized: 'neutral' }

export default function ChargeRegisterPage() {
  const { records, getPatient } = usePatientRecords()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const [selectedId, setSelectedId] = useState(null)
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const nameOf = (id) => getPatient(id)?.name ?? 'Unknown patient'
  const query = filters.get('q')
  const rows = chargeRows(records, { query, status: filters.get('status'), invoice: filters.get('invoice'), branch: filters.get('branch'), range, patientName: nameOf })
  const inRange = chargeRows(records, { range, patientName: nameOf })
  const branches = [...new Set(records.charges.map((charge) => charge.branch))]
  const draft = inRange.find((charge) => chargeStatus(charge) === 'Draft')
  const selected = rows.find((charge) => charge.id === selectedId) ?? rows[0]
  const chargePath = (charge) => pathFor(ROUTES.billingCharge, { chargeId: charge.id })
  const state = { search: filters.search }

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Back to Billing & Finance' }} crumb="Billing & Finance / Charges" code="BF-04 / Billing & Finance" title="Charge Register" description="View amounts owed, review charge context and track invoice eligibility. Recording a charge does not collect payment." actions={<ActionButton variant="primary" icon={Plus} to={ROUTES.billingChargeNew}>Create Charge</ActionButton>} scope={false}>
      {draft && (
        <Banner tone="brand" title={`Draft saved · ${draft.id}`} className="mb-6" action={<ActionButton to={chargePath(draft)} state={state}>Open saved draft →</ActionButton>}>
          {nameOf(draft.patientId)} · {draft.reference} · {draft.branch}. No charge confirmed and no invoice issued.
        </Banner>
      )}
      <Scope left={`${SCOPE_TEXT} · Owner access`} />

      <h2 className="mb-3 flex items-baseline justify-between text-[17px] font-semibold">Charge overview <span className="text-xs font-normal text-outline">Counts in this view · Not organization totals</span></h2>
      <MetricStrip
        items={[
          { label: 'Visible charges', value: String(rows.length), hint: 'Current scope' },
          { label: 'Drafts', value: String(rows.filter((charge) => chargeStatus(charge) === 'Draft').length), hint: 'Configuration required' },
          { label: 'Needs review', value: String(rows.filter(needsReview).length), hint: 'Source inconsistency' },
          { label: 'Finalized', value: String(rows.filter((charge) => chargeStatus(charge) === 'Finalized').length), hint: 'Protected financial history' },
        ]}
        footer="“—” means unavailable, not zero. No monetary total is inferred."
      />

      <Section title="All charges" aside={`${rows.length} record${rows.length === 1 ? '' : 's'} · Newest first`} className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={query} onChange={(value) => filters.change('q', value)} label="Search charges" placeholder="Search charge ID, patient, encounter or service…" className="min-w-72 flex-1" />
          <button type="button" onClick={filters.reset} className="text-[13px] font-semibold text-brand hover:underline">Reset filters</button>
        </div>
        <div className="mb-3 grid gap-4 sm:grid-cols-4">
          <FilterField label="Date range" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
          <FilterField label="Branch" value={filters.get('branch')} onChange={(value) => filters.change('branch', value)} options={[['', `All locations (${branches.length})`], ...branches]} />
          <FilterField label="Charge status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...CHARGE_STATUSES]} />
          <FilterField label="Invoice status" value={filters.get('invoice')} onChange={(value) => filters.change('invoice', value)} options={[['', 'All invoice statuses'], ...INVOICE_STATUSES]} />
        </div>
        <p className="mb-4 text-[11px] text-outline">Only records in your permitted branches are shown.</p>

        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Charge ID / date', 'Patient / payer', 'Reference / branch', 'Service / item', 'Amount (₹)', 'Invoice status', 'Charge status'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map((charge) => {
                const status = chargeStatus(charge)
                const review = needsReview(charge)
                return (
                  <tr key={charge.id} onClick={() => setSelectedId(charge.id)} className={cn('cursor-pointer border-t border-slate-100 align-top hover:bg-surface-lowest', selected?.id === charge.id && 'bg-teal-50/50')}>
                    <td className="px-6 py-4"><TextLink to={chargePath(charge)} state={state}>{charge.id}</TextLink><br /><span className="text-outline">{formatDate(charge.date)}</span></td>
                    <td className="px-6 py-4"><strong className="font-medium">{nameOf(charge.patientId)}</strong><br /><span className="text-outline">{getPatient(charge.patientId)?.mrn} · Self-pay</span></td>
                    <td className="px-6 py-4">{charge.reference}<br /><span className="text-outline">{charge.branch}</span></td>
                    <td className="px-6 py-4">{charge.title}<br /><span className="text-outline">Qty {charge.lines.reduce((qty, line) => qty + line.qty, 0)}</span></td>
                    <td className="px-6 py-4">{review ? <>—<br /><span className="text-outline">Unavailable</span></> : <strong className="font-semibold">{money(chargeTotal(charge))}</strong>}</td>
                    <td className="px-6 py-4"><StatusPill tone={charge.invoiceId ? 'brand' : 'neutral'}>{chargeInvoiceStatus(charge)}</StatusPill>{charge.invoiceId && <><br /><Link to={pathFor(ROUTES.billingInvoice, { invoiceId: charge.invoiceId })} className="mt-1 inline-block text-[11px] text-brand hover:underline">{charge.invoiceId} ↗</Link></>}</td>
                    <td className="px-6 py-4"><StatusPill tone={review ? 'warning' : CHARGE_TONE[status]}>{review ? 'Needs review' : status}</StatusPill><br /><Link to={chargePath(charge)} state={state} className="mt-1 inline-block text-[11px] font-semibold text-brand hover:underline">{status === 'Draft' ? 'Continue draft →' : 'Review →'}</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No matching charges. Clear filters to see available records in your permitted branches, or create a charge in an authorized branch.</p>}
        </div>
        <p className="mt-3 text-xs text-outline">Showing {rows.length} of {inRange.length} · Open any row to review</p>
      </Section>

      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_400px]">
        {selected ? (
          <Section title={`Selected · ${selected.id}`} aside={chargeStatus(selected)}>
            <p className="text-[13px] font-semibold">{nameOf(selected.patientId)} · {getPatient(selected.patientId)?.mrn}</p>
            <p className="mt-2 text-xs leading-6 text-outline">{selected.reference} · {selected.branch}<br />{selected.title} · Self-pay</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className={cn('text-xs', needsReview(selected) ? 'text-amber-700' : 'text-on-surface-variant')}>{needsReview(selected) ? 'Price and tax setup required' : `Total ${money(chargeTotal(selected))}`}</p>
              <ActionButton to={chargePath(selected)} state={state}>{chargeStatus(selected) === 'Draft' ? 'Continue draft →' : 'Review →'}</ActionButton>
            </div>
          </Section>
        ) : <Section title="No charge selected">Choose a charge to see its context.</Section>}
        <Section title="Invoice eligibility is protected">
          <p className="text-xs leading-6 text-on-surface-variant">Drafts cannot be invoiced. Partially invoiced charges expose only their verified remaining eligible balance; invoiced portions stay locked.</p>
          <p className="mt-3 text-xs leading-5 text-outline">The same charge portion cannot be invoiced twice. Invoicing is blocked until links and amounts are verified.</p>
          <TextLink to={ROUTES.billingInvoiceNew} className="mt-3 inline-block text-xs">Create an invoice from eligible charges ↗</TextLink>
        </Section>
      </div>

      <GovernanceFooter code="BF-04">Charge ≠ Invoice ≠ Payment ≠ Receipt ≠ Allocation ≠ Refund. Branch access and authorization are checked on save. Finalized records are read-only; corrections require a permitted, auditable workflow.</GovernanceFooter>
    </BillingFrame>
  )
}
