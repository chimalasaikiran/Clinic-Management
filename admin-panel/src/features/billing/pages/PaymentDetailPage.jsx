import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { allocatedFromPayment, invoiceBalance, invoiceTotal, paymentUnallocated } from '../../patients/billing'
import { useBilling } from '../context/useBilling'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, KeyValue, Scope, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { allocationRef } from '../financeLogic'

export default function PaymentDetailPage() {
  const { paymentId } = useParams()
  const { state } = useLocation()
  const { records, getPatient, orgName } = useBilling()
  const payment = records.payments.find((entry) => entry.id === paymentId)
  const registerPath = `${ROUTES.billingPayments}${state?.search ?? ''}`

  if (!payment) {
    return (
      <BillingFrame back={{ to: registerPath, label: 'Payment Register' }} crumb="Billing & Finance / Payments" code="BF-11 / Payments & receipts" title="Payment not found" scope={false}>
        <Banner tone="warning" title="No payment matches this link">Open the Payment Register to find the record.</Banner>
      </BillingFrame>
    )
  }

  const patient = getPatient(payment.patientId)
  const allocated = allocatedFromPayment(payment)
  const unallocated = paymentUnallocated(payment, records.refunds)
  const allocationStatus = unallocated > 0 ? (allocated > 0 ? 'Partially allocated' : 'Unallocated') : 'Fully allocated'
  const here = { search: state?.search }
  const allocationPath = pathFor(ROUTES.billingAllocation, { paymentId })

  return (
    <BillingFrame back={{ to: registerPath, label: 'Payment Register · filtered view' }} crumb={`Billing & Finance / Payments / ${payment.id}`} code="BF-11 / Payments & receipts" title="Payment Details" description={`${payment.id} · A settled collection with a separate, ${allocationStatus.toLowerCase()} balance.`} actions={<>{payment.receiptId && <ActionButton to={pathFor(ROUTES.billingReceipt, { receiptId: payment.receiptId })} state={here}>Receipt {payment.receiptId} ↗</ActionButton>}<ActionButton variant="primary" to={unallocated > 0 ? allocationPath : undefined} state={here} disabled={unallocated <= 0}>Manage allocation</ActionButton></>} scope={false}>
      <Scope left={`${orgName} · ${payment.desk} / ${patient?.name} · ${patient?.mrn}`} />

      <p className="mb-5 flex flex-wrap items-center gap-2 text-xs"><StatusPill tone="success">Settled & Recorded · Verified</StatusPill><StatusPill tone={unallocated > 0 ? 'brand' : 'success'}>{allocationStatus}</StatusPill><StatusPill>Read-only payment</StatusPill><span className="text-outline">Transaction status and allocation status are independent.</span></p>

      <dl className="mb-6 grid gap-4 sm:grid-cols-3">
        {[['Payment received', money(payment.amount), `${formatDate(payment.date)} · ${formatTime(payment.time)} IST`], ['Existing allocation', money(allocated), payment.allocations.map((allocation) => `${allocationRef(payment, allocation)} → ${allocation.invoiceId}`).join(', ') || 'No allocation recorded'], ['Unallocated balance', money(unallocated), 'Available for a separate allocation']].map(([label, value, hint]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 text-[32px] leading-9 font-semibold">{value}</dd><p className="mt-2 text-xs text-outline">{hint}</p></div>
        ))}
      </dl>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_432px]">
        <Section title="Payment information" aside={<StatusPill>Immutable settled record</StatusPill>}>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <KeyValue label="Patient / payer">{patient?.name} · {patient?.mrn}</KeyValue>
            <KeyValue label="Receiving clinic" hint={payment.desk}>{orgName}</KeyValue>
            <KeyValue label="Payment date & time">{formatDate(payment.date)} · {formatTime(payment.time)} IST</KeyValue>
            <KeyValue label="Method / gateway">{payment.instrument.replace(/\s*\(.*\)$/, '')}</KeyValue>
            <KeyValue label="Transaction reference">{payment.reference}</KeyValue>
            <KeyValue label="Recorded by">{payment.cashier ?? 'Not available'}</KeyValue>
          </dl>
        </Section>
        <Section title="Linked receipt">
          {payment.receiptId ? (
            <>
              <TextLink to={pathFor(ROUTES.billingReceipt, { receiptId: payment.receiptId })} state={here}>{payment.receiptId} → Receipt Details</TextLink>
              <p className="mt-3 text-xs leading-5 text-on-surface-variant">Receipt issued when the payment was recorded. Open it to print or download.</p>
            </>
          ) : <p className="text-xs leading-5 text-on-surface-variant">No receipt is recorded for this payment. A payment does not automatically finalize a receipt.</p>}
        </Section>
      </div>

      <Section title="Allocations & linked charges" aside={<TextLink to={allocationPath} state={here}>Open Payment Allocation →</TextLink>} className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Existing allocation only. No new allocation has been posted.</p>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Allocation', 'Linked invoice', 'Allocated', 'Invoice paid / total', 'Invoice outstanding', 'Status'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {payment.allocations.map((allocation) => {
                const invoice = records.invoices.find((entry) => entry.id === allocation.invoiceId)
                const balance = invoice ? invoiceBalance(invoice, records.payments) : null
                return (
                  <tr key={allocation.id} className="border-t border-slate-100 align-top">
                    <td className="px-6 py-4">{allocationRef(payment, allocation)}<br /><span className="text-outline">Existing · unchanged</span></td>
                    <td className="px-6 py-4"><Link to={pathFor(ROUTES.billingInvoice, { invoiceId: allocation.invoiceId })} className="font-semibold text-brand hover:underline">{allocation.invoiceId} ↗</Link><br /><span className="text-outline">{invoice && `${formatDate(invoice.date)} · ${formatTime(invoice.time)} IST`}</span></td>
                    <td className="px-6 py-4 text-sm font-semibold">{money(allocation.amount)}</td>
                    <td className="px-6 py-4">{invoice ? `${money(invoiceTotal(invoice) - balance)} / ${money(invoiceTotal(invoice))}` : '—'}</td>
                    <td className="px-6 py-4 font-semibold">{money(balance)}</td>
                    <td className="px-6 py-4">{balance === null ? '—' : <StatusPill tone={balance > 0 ? 'warning' : 'success'}>{balance > 0 ? 'Partially Paid' : 'Paid in Full'}</StatusPill>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {payment.allocations.length === 0 && <p className="px-6 py-8 text-center text-xs text-outline">No allocation recorded. The full {money(payment.amount)} is unallocated.</p>}
        </div>
      </Section>

      <Section title="Audit history" aside="Only known source events are shown. Settled history cannot be edited." className="mb-6">
        <ul className="divide-y divide-slate-100 text-xs">
          <li className="grid gap-2 py-4 sm:grid-cols-[200px_1fr_auto]"><span className="text-outline">{formatDate(payment.date)} · {formatTime(payment.time)} IST</span><span><strong className="text-[13px]">Payment recorded · {money(payment.amount)}</strong><br /><span className="text-outline">{payment.instrument} · {payment.reference} · {payment.cashier ?? 'Actor: not available'}</span></span><StatusPill tone="success">Settled & Recorded</StatusPill></li>
          {payment.allocations.map((allocation) => (
            <li key={allocation.id} className="grid gap-2 py-4 sm:grid-cols-[200px_1fr_auto]"><span className="text-outline">{formatDate(allocation.date)} · {formatTime(allocation.time)} IST</span><span><strong className="text-[13px]">Existing allocation {allocationRef(payment, allocation)} · {money(allocation.amount)}</strong><br /><span className="text-outline">{allocation.amount < 0 ? `Released from ${allocation.invoiceId} by a refund` : `To ${allocation.invoiceId}`} · {allocation.by}</span></span><StatusPill>{allocation.amount < 0 ? 'Released' : 'Applied'}</StatusPill></li>
          ))}
        </ul>
      </Section>

      <GovernanceFooter code="BF-11">Settled payment information is read-only. Corrections require separate governed records; managing allocation does not modify the payment transaction.</GovernanceFooter>
    </BillingFrame>
  )
}
