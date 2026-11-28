import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { OptionSelect } from '../../patients/components/parts'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { patientBalances } from '../financeLogic'
import { refundContext } from '../refundData'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const UNAVAILABLE = [
  ['Wallet balance', 'No wallet ledger supplied; not added to prepaid funds.'],
  ['Family advances / wallet', 'No family membership or shared-funds ledger supplied.'],
  ['Credit limit / available credit', 'Credit agreement and limit not supplied.'],
  ['Used credit / credit owed', 'No credit usage ledger. Invoice receivable is not used credit.'],
]
const EFFECT_PATH = { payment: ROUTES.billingPayment, refund: ROUTES.billingRefund }

export default function BalancesPage() {
  const { records, patients, getPatient, refundRequests, scopeText } = useBilling()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id, patient: patients[0]?.id ?? '' })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const patient = getPatient(filters.get('patient'))
  const { refunds } = refundContext(records, refundRequests)
  const balances = patient ? patientBalances(records, refunds, patient.id) : null
  const gross = balances ? balances.slice.reduce((sum, entry) => sum + entry.received - entry.allocated, 0) : 0
  const processed = balances ? balances.slice.reduce((sum, entry) => sum + entry.processed, 0) : 0
  const sliceIds = balances?.slice.map((entry) => entry.payment.id) ?? []
  const history = (balances?.history ?? []).filter((item) => !item.date || (item.date >= range.from && item.date <= range.to))
  const spendablePayment = balances?.slice.find((entry) => entry.remaining > 0)?.payment
  const state = { search: filters.search }
  const link = (item) => (item.kind === 'allocation' ? pathFor(ROUTES.billingPayment, { paymentId: item.paymentId }) : pathFor(EFFECT_PATH[item.kind], item.kind === 'payment' ? { paymentId: item.id } : { refundId: item.id }))

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Back to Finance Workspace' }} crumb="Billing & Finance / Advances, Credit & Wallet" code="Billing & Finance" title="Advances, Credit & Wallet Balances" description="Separate prepaid funds held for a patient from wallet balances, credit facilities and invoice amounts owed." scope={false}>
      <p className="mb-5 border-b border-slate-200 pb-4 text-[11px] text-outline">Return to Finance Workspace with {range.label} · All locations (3) · Billing model: All models · Queue context retained.</p>
      <div className="mb-5 grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <FilterField label="Date range · Source records" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
        <FilterField label="Organization / branch" value="" disabled options={[['', scopeText]]} />
        <FilterField label="Scope · Patient / family" value="patient" disabled options={[['patient', 'Patient']]} />
        <p className="text-right text-[11px] text-outline">Currency: INR (₹) · Time: IST<br />Finance Manager · Source-slice view</p>
      </div>
      <div className="mb-6 grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <OptionSelect label="Search patient, family or record ID" value={filters.get('patient')} onChange={(event) => filters.change('patient', event.target.value)} options={patients.map((entry) => ({ value: entry.id, label: `${entry.name} / ${entry.mrn}` }))} />
        <p className="text-xs text-outline">{patient ? <><strong className="text-[13px] text-on-surface">{patient.name} · {patient.mrn}</strong><br />Patient view selected · Family view has no supplied balances or membership data.</> : 'Select a patient.'}</p>
      </div>

      {balances && (
        <>
          <Banner tone="neutral" title={`Coverage: ${sliceIds.join(', ') || 'No payment with held funds'} only · Not a complete patient or family balance`} className="mb-6">
            {balances.slice.length ? `${money(gross)} gross pre-refund unallocated − ${money(processed)} completed refund = ${money(balances.held)} held prepaid funds. ${money(balances.reserve)} is reserved for pending refunds, leaving ${money(balances.spendable)} spendable.` : `${patient.name} has no payment with unapplied funds in this source slice.`}
          </Banner>
          <MetricStrip items={[
            { label: 'Held prepaid funds', value: money(balances.held), hint: `After ${money(processed)} processed refund · Not a wallet total` },
            { label: 'Pending refund reserve', value: money(balances.reserve), hint: 'Included in held funds' },
            { label: 'Spendable prepaid funds', value: money(balances.spendable), hint: 'Held funds less pending reserve' },
            { label: 'Used through allocation', value: money(balances.used), hint: 'Existing allocations · Not classified as used credit' },
          ]} />

          <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_432px]">
            <Section title="Wallet, family & credit availability" aside="Unavailable means not supplied, not zero or confirmed unconfigured.">
              <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Balance type', 'Balance', 'Coverage / distinction'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
                <tbody>{UNAVAILABLE.map(([type, note]) => <tr key={type} className="border-t border-slate-100"><td className="px-6 py-4 text-[13px] font-semibold">{type}</td><td className="px-6 py-4">Unavailable</td><td className="px-6 py-4 text-on-surface-variant">{note}</td></tr>)}</tbody></table></div>
            </Section>
            <Section title="Invoice amount owed" aside={<StatusPill tone="warning">Receivable</StatusPill>}>
              <p className="text-[32px] font-semibold">{money(balances.owed)}</p>
              {balances.openInvoice ? <><p className="mt-3 text-xs text-outline">Linked invoice</p><Link to={pathFor(ROUTES.billingInvoice, { invoiceId: balances.openInvoice.id })} className="text-[13px] font-semibold text-brand hover:underline">{balances.openInvoice.id} ↗</Link></> : <p className="mt-3 text-xs text-outline">No invoice with a balance due.</p>}
              <p className="mt-3 text-xs leading-5 text-on-surface-variant">This is owed by the patient. It is not a wallet balance or credit usage without a credit agreement. It is not netted against reserved funds.</p>
              <ActionButton className="mt-4" disabled={!spendablePayment} to={spendablePayment ? pathFor(ROUTES.billingAllocation, { paymentId: spendablePayment.id }) : undefined}>Allocate prepaid funds</ActionButton>
              <p className="mt-2 text-[11px] text-outline">{money(balances.spendable)} spendable · {balances.spendable ? 'Allocation needs confirmation' : 'No additional allocation available'}</p>
            </Section>
          </div>

          <Section title="Transaction history & linked records" aside={spendablePayment || sliceIds[0] ? <ActionButton to={pathFor(ROUTES.billingPayment, { paymentId: sliceIds[0] })} state={state}>Open original payment ↗</ActionButton> : undefined} className="mb-6">
            <p className="-mt-3 mb-4 text-xs text-outline">{patient.name} / {sliceIds.join(', ') || 'no'} slice · Known dated events newest first; undated source records listed separately.</p>
            <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Date / time', 'Record / type', 'Amount (INR)', 'Balance effect', 'Linked source'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
              <tbody>{history.map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="border-t border-slate-100 align-top">
                  <td className="px-6 py-4">{item.date ? <>{formatDate(item.date)}<br /><span className="text-outline">{item.time ? `${formatTime(item.time)} IST` : 'Time unavailable'}</span></> : <>Date unavailable<br /><span className="text-outline">Timestamp not supplied</span></>}</td>
                  <td className="px-6 py-4"><TextLink to={link(item)} state={state}>{item.id} ↗</TextLink><br /><span className="text-outline">{item.label}</span></td>
                  <td className="px-6 py-4 font-semibold">{money(item.amount)}</td>
                  <td className="px-6 py-4">{item.effect}</td>
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: item.paymentId })} state={state}>{item.paymentId} ↗</TextLink></td>
                </tr>))}</tbody></table>
              {history.length === 0 && <p className="px-6 py-8 text-center text-xs text-outline">No linked records for this patient in the selected range.</p>}
            </div>
          </Section>
        </>
      )}

      <Banner tone="warning" title="One set of funds, counted once" className="mb-6">Advances, wallets, payments, allocations and refunds are distinct records. Do not add the refund reserve to held funds, add a wallet without checking overlap, or treat a receipt or allocation as a new collection.</Banner>
      <GovernanceFooter>Completed refunds and settled payments are read-only. Revalidate source balances before any authorized allocation or refund; corrections require separate audited records.</GovernanceFooter>
    </BillingFrame>
  )
}
