import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useBilling } from '../context/useBilling'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { GovernanceFooter, Scope, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { receiptRows } from '../financeLogic'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

export default function ReceiptRegisterPage() {
  const { records, getPatient, scopeText } = useBilling()
  const filters = useRegisterFilters()
  const nameOf = (id) => getPatient(id)?.name ?? 'Unknown patient'
  const query = filters.get('q')
  const rows = receiptRows(records, { query, patientName: nameOf })
  const state = { search: filters.search }

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Receipts" code="Payments & receipts" title="Receipt Register" description="Find the receipt issued with each recorded payment, then open it to print or download." actions={<ActionButton to={ROUTES.billingPayments}>Payment Register ↗</ActionButton>} scope={false}>
      <Scope left={`${scopeText} / All recorded dates · All models`} />

      <Section title="Find receipts" aside="Every payment is given a receipt number when it is recorded." className="mb-6">
        <SearchBox value={query} onChange={(value) => filters.change('q', value)} label="Search receipts" placeholder="Search receipt number, patient / payer or payment reference" className="mb-4" />
        <div className="flex justify-end"><ActionButton onClick={filters.reset}>Reset filters</ActionButton></div>
      </Section>

      <Section title="Receipts" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{rows.length} receipt{rows.length === 1 ? '' : 's'} · newest first</p>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Receipt number', 'Date', 'Patient / payer', 'Payment reference', 'Amount (INR)', 'Status', 'Actions'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ payment, receiptId, name }) => (
                <tr key={receiptId} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingReceipt, { receiptId })} state={state}>{receiptId} ↗</TextLink></td>
                  <td className="px-6 py-4"><strong>Issued {formatDate(payment.date)}</strong><br /><span className="text-outline">Payment: {formatDate(payment.date)}<br />{formatTime(payment.time)} IST</span></td>
                  <td className="px-6 py-4"><strong>{name}</strong><br /><span className="text-outline">{getPatient(payment.patientId)?.mrn}<br />{payment.desk}</span></td>
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} state={state}>{payment.id} ↗</TextLink><br /><span className="text-outline">{payment.instrument} · {payment.reference}</span></td>
                  <td className="px-6 py-4 text-sm font-semibold">{money(payment.amount)}</td>
                  <td className="px-6 py-4"><StatusPill tone="success">Issued</StatusPill><br /><span className="text-outline">By {payment.cashier}</span></td>
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingReceipt, { receiptId })} state={state}>Open to print or download →</TextLink></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No receipts match these filters.</p>}
        </div>
        <p className="mt-3 flex justify-between text-xs text-outline"><span>Showing {rows.length} of {records.payments.length} receipts</span></p>
      </Section>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Section title="One receipt per payment">
          <p className="text-xs leading-6 text-on-surface-variant">A receipt confirms the money received on one payment. Applying the payment to invoices, or refunding part of it, does not create or change a receipt.</p>
          <TextLink to={ROUTES.billingPayments} className="mt-3 inline-block text-xs">Review payments →</TextLink>
        </Section>
        <Section title="Safe record navigation">
          <p className="text-xs leading-6 text-on-surface-variant">Open the receipt to print or download it and to see its linked payment. Back returns to this register with the search preserved.</p>
        </Section>
      </div>
      <GovernanceFooter>Payment ≠ Allocation ≠ Receipt. Receipts are issued with the payment and never edited afterwards.</GovernanceFooter>
    </BillingFrame>
  )
}
