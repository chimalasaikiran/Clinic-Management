import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { Check, OptionSelect, TextArea } from '../../patients/components/parts'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatTime, nextId, TODAY } from '../../patients/format'
import { clockTime } from '../../patients/selectors'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { useBilling } from '../context/useBilling'
import { REFUND_METHODS, REFUND_REASON_OPTIONS, RECEIPT_CONFLICTS } from '../data/financeSeed'
import { refundBalance, validateRefund } from '../financeLogic'
import { refundContext, refundParty } from '../refundData'

export default function RefundFormPage() {
  const { records, getPatient } = usePatientRecords()
  const { refundRequests, addRefundRequest } = useBilling()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [params] = useSearchParams()
  const { refunds, payments, paymentOf } = refundContext(records, refundRequests)
  const nextRef = nextId('REF-2026-', refunds.map((refund) => refund.id), 3)
  const [values, setValues] = useState({ paymentId: params.get('payment') ?? '', amount: '', reason: REFUND_REASON_OPTIONS[0], method: REFUND_METHODS[0], reference: `RF-REQ-${nextRef.slice(-3)}`, notes: '', confirmed: false })
  const [attempted, setAttempted] = useState(false)

  const payment = paymentOf(values.paymentId)
  const party = payment ? refundParty(payment, getPatient) : null
  const balance = payment ? refundBalance(payment, refunds) : null
  const errors = attempted ? validateRefund(values, balance?.remaining ?? 0) : {}
  const amount = Number(values.amount) || 0
  const over = balance && amount > balance.remaining ? amount - balance.remaining : 0
  const registerPath = `${ROUTES.billingRefunds}${state?.search ?? ''}`
  const receiptConflict = payment && RECEIPT_CONFLICTS.includes(payment.receiptId)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const submit = () => {
    setAttempted(true)
    if (Object.keys(validateRefund(values, balance?.remaining ?? 0)).length || !values.confirmed) return
    addRefundRequest({ id: nextRef, patientId: payment.patientId, patientName: party.name, mrn: party.mrn, payer: party.payer, paymentId: payment.id, date: TODAY, amount, reason: values.reason, status: 'Pending', method: values.method, reference: values.reference.trim(), notes: values.notes.trim() })
    navigate(pathFor(ROUTES.billingRefund, { refundId: nextRef }), { state })
  }

  return (
    <BillingFrame back={{ to: registerPath, label: 'Refund Register' }} crumb="Billing & Finance / Refunds / Create" code="BF-16 / Aura Health · Billing & Finance" title="Create / Review Refund" badge={<StatusPill tone="warning">{over ? 'Draft · Validation required' : 'Draft'}</StatusPill>} description="Create a separate refund against a verified payment. Approval and gateway processing happen after submission." scope={false}>
      <ol className="mb-6 flex flex-wrap gap-x-6 border-b border-slate-200 pb-4 text-xs">
        <li className="font-semibold text-brand">{payment ? '✓ ' : '1 '}Original payment selected</li><li className="font-semibold">2 Refund details & confirmation</li><li className="text-outline">3 Submit for approval</li>
      </ol>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_488px]">
        <div className="space-y-6">
          <Section title="Original payment" aside="Required link · Refunds cannot be created without an eligible payment.">
            <OptionSelect label="Search / select original payment" required value={values.paymentId} onChange={(event) => set('paymentId', event.target.value)} placeholder="Select an original payment" error={errors.paymentId} options={payments.map((entry) => ({ value: entry.id, label: `${entry.id} · ${refundParty(entry, getPatient).name} · ${money(entry.amount)}` }))} />
            {payment && (
              <div className="mt-4 text-xs">
                <p className="flex items-center justify-between"><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} className="text-[13px]">{payment.id} ↗</TextLink><StatusPill tone="success">Settled & verified</StatusPill></p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-[110px_1fr]"><dt className="text-outline">Patient / branch</dt><dd className="text-[13px]">{party.name}{party.mrn && ` · ${party.mrn}`}{payment.desk && ` / ${payment.desk}`}{payment.branch && ` / ${payment.branch}`}</dd><dt className="text-outline">Received</dt><dd className="text-[13px]">{formatDate(payment.date)} · {formatTime(payment.time)} IST · {payment.instrument}</dd><dt className="text-outline">Related allocation</dt><dd className="text-[13px] text-brand">{payment.allocations.length ? payment.allocations.map((allocation) => `${money(allocation.amount)} allocated to ${allocation.invoiceId}`).join(', ') : 'No allocation'}</dd></dl>
                <p className="mt-4 text-outline">Payment verified independently.{receiptConflict && ` Receipt ${payment.receiptId} has conflicting amounts and is not used to calculate eligibility.`}</p>
              </div>
            )}
          </Section>

          <Section title="Refund details" aside="* Required fields">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Refund amount (INR)" required prefix="₹" inputMode="decimal" value={values.amount} onChange={(event) => set('amount', event.target.value.replace(/[^\d.]/g, ''))} error={errors.amount} disabled={!payment} />
              <SelectInput label="Reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} options={REFUND_REASON_OPTIONS} />
              <SelectInput label="Refund method" required value={values.method} onChange={(event) => set('method', event.target.value)} options={REFUND_METHODS} hint="Return only to the original payer / payment method." />
              <TextInput label="Internal reference" required value={values.reference} onChange={(event) => set('reference', event.target.value)} error={errors.reference} hint="Gateway refund reference is assigned after processing." />
            </div>
            <div className="mt-4"><TextArea label="Notes" rows={3} value={values.notes} onChange={(event) => set('notes', event.target.value)} /></div>
            {over > 0 && <Banner tone="danger" title="Amount exceeds the refundable limit" className="mt-4">Enter an amount greater than ₹0 and no more than {money(balance.remaining)}. Eligibility is rechecked on submission; pending requests reserve funds to prevent duplicate refunds.</Banner>}
          </Section>

          <div className="rounded-md border border-slate-200 bg-white p-5">
            <Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label="I confirm the original payment, payer, reason and amount. I understand this creates an audited refund request and does not edit the payment or allocation. *" />
            {attempted && !values.confirmed && <p role="alert" className="mt-2 text-xs text-rose-600">Confirm before submitting.</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-outline">{over ? 'Correct the amount and confirm before submitting.' : 'Submitting creates a pending request; no gateway call occurs.'}</p><div className="flex gap-3"><ActionButton onClick={() => navigate(registerPath)}>Cancel</ActionButton><ActionButton variant="brand" disabled={!payment || over > 0 || !values.confirmed} onClick={submit}>Submit for approval</ActionButton></div></div>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="Refundable balance" aside="">
            <p className="-mt-3 mb-4 text-xs text-outline">{payment ? `${payment.id} · Verified at ${formatTime(clockTime())} IST` : 'Select an original payment'}</p>
            {balance ? (
              <dl className="space-y-3 text-xs">
                {[['Original payment received', money(balance.received)], ['Less: protected allocation', `− ${money(balance.allocated)}`], ['Eligible unallocated amount', money(balance.received - balance.allocated)], ['Less: already refunded', `− ${money(balance.processed)}`], ['Less: other pending / approved', money(balance.reserved)]].map(([label, value]) => <div key={label} className="flex items-center justify-between"><dt className="text-on-surface-variant">{label}</dt><dd className="text-[13px] font-medium">{value}</dd></div>)}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4"><dt className="font-semibold">Remaining refundable</dt><dd className="text-2xl font-semibold text-brand">{money(balance.remaining)}</dd></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-4"><dt className="text-on-surface-variant">Current draft request</dt><dd className="text-[13px] font-medium">{money(amount)}</dd></div>
              </dl>
            ) : <p className="text-xs text-outline">Remaining refundable appears once a payment is selected.</p>}
            {over > 0 && <StatusPill tone="danger" className="mt-3">{money(over)} over limit</StatusPill>}
            <p className="mt-4 text-[11px] leading-5 text-outline">After a valid request, its amount is reserved and the available balance reduces. A rejected or failed request releases its reservation.</p>
          </Section>
          <Section title="Authorization & safeguards">
            <StatusPill tone="brand">Finance Manager · Can create</StatusPill>
            <p className="mt-4 text-[13px]">Independent approver required. You cannot approve your own request.</p>
            <p className="mt-3 text-xs leading-5 text-outline">No gateway call occurs during request creation. Only “Processed” with gateway confirmation means money was returned.</p>
            <p className="mt-3 text-[11px] leading-5 text-outline">Audit captures actor, time, original payment, amount, reason, confirmation and all status changes.</p>
          </Section>
        </div>
      </div>
      <GovernanceFooter code="BF-16">Never refund more than the eligible remaining balance. Submission errors retain the draft; recheck request status before retrying to avoid duplicate requests.</GovernanceFooter>
    </BillingFrame>
  )
}
