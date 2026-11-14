import { useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, KeyValue, MetricStrip, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { useBilling } from '../context/useBilling'
import { RECEIPT_CONFLICTS } from '../data/financeSeed'
import { allocationRef, refundBalance } from '../financeLogic'
import { refundContext, refundParty } from '../refundData'

const TONE = { Pending: 'warning', Approved: 'brand', Processed: 'success', Failed: 'danger', Rejected: 'neutral' }
const STATE_LABEL = { Pending: 'Awaiting review', Approved: 'Approved · awaiting processing', Processed: 'Completed', Failed: 'Failed · verify before retry', Rejected: 'Rejected' }

export default function RefundDetailPage() {
  const { refundId } = useParams()
  const { state } = useLocation()
  const { records, getPatient } = usePatientRecords()
  const { refundRequests, updateRefundRequest } = useBilling()
  const { refunds, paymentOf } = refundContext(records, refundRequests)
  const refund = refunds.find((entry) => entry.id === refundId)
  const registerPath = `${ROUTES.billingRefunds}${state?.search ?? ''}`

  if (!refund) {
    return (
      <BillingFrame back={{ to: registerPath, label: 'Back to Refund Register' }} crumb="Billing & Finance / Refunds" code="BF-19 / Aura Health · Billing & Finance" title="Refund not found" scope={false}>
        <Banner tone="warning" title="No refund matches this link">Open the Refund Register to find the record.</Banner>
      </BillingFrame>
    )
  }

  const payment = paymentOf(refund.paymentId)
  const party = refundParty(refund, getPatient)
  const balance = payment ? refundBalance(payment, refunds) : null
  const conflict = payment && RECEIPT_CONFLICTS.includes(payment.receiptId)
  const isRequest = refundRequests.some((entry) => entry.id === refund.id)
  const paymentPath = pathFor(ROUTES.billingPayment, { paymentId: refund.paymentId })
  const here = { search: state?.search }
  const others = refunds.filter((entry) => entry.paymentId === refund.paymentId && entry.id !== refund.id && entry.status === 'Processed')
  const eligibleBefore = balance ? balance.eligible + (refund.status === 'Processed' ? refund.amount : 0) : null
  const canApprove = isRequest && refund.status === 'Pending' && !conflict
  const canProcess = isRequest && refund.status === 'Approved' && !conflict

  return (
    <BillingFrame back={{ to: registerPath, label: 'Back to Refund Register' }} crumb={`Billing & Finance / Refunds / ${refund.id}`} code="BF-19 / Aura Health · Billing & Finance" title="Refund Details" description={`${refund.id} · Review this refund (${refund.reason.toLowerCase()}) without changing settled payment history.`} actions={<ActionButton to={paymentPath} state={here}>Original payment {refund.paymentId} ↗</ActionButton>} scope={false}>
      <p className="mb-5 border-b border-slate-200 pb-4 text-[11px] text-outline">Return context retained: {state?.search ? 'filters applied' : 'default filters'}. The original payment returns here with this refund context.</p>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[13px] font-semibold">{party.name}{party.mrn && ` · ${party.mrn}`} · {party.payer}</p><p className="mt-1 text-xs text-outline">Aura Health · {payment?.desk ?? payment?.branch ?? 'Main Surgical Pavilion'}</p></div>
        <p className="flex items-center gap-3 text-xs text-outline"><StatusPill tone={TONE[refund.status]}>{refund.status}</StatusPill>Finance Manager · INR (₹) / IST</p>
      </div>

      {conflict && refund.status === 'Pending' && <Banner tone="warning" title="Verification required before approval or processing" className="mb-6">{payment.receiptId} has conflicting amounts; receipt amount: — and issue status unknown. Revalidate eligibility against the source payment and resolve the receipt conflict. Official receipt print/download remains disabled.</Banner>}
      {refund.status === 'Failed' && <Banner tone="danger" title="Failed does not mean refunded" className="mb-6">{refund.note} Verify gateway status before an authorized retry.</Banner>}

      <MetricStrip items={[
        { label: 'Requested refund', value: money(refund.amount), hint: `${formatDate(refund.date)} · ${refund.reason}` },
        { label: 'Eligible before this request', value: money(eligibleBefore), hint: 'Source calculation · Revalidation required' },
        { label: 'Pending refund reserve', value: money(balance?.reserved), hint: balance?.reserved ? 'Held against open requests · Not returned' : 'No open requests' },
        { label: 'Available for another use', value: money(balance?.remaining), hint: 'No further allocation or refund available' },
      ]} />

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_432px]">
        <Section title="Refund information" aside={<StatusPill tone={TONE[refund.status]}>{STATE_LABEL[refund.status]}</StatusPill>}>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <KeyValue label="Refund ID / reason">{refund.id} · {refund.reason}</KeyValue>
            <KeyValue label="Requested on" hint="Time and requesting actor unavailable">{formatDate(refund.date)}</KeyValue>
            <KeyValue label="Original payment" hint={payment && `${money(payment.amount)} · Settled & Recorded · Verified`}><TextLink to={paymentPath} state={here}>{refund.paymentId} → Payment Details</TextLink></KeyValue>
            <KeyValue label="Original receipt" hint={conflict ? 'Amount — · Issue status unknown' : undefined}>{payment?.receiptId ? <TextLink to={pathFor(ROUTES.billingReceipt, { receiptId: payment.receiptId })} state={here}>{payment.receiptId} → Receipt Details</TextLink> : 'No receipt recorded'}</KeyValue>
            <KeyValue label="Refund method" hint={refund.method ? undefined : 'Original source preferred; method not confirmed'}>{refund.method ?? 'Awaiting verification'}</KeyValue>
            <KeyValue label="Refund transaction reference" hint={payment ? `${payment.reference} belongs to the original payment only` : undefined}>{refund.status === 'Processed' ? 'Issued by gateway' : 'Not yet issued'}</KeyValue>
          </dl>
        </Section>
        <Section title="Eligibility & authorization">
          {balance && (
            <dl className="space-y-3 text-xs">
              {[['Original payment received', money(balance.received)], ...payment.allocations.map((allocation) => [`Less existing allocation · ${allocationRef(payment, allocation)}`, `− ${money(allocation.amount)}`]), ...others.map((entry) => [`Less processed refund · ${entry.id}`, `− ${money(entry.amount)}`]), ['Remaining eligible before request', money(eligibleBefore)]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3"><dt className="text-on-surface-variant">{label}</dt><dd className="text-[13px] font-semibold">{value}</dd></div>)}
            </dl>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <ActionButton disabled={!canApprove} onClick={() => updateRefundRequest(refund.id, { status: 'Approved' })}>Approve refund</ActionButton>
            <ActionButton disabled={!canProcess} onClick={() => updateRefundRequest(refund.id, { status: 'Processed' })}>Process refund</ActionButton>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-outline">{canApprove || canProcess ? 'Approval and processing are recorded in the audit timeline. Only “Processed” means money was returned.' : refund.status === 'Pending' ? 'Approval and processing have not occurred. Resolve source verification and confirm authorization first.' : `This refund is ${refund.status.toLowerCase()}; no further action is available here.`}</p>
        </Section>
      </div>

      <Section title="Approval, processing & audit timeline" aside="Known source events only. Dates without a supplied time are not precise processing timestamps." className="mb-6">
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Date / time', 'Event / history', 'Linked record', 'Amount (INR)', 'Actor'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {payment && <tr className="border-t border-slate-100"><td className="px-6 py-4">{formatDate(payment.date)}<br /><span className="text-outline">{formatTime(payment.time)} IST</span></td><td className="px-6 py-4">Original payment recorded<br /><span className="text-outline">{payment.instrument} · Original transaction {payment.reference}</span></td><td className="px-6 py-4"><TextLink to={paymentPath} state={here}>{payment.id} ↗</TextLink></td><td className="px-6 py-4 font-semibold">{money(payment.amount)}</td><td className="px-6 py-4">{payment.cashier ?? 'Actor unavailable'}</td></tr>}
              {payment?.allocations.map((allocation) => <tr key={allocation.invoiceId} className="border-t border-slate-100"><td className="px-6 py-4">Time unavailable<br /><span className="text-outline">Date not supplied</span></td><td className="px-6 py-4">Existing allocation<br /><span className="text-outline">Applied to {allocation.invoiceId} · Not a refund</span></td><td className="px-6 py-4 font-semibold text-brand">{allocationRef(payment, allocation)}</td><td className="px-6 py-4 font-semibold">{money(allocation.amount)}</td><td className="px-6 py-4">Actor unavailable</td></tr>)}
              {others.map((entry) => <tr key={entry.id} className="border-t border-slate-100"><td className="px-6 py-4">{formatDate(entry.date)}<br /><span className="text-outline">Time unavailable</span></td><td className="px-6 py-4">Previous refund processed<br /><span className="text-outline">{entry.reason} · Confirmed returned</span></td><td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingRefund, { refundId: entry.id })} state={here}>{entry.id} ↗</TextLink></td><td className="px-6 py-4 font-semibold">{money(entry.amount)}</td><td className="px-6 py-4">Actor unavailable</td></tr>)}
              <tr className="border-t border-slate-100"><td className="px-6 py-4">{formatDate(refund.date)}<br /><span className="text-outline">Time unavailable</span></td><td className="px-6 py-4">Current refund {refund.status === 'Processed' ? 'processed' : 'requested'}<br /><span className="text-outline">{refund.status} · {money(refund.amount)} {refund.status === 'Processed' ? 'returned' : 'reserved, not returned'}</span></td><td className="px-6 py-4 font-semibold">{refund.id}</td><td className="px-6 py-4 font-semibold">{money(refund.amount)}</td><td className="px-6 py-4">Actor unavailable</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-outline">Approval: {refund.status === 'Pending' ? 'not yet approved' : refund.status}. Processing: {refund.status === 'Processed' ? 'completed' : 'not started'}. {refund.status === 'Processed' ? '' : 'No refund transaction issued.'}</p>
      </Section>

      <h2 className="mb-3 text-[17px] font-semibold">Permitted actions by refund state</h2>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant"><StatusPill tone="warning" className="mb-2">Pending · Current record</StatusPill><p>Review linked sources. Approval and processing stay blocked while eligibility, receipt or method verification is unresolved.</p></div>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant"><StatusPill tone="danger" className="mb-2">Failed · Verify before retry</StatusPill><p>A failed refund means money was not returned. Verify gateway status before an authorized retry.</p></div>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant"><StatusPill tone="success" className="mb-2">Completed · Read-only</StatusPill><p>Never retry or edit a completed refund; use a separate authorized, audited correction.</p></div>
      </div>
      <GovernanceFooter code="BF-19">Refund ≠ payment ≠ receipt ≠ allocation. Reservations prevent double counting; finalized records are never changed silently.</GovernanceFooter>
    </BillingFrame>
  )
}
