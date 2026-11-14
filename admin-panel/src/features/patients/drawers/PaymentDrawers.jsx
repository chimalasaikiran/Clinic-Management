import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { allocatedFromPayment, allocationError, paymentUnallocated, refundCeiling, refundedAgainst } from '../billing'
import { Check, KeyValueRows, OptionSelect, TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { REFUND_REASONS } from '../data/catalog'
import { amountInWords, formatDate, formatINR, formatTime } from '../format'
import { validateRefund } from '../validation'

function Section({ title, aside, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center justify-between text-xs font-semibold tracking-wide text-brand uppercase">{title}{aside && <span className="font-normal text-outline normal-case">{aside}</span>}</h3>
      {children}
    </section>
  )
}

const Tile = ({ label, value, hint, tone }) => (
  <div className={cn('rounded-md border p-3', tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'brand' ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200')}>
    <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p>
    <p className="text-lg font-bold">{value}</p>
    {hint && <p className="text-[11px] text-on-surface-variant">{hint}</p>}
  </div>
)

export function PaymentDetailDrawer({ payment, patient, refunds, onClose, onAllocate, onReceipt, onRefund }) {
  if (!payment) return null
  const allocated = allocatedFromPayment(payment)
  const credit = paymentUnallocated(payment, refunds)
  const refunded = refundedAgainst(payment.id, refunds)
  const ratio = payment.amount ? Math.round((allocated / payment.amount) * 1000) / 10 : 0
  const events = [
    ...refunds.filter((refund) => refund.paymentId === payment.id).map((refund) => ({ time: `${formatDate(refund.date)}, ${formatTime(refund.time)}`, title: `Refund ${refund.id} authorized`, detail: `${formatINR(refund.amount)} · ${refund.reason}` })),
    ...payment.allocations.map((entry) => ({ time: `${formatDate(payment.date)}, ${formatTime(payment.time)}`, title: `Allocated ${formatINR(entry.amount)} to ${entry.invoiceId}`, detail: payment.cashier })),
    { time: `${formatDate(payment.date)}, ${formatTime(payment.time)}`, title: `Payment ingested via ${payment.channel}`, detail: `${payment.reference} · ${payment.cashier}` },
  ]

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Financial cashbook · payment record"
      title={`Payment details · #${payment.id}`}
      description={`${patient.name} · ${patient.mrn} · ${payment.desk}`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Close (Esc)</ActionButton><div className="flex flex-wrap gap-2"><ActionButton icon={Printer} onClick={() => window.print()}>Print Slip</ActionButton><ActionButton onClick={onReceipt}>View receipt voucher</ActionButton>{refundCeiling(payment, refunds) > 0 && <ActionButton variant="danger" onClick={onRefund}>Refund</ActionButton>}{credit > 0 && <ActionButton variant="brand" onClick={onAllocate}>Allocate Remaining {formatINR(credit)}</ActionButton>}</div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone="success">Settled & recorded · verified</StatusPill><StatusPill tone={credit > 0 ? 'warning' : 'neutral'}>{credit > 0 ? `Partially allocated (${ratio}%)` : refunded >= payment.amount ? 'Fully refunded' : 'Fully allocated'}</StatusPill></div>
        <InfoNote tone="brand"><strong>Strict statutory ledger object separation:</strong> Payment ≠ Allocation ≠ Receipt ≠ Invoice ≠ Refund. This record captures funds actually received and verified. Receipts are separate proof-of-payment documents, and allocations assign those funds to extinguish specific invoice liabilities.</InfoNote>
        <Section title="Fund capital dissection">
          <div className="grid gap-3 sm:grid-cols-3"><Tile label="Total inward payment" value={formatINR(payment.amount, 2)} hint="Received in full" /><Tile label="Allocated to invoice" value={formatINR(allocated, 2)} hint={payment.allocations.map((entry) => entry.invoiceId).join(', ') || 'None'} tone="brand" /><Tile label="Patient credit vault" value={formatINR(credit, 2)} hint="Held for future / refund" tone="amber" /></div>
          {refunded > 0 && <p className="mt-2 text-xs text-on-surface-variant">Refunded to date: <strong>{formatINR(refunded, 2)}</strong></p>}
        </Section>
        <Section title="Method & gateway telemetry"><KeyValueRows rows={[['Payment instrument', payment.instrument], ['Reference / UTR', payment.reference], ['Payer entity', payment.payer], ['Received', `${formatDate(payment.date)}, ${formatTime(payment.time)} IST`], ['Cashier', payment.cashier]]} /></Section>
        <Section title="Invoice allocation breakdown" aside={`${payment.allocations.length} linked ${payment.allocations.length === 1 ? 'invoice' : 'invoices'}`}>
          {payment.allocations.length === 0 && <p className="text-xs text-on-surface-variant">No invoices are linked to this payment.</p>}
          <ul className="flex flex-col gap-2">{payment.allocations.map((entry) => <li key={entry.invoiceId} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-xs"><span className="font-mono font-semibold">{entry.invoiceId}</span><span className="font-semibold">{formatINR(entry.amount, 2)}</span></li>)}</ul>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${ratio}% of this payment is allocated`}><div className="h-full bg-brand" style={{ width: `${ratio}%` }} /></div>
          <p className="mt-1 text-[11px] text-on-surface-variant">Allocated {formatINR(allocated)} of {formatINR(payment.amount)} ({ratio}%)</p>
        </Section>
        <Section title="Immutable activity & audit timeline"><Timeline events={events} /></Section>
      </div>
    </Drawer>
  )
}

export function AllocateDrawer({ payment, patient, refunds, openInvoices, onClose, onConfirm }) {
  const available = payment ? paymentUnallocated(payment, refunds) : 0
  const [amounts, setAmounts] = useState({})
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  if (!payment) return null

  const plan = Object.entries(amounts).filter(([, value]) => Number(value) > 0).map(([invoiceId, value]) => ({ invoiceId, amount: Number(value) }))
  const total = plan.reduce((sum, entry) => sum + entry.amount, 0)
  const invoiceErrors = Object.fromEntries(plan.map((entry) => [entry.invoiceId, allocationError({ amount: entry.amount, available: Number.POSITIVE_INFINITY, balance: openInvoices.find((invoice) => invoice.invoiceId === entry.invoiceId).balance })]).filter(([, error]) => error))
  const totalError = total > available ? 'Total exceeds the available unallocated credit.' : plan.length === 0 ? 'Select an invoice and enter an amount to allocate.' : null
  const shown = submitted ? totalError : null

  const toggle = (entry) => setAmounts((current) => (entry.invoiceId in current ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== entry.invoiceId)) : { ...current, [entry.invoiceId]: String(Math.min(entry.balance, available - total)) }))

  const confirm = () => {
    setSubmitted(true)
    if (totalError || Object.keys(invoiceErrors).length) return
    onConfirm(payment.id, plan, note.trim())
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Financial cashbook · revenue subledger · allocation engine"
      title="Allocate Payment"
      description={`#${payment.id} · ${patient.name} (MRN ${patient.mrn})`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Back (Esc)</ActionButton><div className="flex gap-2"><ActionButton onClick={() => setAmounts({})}>Clear Allocations</ActionButton><ActionButton variant="primary" onClick={confirm}>Confirm &amp; Commit Allocation ({formatINR(total, 2)}) →</ActionButton></div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <InfoNote tone="warning"><strong>Strict statutory ledger object separation:</strong> Allocation ≠ Payment ≠ Invoice ≠ Receipt ≠ Refund. Allocation creates a binding accounting link between funds already received and outstanding invoice liabilities. It does not collect new cash or re-issue tax invoices.</InfoNote>
        <Section title="Capital liquidity & vault telemetry">
          <div className="grid gap-3 sm:grid-cols-3"><Tile label="Original ingested" value={formatINR(payment.amount, 2)} /><Tile label="Previously allocated" value={formatINR(allocatedFromPayment(payment), 2)} /><Tile label="Available to allocate" value={formatINR(available, 2)} hint="Patient vault credit" tone="brand" /></div>
        </Section>
        <Section title="Select eligible invoices to extinguish liability" aside={`${openInvoices.length} available`}>
          {openInvoices.length === 0 && <p className="text-xs text-on-surface-variant">There are no issued invoices with an outstanding balance.</p>}
          <ul className="flex flex-col gap-3">{openInvoices.map((entry) => (
            <li key={entry.invoiceId} className={cn('rounded-md border p-3 text-xs', entry.invoiceId in amounts ? 'border-2 border-brand' : 'border-slate-200')}>
              <div className="flex flex-wrap items-start justify-between gap-2"><Check checked={entry.invoiceId in amounts} onChange={() => toggle(entry)} label={`${entry.invoiceId} — ${entry.title}`} /><span className="text-right font-semibold">{formatINR(entry.balance, 2)}<span className="block text-[10px] font-normal text-outline">Current outstanding</span></span></div>
              {entry.invoiceId in amounts && (
                <div className="mt-2 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2">Allocation amount (₹)<input aria-label={`Allocation amount for ${entry.invoiceId}`} type="number" min="0" value={amounts[entry.invoiceId]} onChange={(event) => setAmounts((current) => ({ ...current, [entry.invoiceId]: event.target.value }))} className="w-28 rounded border border-slate-300 px-2 py-1 text-right" /></label><ActionButton size="sm" onClick={() => setAmounts((current) => ({ ...current, [entry.invoiceId]: String(Math.min(entry.balance, available)) }))}>Allocate max available</ActionButton>{invoiceErrors[entry.invoiceId] && submitted && <span role="alert" className="text-rose-600">{invoiceErrors[entry.invoiceId]}</span>}</div>
              )}
            </li>
          ))}</ul>
          {shown && <p role="alert" className="mt-2 text-xs text-rose-600">{shown}</p>}
        </Section>
        <Section title="Live allocation computation engine"><div className="grid gap-3 rounded-md bg-slate-900 p-4 text-white sm:grid-cols-3">{[['Available liquid', formatINR(available, 2)], ['Proposed step', `- ${formatINR(total, 2)}`], ['Remaining vault', formatINR(Math.max(available - total, 0), 2)]].map(([label, value]) => <div key={label}><p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p><p className="font-mono text-lg font-bold">{value}</p></div>)}</div></Section>
        <TextArea label="Cashier internal audit narration (optional permanent memo)" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        <Check checked={notify} onChange={(event) => setNotify(event.target.checked)} label={`Trigger updated ledger statement via SMS & WhatsApp to patient (${patient.mobile})`} />
      </div>
    </Drawer>
  )
}

export function ReceiptDrawer({ payment, patient, onClose, onBack }) {
  if (!payment) return null
  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Financial cashbook · statutory voucher"
      title="Receipt Voucher details"
      description={`#${payment.receiptId} · Officially issued & sealed`}
      width="max-w-2xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onBack}>← Back to Payment</ActionButton><div className="flex gap-2"><ActionButton icon={Printer} onClick={() => window.print()}>Print Receipt (⌘P)</ActionButton><ActionButton variant="primary" icon={Download} onClick={() => window.print()}>Download PDF Voucher</ActionButton></div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <InfoNote tone="warning"><strong>Strict statutory ledger object separation: Receipt ≠ Payment ≠ Invoice ≠ Allocation ≠ Refund.</strong> A receipt is formal proof of funds actually received into clinic custody. It is not an invoice (billing liability claim), nor does it allocate funds to encounters or issue patient credits.</InfoNote>
        <div className="grid gap-3 sm:grid-cols-4"><Tile label="Total received" value={formatINR(payment.amount, 2)} /><Tile label="Allocated / vault" value={`${formatINR(payment.allocations.reduce((sum, entry) => sum + entry.amount, 0))}`} /><Tile label="Instrument" value={payment.channel} /><Tile label="Issued" value={`${formatDate(payment.date)}, ${formatTime(payment.time)}`} /></div>
        <article className="rounded-md border border-slate-300 bg-white p-5 text-xs">
          <header className="border-b border-slate-200 pb-3 text-center"><h3 className="text-base font-bold uppercase">St. Jude Health System — {patient.branch}</h3><p className="text-on-surface-variant">Official patient payment receipt voucher</p></header>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2"><div><dt className="text-outline">Receipt no</dt><dd className="font-semibold">{payment.receiptId}</dd></div><div><dt className="text-outline">Original payment</dt><dd className="font-semibold">{payment.id}</dd></div><div><dt className="text-outline">Patient</dt><dd className="font-semibold">{patient.name} · {patient.mrn}</dd></div><div><dt className="text-outline">Payer</dt><dd className="font-semibold">{payment.payer}</dd></div></dl>
          <table className="mt-4 w-full text-left"><thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">Description & clinical allocation purpose</th><th className="pb-2 text-right">Amount (₹)</th></tr></thead><tbody>{payment.allocations.map((entry) => <tr key={entry.invoiceId} className="border-t border-slate-100"><td className="py-2">Settlement of invoiced healthcare services ({entry.invoiceId})</td><td className="py-2 text-right font-mono">{entry.amount.toFixed(2)}</td></tr>)}{payment.amount - payment.allocations.reduce((sum, entry) => sum + entry.amount, 0) > 0 && <tr className="border-t border-slate-100"><td className="py-2">Unallocated patient deposit — retained in the patient credit vault</td><td className="py-2 text-right font-mono">{(payment.amount - payment.allocations.reduce((sum, entry) => sum + entry.amount, 0)).toFixed(2)}</td></tr>}</tbody></table>
          <p className="mt-3 flex items-center justify-between border-t border-slate-300 pt-2 text-sm font-bold">TOTAL GROSS INWARD REMITTANCE <span>{formatINR(payment.amount, 2)}</span></p>
          <p className="mt-2 text-on-surface-variant">Amount in words: <strong className="text-on-surface">{amountInWords(payment.amount)}</strong></p>
          <p className="mt-3 text-[10px] text-outline">Instrument: {payment.instrument} · Reference: {payment.reference}</p>
        </article>
        <Section title="Omnichannel dispatch status"><p className="text-xs text-on-surface-variant">Receipt dispatched to {patient.mobile} by SMS and WhatsApp, and linked to the ABHA personal health record.</p></Section>
      </div>
    </Drawer>
  )
}

const SOURCES = [
  { id: 'vault', title: 'Refund from unallocated patient credit vault only', detail: 'Liquid credit held in the patient vault. Leaves active invoices untouched and intact.' },
  { id: 'full', title: 'Full payment refund (unlink invoices)', detail: 'Reverses the whole payment and unlinks the allocated invoices, re-opening patient liability.' },
  { id: 'custom', title: 'Custom partial disbursal', detail: 'Specify an exact custom sum within statutory limits.' },
]

export function RefundDrawer({ payment, patient, refunds, onClose, onConfirm }) {
  const vault = payment ? paymentUnallocated(payment, refunds) : 0
  const ceiling = payment ? refundCeiling(payment, refunds) : 0
  const [source, setSource] = useState('vault')
  const [amount, setAmount] = useState(String(vault || ''))
  const [values, setValues] = useState({ reason: '', justification: '', memo: '' })
  const [submitted, setSubmitted] = useState(false)
  if (!payment) return null
  const errors = submitted ? validateRefund({ amount, available: ceiling, reason: values.reason, justification: values.justification }) : {}

  const choose = (id) => {
    setSource(id)
    setAmount(String(id === 'vault' ? vault : id === 'full' ? ceiling : ''))
  }
  const confirm = () => {
    setSubmitted(true)
    if (Object.keys(validateRefund({ amount, available: ceiling, reason: values.reason, justification: values.justification })).length) return
    onConfirm(payment.id, { amount: Number(amount), reason: values.reason, justification: values.justification.trim(), memo: values.memo.trim() })
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Financial cashbook · revenue subledger · statutory voucher"
      title="Refund Payment"
      description={`#${payment.id} · ${patient.name} (MRN ${patient.mrn})`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Cancel (Esc)</ActionButton><ActionButton variant="primary" onClick={confirm}>Authorize & Commit Refund ({formatINR(Number(amount) || 0, 2)}) →</ActionButton></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <InfoNote tone="warning"><strong>Strict statutory ledger object separation:</strong> Refund ≠ Payment ≠ Invoice ≠ Receipt ≠ Allocation. A refund is an independent reverse-capital financial instrument. It never overwrites the original payment or receipt records.</InfoNote>
        <Section title="1. Original inward payment ingestion"><div className="grid gap-3 sm:grid-cols-4"><Tile label="Original inflow" value={formatINR(payment.amount, 2)} hint={payment.instrument} /><Tile label="Gateway status" value="Settled" hint={payment.reference} /><Tile label="Allocated funds" value={formatINR(allocatedFromPayment(payment), 2)} /><Tile label="Patient credit" value={formatINR(vault, 2)} hint="Liquid / unallocated" tone="brand" /></div></Section>
        <Section title="3. Refund specification & disbursement source">
          <div role="radiogroup" aria-label="Refund source" className="flex flex-col gap-2">{SOURCES.map((entry) => <RadioCard key={entry.id} name="source" value={entry.id} checked={source === entry.id} onChange={() => choose(entry.id)} title={entry.title} detail={entry.detail} />)}</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><TextInput label="Refund quantum (INR)" name="amount" type="number" min="0" required prefix="₹" value={amount} onChange={(event) => setAmount(event.target.value)} error={errors.amount} hint={`Max available ${formatINR(ceiling)}`} /><OptionSelect label="Statutory reason for refund" required value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} error={errors.reason} placeholder="Select a reason" options={REFUND_REASONS.map((entry) => ({ value: entry, label: entry }))} /></div>
          <div className="mt-4"><TextArea label="Clinical & cashier justification" required rows={2} value={values.justification} onChange={(event) => setValues((current) => ({ ...current, justification: event.target.value }))} error={errors.justification} /></div>
          <div className="mt-3"><TextArea label="Internal cashier memo (private subledger note)" rows={2} value={values.memo} onChange={(event) => setValues((current) => ({ ...current, memo: event.target.value }))} /></div>
        </Section>
        <Section title="4. Disbursement channel & gateway route"><p className="text-xs text-on-surface-variant">Refunds are returned to the original payment source ({payment.instrument}). Direct NEFT or cash-counter disbursement requires supervisor approval.</p></Section>
        <Section title="5. Double-entry accounting subledger preview"><p className="font-mono text-xs">DR  Patient credit vault — {patient.name} · {formatINR(Number(amount) || 0, 2)}<br />CR  {payment.channel} clearing / escrow · {formatINR(Number(amount) || 0, 2)}</p></Section>
      </div>
    </Drawer>
  )
}
