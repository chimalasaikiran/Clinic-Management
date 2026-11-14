import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { allocatedFromPayment, allocationError, applyAllocation, invoiceBalance, invoiceStatus, invoiceTotal, paymentUnallocated } from '../../patients/billing'
import { OptionSelect } from '../../patients/components/parts'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, Scope, Section } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { allocationRef } from '../financeLogic'

export default function PaymentAllocationPage() {
  const { paymentId } = useParams()
  const { records } = usePatientRecords()
  const payment = records.payments.find((entry) => entry.id === paymentId)
  if (!payment) {
    return (
      <BillingFrame back={{ to: ROUTES.billingPayments, label: 'Payment Register' }} crumb="Billing & Finance / Payments" code="BF-12 / Payments & receipts" title="Payment not found" scope={false}>
        <Banner tone="warning" title="No payment matches this link">Open the Payment Register to find the record.</Banner>
      </BillingFrame>
    )
  }
  return <AllocationForm key={paymentId} payment={payment} />
}

function AllocationForm({ payment }) {
  const { records, getPatient, update } = usePatientRecords()
  const navigate = useNavigate()
  const { state } = useLocation()
  const patient = getPatient(payment.patientId)
  const available = paymentUnallocated(payment, records.refunds)
  const open = records.invoices.filter((invoice) => invoice.patientId === payment.patientId && invoiceBalance(invoice, records.payments) > 0)
  const [invoiceId, setInvoiceId] = useState(open[0]?.id ?? '')
  const invoice = open.find((entry) => entry.id === invoiceId)
  const balance = invoice ? invoiceBalance(invoice, records.payments) : 0
  const [amount, setAmount] = useState(String(Math.min(available, balance) || ''))
  const detailPath = pathFor(ROUTES.billingPayment, { paymentId: payment.id })
  const numeric = Number(amount)
  const error = invoice ? allocationError({ amount: numeric, available, balance }) : 'Select an invoice with a balance due.'
  const ceiling = Math.min(available, balance)

  const confirm = () => {
    update('payments', payment.id, (current) => applyAllocation(current, invoice.id, numeric))
    navigate(detailPath, { state })
  }

  return (
    <BillingFrame back={{ to: detailPath, label: `Payment Details · ${payment.id}` }} crumb={`Billing & Finance / Payments / ${payment.id} / Allocation`} code="BF-12 / Payments & receipts" title="Payment Allocation" badge={<StatusPill tone="warning">Unsaved allocation preview</StatusPill>} description={`${payment.id} · Preview a partial allocation without changing the settled payment or existing allocation.`} scope={false}>
      <Scope left={`Aura Health · ${payment.desk} / ${patient?.name} · ${patient?.mrn}`} />

      <dl className="mb-6 grid gap-4 sm:grid-cols-3">
        {[['Settled payment', money(payment.amount), `${payment.id} · Read-only`], ['Already allocated', money(allocatedFromPayment(payment)), payment.allocations.map((allocation) => allocationRef(payment, allocation)).join(', ') || 'None · preserved unchanged'], ['Currently available', money(available), 'Actual unallocated payment funds']].map(([label, value, hint]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 text-[32px] leading-9 font-semibold">{value}</dd><p className="mt-2 text-xs text-outline">{hint}</p></div>
        ))}
      </dl>

      {open.length === 0 && <Banner tone="warning" title="No invoice has a balance due" className="mb-6">{patient?.name} has nothing outstanding to allocate this payment to. The {money(available)} stays available as credit.</Banner>}

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_460px]">
        <div className="space-y-6">
          <Section title="Outstanding invoice context" aside={invoice && <StatusPill tone="warning">{invoiceStatus(invoice, records.payments)}</StatusPill>}>
            {open.length > 1 && <div className="mb-4"><OptionSelect label="Invoice" value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); setAmount('') }} options={open.map((entry) => ({ value: entry.id, label: `${entry.id} · ${money(invoiceBalance(entry, records.payments))} due` }))} /></div>}
            {invoice ? (
              <>
                <p className="flex items-center justify-between text-xs"><Link to={pathFor(ROUTES.billingInvoice, { invoiceId: invoice.id })} className="text-[13px] font-semibold text-brand hover:underline">{invoice.id} ↗</Link><span className="text-outline">{formatDate(invoice.date)} · {formatTime(invoice.time)} IST</span></p>
                <p className="mt-3 text-[13px]">{invoice.title} · {invoice.branch}</p>
                <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-3">
                  <div><dt className="text-on-surface-variant">Invoice total</dt><dd className="mt-1 text-[13px] font-semibold">{money(invoiceTotal(invoice))}</dd></div>
                  <div><dt className="text-on-surface-variant">Allocated paid</dt><dd className="mt-1 text-[13px] font-semibold">{money(invoiceTotal(invoice) - balance)}</dd></div>
                  <div><dt className="text-on-surface-variant">Outstanding</dt><dd className="mt-1 text-[13px] font-semibold">{money(balance)}</dd></div>
                </dl>
              </>
            ) : <p className="text-xs text-outline">No outstanding invoice for this patient.</p>}
          </Section>

          <Section title="Proposed allocation" aside="Preview only · Not a finalized allocation record">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Preview amount (INR)" prefix="₹" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))} error={amount ? error : undefined} disabled={!invoice} hint={`Partial amounts supported · Enter > ₹0 and ≤ ${money(ceiling)}.`} />
              <ul className="space-y-1.5 pt-6 text-xs font-semibold text-brand">
                <li>{numeric > 0 && numeric <= available ? '✓' : '✗'} Within payment funds: {money(numeric || 0)} ≤ {money(available)}</li>
                <li>{numeric > 0 && numeric <= balance ? '✓' : '✗'} Within invoice due: {money(numeric || 0)} ≤ {money(balance)}</li>
                <li className="font-normal text-outline">Maximum preview = min({money(available)}, {money(balance)}) = {money(ceiling)}. Higher amounts must be rejected.</li>
              </ul>
            </div>
            <p className="mt-4 text-xs text-outline">Reducing the preview amount leaves the remainder unallocated. No preview overwrites existing allocations or the actual {money(available)} available balance.</p>
          </Section>

          <Section title="Preserved allocation">
            {payment.allocations.length ? payment.allocations.map((allocation) => (
              <p key={allocation.invoiceId} className="flex items-center justify-between text-[13px] font-semibold">{allocationRef(payment, allocation)} → {allocation.invoiceId} · {money(allocation.amount)}<StatusPill>Existing · unchanged</StatusPill></p>
            )) : <p className="text-xs text-outline">No existing allocation on this payment.</p>}
            <p className="mt-3 text-xs text-outline">Existing allocations are historical records and are not edited by a new allocation.</p>
          </Section>
        </div>

        <Section title="If confirmed" aside={<StatusPill tone="warning">Preview</StatusPill>}>
          <p className="-mt-3 mb-4 text-xs text-outline">Unsaved preview · No balances posted</p>
          <dl className="space-y-4 text-xs">
            <div><dt className="text-on-surface-variant">Proposed new allocation</dt><dd className="mt-1 text-[13px] font-semibold">{money(numeric || 0)}</dd></div>
            <div><dt className="text-on-surface-variant">Payment funds remaining</dt><dd className="mt-1 text-[13px] font-semibold">{money(Math.max(available - numeric, 0))}</dd><p className="text-[11px] text-outline">{money(available)} available − {money(numeric || 0)} preview</p></div>
            <div><dt className="text-on-surface-variant">Invoice outstanding remaining</dt><dd className="mt-1 text-[13px] font-semibold">{money(Math.max(balance - numeric, 0))}</dd><p className="text-[11px] text-outline">{money(balance)} due − {money(numeric || 0)} preview</p></div>
          </dl>
          {error && amount && <Banner tone="warning" title="Confirmation blocked" className="mt-5">{error}</Banner>}
          <ActionButton variant="primary" className="mt-5" disabled={Boolean(error)} onClick={confirm}>Confirm allocation</ActionButton>
          <p className="mt-3 text-[11px] leading-4 text-outline">The payment remains Settled & Recorded. Only a separately confirmed allocation may change allocation status.</p>
        </Section>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline">Unsaved preview only · Cancel discards the {money(numeric || 0)} preview and returns to Payment Details with actual balances intact.</p>
        <ActionButton onClick={() => navigate(detailPath, { state })}>Cancel preview</ActionButton>
        <ActionButton variant="soft" disabled={Boolean(error)} onClick={confirm}>Confirm allocation</ActionButton>
      </div>
      <GovernanceFooter code="BF-12">Allocation is a distinct record. No funds are applied until eligibility is verified and a new allocation is explicitly confirmed.</GovernanceFooter>
    </BillingFrame>
  )
}
