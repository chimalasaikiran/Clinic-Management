import { Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, Scope, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money, SCOPE_TEXT } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { paymentRows } from '../financeLogic'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const ALLOCATION_STATES = ['Fully allocated', 'Partially allocated', 'Unallocated']
const ALLOCATION_TONE = { 'Fully allocated': 'success', 'Partially allocated': 'brand', Unallocated: 'warning' }

export default function PaymentRegisterPage() {
  const { records, getPatient } = usePatientRecords()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const nameOf = (id) => getPatient(id)?.name ?? 'Unknown patient'
  const query = filters.get('q')
  const rows = paymentRows(records, { query, method: filters.get('method'), status: filters.get('allocation'), range, patientName: nameOf })
  const methods = [...new Set(records.payments.map((payment) => payment.channel))]
  const desks = [...new Set(records.payments.map((payment) => payment.desk))]
  const visible = rows.filter(({ payment }) => !filters.get('desk') || payment.desk === filters.get('desk'))
  const state = { search: filters.search }

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Payments" code="BF-09 / Payments & receipts" title="Payment Register" description="Find recorded collections, inspect settlement status and review funds awaiting allocation." actions={<><ActionButton to={ROUTES.billingReceipts}>Receipt Register ↗</ActionButton><ActionButton variant="primary" icon={Plus} to={ROUTES.billingPaymentNew} state={state}>Record Payment</ActionButton></>} scope={false}>
      <Scope left={`${SCOPE_TEXT} / ${range.label} · All models`} />

      <Section title="Find payments" aside="Search within the available source records; filters preserve your return context." className="mb-6">
        <SearchBox value={query} onChange={(value) => filters.change('q', value)} label="Search payments" placeholder="Search payment ID, patient / payer or transaction reference" className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-5">
          <FilterField label="Date range" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
          <FilterField label="Branch / location" value={filters.get('desk')} onChange={(value) => filters.change('desk', value)} options={[['', `All locations (${desks.length})`], ...desks]} />
          <FilterField label="Method" value={filters.get('method')} onChange={(value) => filters.change('method', value)} options={[['', 'All methods'], ...methods]} />
          <FilterField label="Allocation status" value={filters.get('allocation')} onChange={(value) => filters.change('allocation', value)} options={[['', 'All statuses'], ...ALLOCATION_STATES]} />
          <div className="flex items-end"><ActionButton onClick={filters.reset} className="w-full">Reset filters</ActionButton></div>
        </div>
      </Section>

      <Section title="Payments" aside={<StatusPill>Source slice only</StatusPill>} className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{visible.length} source record{visible.length === 1 ? '' : 's'} · Newest first · Not an organization ledger</p>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Payment / date', 'Patient / payer', 'Method', 'Received', 'Allocation balance', 'Transaction status', 'Reference / action'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {visible.map(({ payment, name, allocated, unallocated, allocation }) => (
                <tr key={payment.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} state={state}>{payment.id} ↗</TextLink><br />{formatDate(payment.date)}<br /><span className="text-outline">{formatTime(payment.time)} IST</span></td>
                  <td className="px-6 py-4"><strong>{payment.payer.startsWith('Patient') ? name : payment.payer}</strong><br />{payment.payer.startsWith('Patient') ? getPatient(payment.patientId)?.mrn : `For ${name}`}<br /><span className="text-outline">{payment.desk}</span></td>
                  <td className="px-6 py-4">{payment.instrument.replace(/\s*\(.*\)$/, '')}</td>
                  <td className="px-6 py-4 text-sm font-semibold">{money(payment.amount)}</td>
                  <td className="px-6 py-4">{money(allocated)} allocated<br /><span className={unallocated > 0 ? 'text-brand' : 'text-outline'}>{money(unallocated)} unallocated</span><br /><StatusPill tone={ALLOCATION_TONE[allocation]} className="mt-1">{allocation}</StatusPill></td>
                  <td className="px-6 py-4"><StatusPill tone="success">Settled & Recorded</StatusPill><br /><span className="text-outline">Verified</span></td>
                  <td className="px-6 py-4">{payment.reference}<br /><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} state={state} className="mt-1 inline-block">Open payment details →</TextLink></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No payments match these filters.</p>}
        </div>
        <p className="mt-3 flex justify-between text-xs text-outline"><span>Showing {visible.length} of {rows.length} available payments</span><span>Page 1 of 1</span></p>
      </Section>

      <Banner title="Unallocated is not unavailable">Unallocated is the amount received less allocations and refunds. A paid invoice does not by itself establish a payment’s allocation; open the payment to see its allocations. No organization totals are inferred.</Banner>
      <GovernanceFooter code="BF-09">Settled payments are read-only. Allocations and receipts remain distinct linked records; corrections use separate governed records.</GovernanceFooter>
    </BillingFrame>
  )
}
