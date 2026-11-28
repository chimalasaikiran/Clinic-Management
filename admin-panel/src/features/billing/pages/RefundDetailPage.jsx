import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, KeyValue, MetricStrip, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { useBilling } from '../context/useBilling'
import { TextInput } from '../../../components/workspace/FormControls'
import { TextArea } from '../../patients/components/parts'
import { allocationRef, refundBalance } from '../financeLogic'
import { refundContext, refundParty } from '../refundData'

const TONE = { Pending: 'warning', Approved: 'brand', Processed: 'success', Failed: 'danger', Rejected: 'neutral' }
const STATE_LABEL = { Pending: 'Awaiting review', Approved: 'Approved · awaiting processing', Processed: 'Completed', Failed: 'Failed · verify before retry', Rejected: 'Rejected' }

export default function RefundDetailPage() {
  const { refundId } = useParams()
  const { state } = useLocation()
  const { records, getPatient, refundRequests, orgName } = useBilling()
  const { refunds, paymentOf } = refundContext(records, refundRequests)
  const refund = refunds.find((entry) => entry.id === refundId)
  const registerPath = `${ROUTES.billingRefunds}${state?.search ?? ''}`

  if (!refund) {
    return (
      <BillingFrame back={{ to: registerPath, label: 'Back to Refund Register' }} crumb="Billing & Finance / Refunds" code="Billing & Finance" title="Refund not found" scope={false}>
        <Banner tone="warning" title="No refund matches this link">Open the Refund Register to find the record.</Banner>
      </BillingFrame>
    )
  }

  const payment = paymentOf(refund.paymentId)
  const party = refundParty(refund, getPatient)
  const balance = payment ? refundBalance(payment, refunds) : null
  const isRequest = refundRequests.some((entry) => entry.id === refund.id)
  const paymentPath = pathFor(ROUTES.billingPayment, { paymentId: refund.paymentId })
  const here = { search: state?.search }
  const others = refunds.filter((entry) => entry.paymentId === refund.paymentId && entry.id !== refund.id && entry.status === 'Processed')
  const eligibleBefore = balance ? balance.eligible + (refund.status === 'Processed' ? refund.amount : 0) : null
  const canApprove = isRequest && refund.status === 'Pending'
  const canProcess = isRequest && refund.status === 'Approved'

  return (
    <BillingFrame back={{ to: registerPath, label: 'Back to Refund Register' }} crumb={`Billing & Finance / Refunds / ${refund.id}`} code="Billing & Finance" title="Refund Details" description={`${refund.id} · Review this refund (${refund.reason.toLowerCase()}) without changing settled payment history.`} actions={<ActionButton to={paymentPath} state={here}>Original payment {refund.paymentId} ↗</ActionButton>} scope={false}>
      <p className="mb-5 border-b border-slate-200 pb-4 text-[11px] text-outline">Return context retained: {state?.search ? 'filters applied' : 'default filters'}. The original payment returns here with this refund context.</p>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[13px] font-semibold">{party.name}{party.mrn && ` · ${party.mrn}`} · {party.payer}</p><p className="mt-1 text-xs text-outline">{orgName} · {payment?.desk ?? 'Branch not recorded'}</p></div>
        <p className="flex items-center gap-3 text-xs text-outline"><StatusPill tone={TONE[refund.status]}>{refund.status}</StatusPill>Finance Manager · INR (₹) / IST</p>
      </div>

      {refund.status === 'Failed' && <Banner tone="danger" title="Failed does not mean refunded" className="mb-6">{refund.note} Verify the bank or gateway status before raising a new request.</Banner>}

      <MetricStrip items={[
        { label: 'Requested refund', value: money(refund.amount), hint: `${formatDate(refund.date)} · ${refund.reason}` },
        { label: 'Eligible before this request', value: money(eligibleBefore), hint: refund.releasesAllocations ? 'May also take back applied money' : 'Unallocated credit only' },
        { label: 'Pending refund reserve', value: money(balance?.reserved), hint: balance?.reserved ? 'Held against open requests · Not returned' : 'No open requests' },
        { label: 'Available for another use', value: money(Math.max(balance?.remaining ?? 0, 0)), hint: balance?.remaining > 0 ? 'Free for allocation or another refund' : 'No further allocation or refund available' },
      ]} />

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_432px]">
        <Section title="Refund information" aside={<StatusPill tone={TONE[refund.status]}>{STATE_LABEL[refund.status]}</StatusPill>}>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <KeyValue label="Refund ID / reason">{refund.id} · {refund.reason}</KeyValue>
            <KeyValue label="Requested on" hint={`By ${refund.requestedBy}`}>{formatDate(refund.date)} · {formatTime(refund.time)} IST</KeyValue>
            <KeyValue label="Original payment" hint={payment && `${money(payment.amount)} · Settled & Recorded · Verified`}><TextLink to={paymentPath} state={here}>{refund.paymentId} → Payment Details</TextLink></KeyValue>
            <KeyValue label="Original receipt">{payment?.receiptId ? <TextLink to={pathFor(ROUTES.billingReceipt, { receiptId: payment.receiptId })} state={here}>{payment.receiptId} → Receipt Details</TextLink> : 'No receipt recorded'}</KeyValue>
            <KeyValue label="Refund method" hint={`Internal reference ${refund.reference}`}>{refund.method}</KeyValue>
            <KeyValue label="Refund transaction reference" hint={payment ? `${payment.reference} belongs to the original payment only` : undefined}>{refund.outcomeReference ?? 'Not yet issued'}</KeyValue>
          </dl>
        </Section>
        <Section title="Eligibility & authorization">
          {balance && (
            <dl className="space-y-3 text-xs">
              {[['Original payment received', money(balance.received)], ...payment.allocations.map((allocation) => [`Less existing allocation · ${allocationRef(payment, allocation)}`, `− ${money(allocation.amount)}`]), ...others.map((entry) => [`Less processed refund · ${entry.id}`, `− ${money(entry.amount)}`]), ['Remaining eligible before request', money(eligibleBefore)]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3"><dt className="text-on-surface-variant">{label}</dt><dd className="text-[13px] font-semibold">{value}</dd></div>)}
            </dl>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
          </div>
          <RefundActions refund={refund} canApprove={canApprove} canProcess={canProcess} />
          <p className="mt-3 text-[11px] leading-5 text-outline">{canApprove || canProcess ? 'Approval and processing are recorded in the audit timeline. Only “Processed” means money was returned.' : refund.status === 'Pending' ? 'Approval and processing have not occurred. Approving needs settlement authority.' : `This refund is ${refund.status.toLowerCase()}; no further action is available here.`}</p>
        </Section>
      </div>

      <Section title="Approval, processing & audit timeline" aside="Every step is recorded with who took it and when." className="mb-6">
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Date / time', 'Event / history', 'Linked record', 'Amount (INR)', 'Actor'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {payment && <tr className="border-t border-slate-100"><td className="px-6 py-4">{formatDate(payment.date)}<br /><span className="text-outline">{formatTime(payment.time)} IST</span></td><td className="px-6 py-4">Original payment recorded<br /><span className="text-outline">{payment.instrument} · Original transaction {payment.reference}</span></td><td className="px-6 py-4"><TextLink to={paymentPath} state={here}>{payment.id} ↗</TextLink></td><td className="px-6 py-4 font-semibold">{money(payment.amount)}</td><td className="px-6 py-4">{payment.cashier ?? 'Actor unavailable'}</td></tr>}
              {payment?.allocations.map((allocation) => <tr key={allocation.id} className="border-t border-slate-100"><td className="px-6 py-4">{formatDate(allocation.date)}<br /><span className="text-outline">{formatTime(allocation.time)} IST</span></td><td className="px-6 py-4">{allocation.amount < 0 ? 'Allocation released' : 'Existing allocation'}<br /><span className="text-outline">{allocation.amount < 0 ? `Taken back from ${allocation.invoiceId} for a refund` : `Applied to ${allocation.invoiceId} · Not a refund`}</span></td><td className="px-6 py-4 font-semibold text-brand">{allocationRef(payment, allocation)}</td><td className="px-6 py-4 font-semibold">{money(allocation.amount)}</td><td className="px-6 py-4">{allocation.by}</td></tr>)}
              {others.map((entry) => <tr key={entry.id} className="border-t border-slate-100"><td className="px-6 py-4">{formatDate(entry.date)}<br /><span className="text-outline">{formatTime(entry.time)} IST</span></td><td className="px-6 py-4">Previous refund processed<br /><span className="text-outline">{entry.reason} · Confirmed returned</span></td><td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingRefund, { refundId: entry.id })} state={here}>{entry.id} ↗</TextLink></td><td className="px-6 py-4 font-semibold">{money(entry.amount)}</td><td className="px-6 py-4">{entry.requestedBy}</td></tr>)}
              {[...refund.audit].reverse().map((entry, index) => <tr key={`${entry.at}-${index}`} className="border-t border-slate-100"><td className="px-6 py-4">{entry.at}</td><td className="px-6 py-4">{entry.text}<br /><span className="text-outline">{refund.status} · {money(refund.amount)} {refund.status === 'Processed' ? 'returned' : refund.status === 'Pending' || refund.status === 'Approved' ? 'reserved, not returned' : 'not returned'}</span></td><td className="px-6 py-4 font-semibold">{refund.id}</td><td className="px-6 py-4 font-semibold">{money(refund.amount)}</td><td className="px-6 py-4">{entry.by}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-outline">Approval: {refund.status === 'Pending' ? 'not yet approved' : refund.status}. Processing: {refund.status === 'Processed' ? 'completed' : 'not started'}. {refund.status === 'Processed' ? '' : 'No refund transaction issued.'}</p>
      </Section>

      <h2 className="mb-3 text-[17px] font-semibold">Permitted actions by refund state</h2>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant"><StatusPill tone="warning" className="mb-2">Pending · Current record</StatusPill><p>Review the original payment and its allocations, then approve or reject. Eligibility is checked again at each step.</p></div>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant"><StatusPill tone="danger" className="mb-2">Failed · Verify before retry</StatusPill><p>A failed refund means money was not returned and its hold is released. Raise a new request to try again.</p></div>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant"><StatusPill tone="success" className="mb-2">Completed · Read-only</StatusPill><p>Never retry or edit a completed refund; use a separate authorized, audited correction.</p></div>
      </div>
      <GovernanceFooter>Refund ≠ payment ≠ receipt ≠ allocation. Reservations prevent double counting; finalized records are never changed silently.</GovernanceFooter>
    </BillingFrame>
  )
}

// Approve or reject a pending refund; record an approved one as processed (with the bank or gateway reference) or failed.
function RefundActions({ refund, canApprove, canProcess }) {
  const { decideRefund } = useBilling()
  const [mode, setMode] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const open = (next) => {
    setMode(next)
    setText('')
    setError('')
  }
  const submit = async (action) => {
    const body = action === 'process' ? { outcomeReference: text.trim(), note: '', version: refund.version } : { note: text.trim(), version: refund.version }
    if (action === 'process' && !body.outcomeReference) return setError('Enter the bank or gateway refund reference.')
    if ((action === 'reject' || action === 'fail') && body.note.length < 10) return setError('Give the reason in at least 10 characters.')
    setSaving(true)
    setError('')
    try {
      await decideRefund(action, refund.uuid, body)
      setMode('')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        <ActionButton disabled={!canApprove || saving} onClick={() => submit('approve')}>Approve refund</ActionButton>
        <ActionButton disabled={!canApprove || saving} onClick={() => open('reject')}>Reject</ActionButton>
        <ActionButton disabled={!canProcess || saving} onClick={() => open('process')}>Record as processed</ActionButton>
        <ActionButton disabled={!canProcess || saving} onClick={() => open('fail')}>Record as failed</ActionButton>
      </div>
      {mode && (
        <div className="mt-4 rounded-md border border-slate-200 bg-surface-lowest p-4">
          {mode === 'process'
            ? <TextInput label="Bank or gateway refund reference" required value={text} onChange={(event) => setText(event.target.value)} hint="The reference the bank or gateway gave for the money returned." />
            : <TextArea label={mode === 'reject' ? 'Reason for rejecting' : 'What failed'} required rows={2} value={text} onChange={(event) => setText(event.target.value)} />}
          <div className="mt-3 flex gap-2"><ActionButton onClick={() => setMode('')}>Cancel</ActionButton><ActionButton variant="primary" disabled={saving} onClick={() => submit(mode)}>{mode === 'process' ? 'Confirm money returned' : mode === 'reject' ? 'Reject refund' : 'Record failure'}</ActionButton></div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
